-- =====================================================================
-- CÓMO EJECUTAR: pegar TODO en Supabase → SQL Editor → Run.
-- Va dentro de una transacción: si algo falla, no se aplica nada.
-- Al final se registra en el historial de migraciones.
-- =====================================================================
begin;

-- =====================================================================
-- Entorno "nada": una cara puede no dibujar mar, calle ni parque.
-- Se recrea el enum (ADD VALUE no se puede usar en la misma transacción).
-- =====================================================================

drop function public.guardar_fachada(uuid, jsonb);

alter type public.cara_entorno rename to cara_entorno_old;
create type public.cara_entorno as enum ('mar', 'calle', 'parque', 'nada');
alter table public.fachada_caras
  alter column entorno type public.cara_entorno
  using entorno::text::public.cara_entorno;
drop type public.cara_entorno_old;

create function public.guardar_fachada(p_obra uuid, p_config jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_errores text[] := '{}';
  v_caras   jsonb  := p_config -> 'caras';
  v_cara    jsonb;
  v_i       int    := 0;
  v_nombre  text;
  v_desde   int;
  v_hasta   int;
  v_ancho   numeric;
  v_alto    numeric;
  v_modulos int;
  v_largo   int;
  v_codigo  text;
begin
  perform public.require_perm(p_obra, 'fachada.manage');

  -- Los casts van dentro de CASE: un valor mal formado tiene que ser un error
  -- de validación, no una excepción de tipos.
  v_desde := case when jsonb_typeof(p_config -> 'piso_desde') = 'number'
                   and (p_config ->> 'piso_desde') ~ '^-?[0-9]{1,6}$'
                  then (p_config ->> 'piso_desde')::int end;
  v_hasta := case when jsonb_typeof(p_config -> 'piso_hasta') = 'number'
                   and (p_config ->> 'piso_hasta') ~ '^-?[0-9]{1,6}$'
                  then (p_config ->> 'piso_hasta')::int end;
  if v_desde is null or v_hasta is null then
    v_errores := array_append(v_errores, 'Los pisos desde y hasta tienen que ser números enteros.');
  elsif v_desde > v_hasta then
    v_errores := array_append(v_errores,
      format('El piso desde (%s) no puede ser mayor que el piso hasta (%s).', v_desde, v_hasta));
  end if;

  v_ancho := case when jsonb_typeof(p_config -> 'ancho_modulo_m') = 'number'
                  then (p_config ->> 'ancho_modulo_m')::numeric end;
  v_alto  := case when jsonb_typeof(p_config -> 'alto_piso_m') = 'number'
                  then (p_config ->> 'alto_piso_m')::numeric end;
  if v_ancho is null or v_ancho <= 0 or v_alto is null or v_alto <= 0 then
    v_errores := array_append(v_errores,
      'El ancho del módulo y el alto del piso tienen que ser números mayores que 0.');
  end if;

  if jsonb_typeof(v_caras) is distinct from 'array' then
    v_caras := '[]';
  end if;
  if jsonb_array_length(v_caras) = 0 then
    v_errores := array_append(v_errores, 'La fachada no tiene caras.');
  elsif jsonb_array_length(v_caras) > 4 then
    v_errores := array_append(v_errores,
      format('Hay %s caras: el máximo es 4.', jsonb_array_length(v_caras)));
  end if;

  for v_cara in select * from jsonb_array_elements(v_caras) loop
    v_i := v_i + 1;
    v_codigo := nullif(btrim(coalesce(v_cara ->> 'codigo', '')), '');
    v_nombre := coalesce(v_codigo, '#' || v_i);

    if v_codigo is null then
      v_errores := array_append(v_errores, format('La cara %s no tiene código.', v_i));
    end if;

    v_modulos := case when jsonb_typeof(v_cara -> 'modulos_por_piso') = 'number'
                       and (v_cara ->> 'modulos_por_piso') ~ '^[0-9]{1,6}$'
                      then (v_cara ->> 'modulos_por_piso')::int end;
    if v_modulos is null or v_modulos < 1 then
      v_errores := array_append(v_errores, format('La cara %s no tiene módulos por piso.', v_nombre));
    end if;

    v_largo := case when jsonb_typeof(v_cara -> 'secuencia') = 'array'
                    then jsonb_array_length(v_cara -> 'secuencia') else 0 end;
    if v_largo = 0 then
      v_errores := array_append(v_errores, format('La cara %s tiene la secuencia vacía.', v_nombre));
    elsif exists (
      select 1 from jsonb_array_elements(v_cara -> 'secuencia') t
      where jsonb_typeof(t) is distinct from 'string'
         or (t #>> '{}') <> all (enum_range(null::public.modulo_tipo)::text[])
    ) then
      v_errores := array_append(v_errores,
        format('La cara %s tiene un tipo de módulo inválido en la secuencia (ventana o panel).', v_nombre));
    end if;

    if coalesce(v_cara ->> 'entorno', '') <> all (enum_range(null::public.cara_entorno)::text[]) then
      v_errores := array_append(v_errores,
        format('La cara %s no tiene un entorno válido (mar, calle, parque o nada).', v_nombre));
    end if;
  end loop;

  for v_codigo in
    select btrim(e.c ->> 'codigo')
    from jsonb_array_elements(v_caras) with ordinality as e(c, n)
    where nullif(btrim(e.c ->> 'codigo'), '') is not null
    group by 1
    having count(*) > 1
    order by min(e.n)
  loop
    v_errores := array_append(v_errores, format('El código de cara "%s" está repetido.', v_codigo));
  end loop;

  if cardinality(v_errores) > 0 then
    raise exception '%', array_to_string(v_errores, E'\n') using errcode = '22023';
  end if;

  insert into public.fachadas
    (obra_id, piso_desde, piso_hasta, ancho_modulo_m, alto_piso_m, updated_by, updated_at)
  values (p_obra, v_desde, v_hasta, v_ancho, v_alto, auth.uid(), now())
  on conflict (obra_id) do update set
    piso_desde     = excluded.piso_desde,
    piso_hasta     = excluded.piso_hasta,
    ancho_modulo_m = excluded.ancho_modulo_m,
    alto_piso_m    = excluded.alto_piso_m,
    updated_by     = excluded.updated_by,
    updated_at     = excluded.updated_at;

  delete from public.fachada_caras where obra_id = p_obra;

  insert into public.fachada_caras (obra_id, orden, codigo, nombre, modulos_por_piso, secuencia, entorno)
  select
    p_obra,
    e.n,
    btrim(e.c ->> 'codigo'),
    btrim(coalesce(e.c ->> 'nombre', '')),
    (e.c ->> 'modulos_por_piso')::int,
    array(
      select s.tipo
      from jsonb_array_elements_text(e.c -> 'secuencia') with ordinality as s(tipo, k)
      order by s.k
    )::public.modulo_tipo[],
    (e.c ->> 'entorno')::public.cara_entorno
  from jsonb_array_elements(v_caras) with ordinality as e(c, n);
end $$;

revoke execute on function public.guardar_fachada(uuid, jsonb) from public, anon;
grant  execute on function public.guardar_fachada(uuid, jsonb) to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261023131500', 'fachada_entorno_nada')
on conflict (version) do nothing;

commit;
