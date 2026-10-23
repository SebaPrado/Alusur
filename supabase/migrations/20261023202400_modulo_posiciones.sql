-- =====================================================================
-- CÓMO EJECUTAR: pegar TODO en Supabase → SQL Editor → Run.
-- Va dentro de una transacción: si algo falla, no se aplica nada.
-- Al final se registra en el historial de migraciones.
--
-- YA APLICADA en la base (2026-10-23). Este archivo sincroniza el repo.
-- No volver a ejecutarla sobre el proyecto remoto.
-- =====================================================================
--
-- Una fila por módulo ya ubicado en la fachada. Las posiciones vacías
-- no se guardan: salen de fachada_slots() / buildSlots().
-- La asignación la dispara un trigger al insertar módulos.
-- El cliente no llama a asignar_posiciones.
-- =====================================================================
begin;

create table public.modulo_posiciones (
  modulo_id   uuid primary key references public.modulos (id) on delete cascade,
  obra_id     uuid not null references public.obras (id),
  piso        int  not null,
  cara_codigo text not null,
  eje         int  not null check (eje >= 1),
  origen      text not null default 'auto' check (origen in ('auto', 'manual')),
  created_at  timestamptz not null default now(),
  unique (obra_id, piso, cara_codigo, eje)
);

-- Misma grilla que buildSlots(): piso × cara × eje, con el tipo de la secuencia.
create function public.fachada_slots(p_obra uuid)
returns table (
  piso        int,
  cara_codigo text,
  cara_orden  int,
  eje         int,
  tipo        public.modulo_tipo
)
language sql stable set search_path = public as $$
  select p.piso, c.codigo, c.orden, e.eje,
         (c.secuencia[((e.eje - 1) % array_length(c.secuencia, 1)) + 1])::text::public.modulo_tipo
  from public.fachadas f
  join public.fachada_caras c on c.obra_id = f.obra_id
  cross join lateral generate_series(f.piso_desde, f.piso_hasta) as p(piso)
  cross join lateral generate_series(1, c.modulos_por_piso) as e(eje)
  where f.obra_id = p_obra
  order by p.piso, c.orden, e.eje;
$$;

-- Ubica los módulos que todavía no tienen fila, en el primer hueco libre
-- del mismo tipo (orden de la fachada; módulos por código de contenedor).
create function public.asignar_posiciones(p_obra uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtextextended('asignar_posiciones:' || p_obra::text, 0));

  with libres as (
    select s.piso, s.cara_codigo, s.eje, s.tipo,
           row_number() over (partition by s.tipo order by s.piso, s.cara_orden, s.eje) as n
    from public.fachada_slots(p_obra) s
    where not exists (
      select 1 from public.modulo_posiciones mp
      where mp.obra_id = p_obra and mp.piso = s.piso
        and mp.cara_codigo = s.cara_codigo and mp.eje = s.eje)
  ),
  pendientes as (
    select m.id, m.tipo,
           row_number() over (partition by m.tipo order by c.codigo, m.posicion) as n
    from public.modulos m
    join public.contenedores c on c.id = m.contenedor_id
    where m.obra_id = p_obra
      and not exists (select 1 from public.modulo_posiciones mp where mp.modulo_id = m.id)
  )
  insert into public.modulo_posiciones (modulo_id, obra_id, piso, cara_codigo, eje)
  select p.id, p_obra, l.piso, l.cara_codigo, l.eje
  from pendientes p
  join libres l on l.tipo = p.tipo and l.n = p.n;

  get diagnostics v_n = row_count;
  return v_n; -- si hay más módulos que posiciones, los que sobran quedan sin posición
end $$;

create function public.tg_modulos_asignar_posiciones()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select distinct obra_id from nuevos loop
    perform public.asignar_posiciones(r.obra_id);
  end loop;
  return null;
end $$;

create trigger modulos_asignar_posiciones
  after insert on public.modulos
  referencing new table as nuevos
  for each statement execute function public.tg_modulos_asignar_posiciones();

alter table public.modulo_posiciones enable row level security;

create policy "modulo_posiciones_select" on public.modulo_posiciones
  for select to authenticated
  using (obra_id in (select public.my_obra_ids()));

-- El cliente no asigna: solo el trigger (security definer) escribe.
revoke execute on function public.asignar_posiciones(uuid) from public, anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261023202400', 'modulo_posiciones')
on conflict (version) do nothing;

commit;
