-- El CEO, en pruebas, puede borrar un contenedor que ya salió de producción
-- si todavía no tiene rastro (fotos, incidencias o módulos que avanzaron).
-- Quien no es CEO sigue limitado al nivel libre.

create or replace function public.contenedor_eliminar(p_contenedor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c        public.contenedores%rowtype;
  v_nivel  text;
  v_rastro boolean;
begin
  select * into c from public.contenedores where id = p_contenedor;
  if not found then raise exception 'No existe el contenedor %', p_contenedor; end if;
  perform public.require_perm(c.obra_id, 'contenedor.delete');

  v_nivel := public.contenedor_nivel_edicion(p_contenedor);
  v_rastro :=
       exists (select 1 from public.fotos f
               where f.contenedor_id = c.id
                  or f.modulo_id in (select id from public.modulos where contenedor_id = c.id))
    or exists (select 1 from public.incidencias i
               where i.contenedor_id = c.id
                  or i.modulo_id in (select id from public.modulos where contenedor_id = c.id))
    or exists (select 1 from public.modulos m
               where m.contenedor_id = c.id and m.estado <> 'en_contenedor')
    or exists (select 1 from public.status_events e
               where e.modulo_id in (select id from public.modulos where contenedor_id = c.id)
                 and e.to_state <> 'editado');

  if v_nivel = 'anulado' then
    raise exception 'El contenedor % está anulado y queda en el historial', c.codigo;
  elsif v_nivel <> 'libre' then
    if not public.is_ceo() then
      raise exception 'El contenedor % ya no se puede eliminar: anulalo indicando el motivo', c.codigo;
    end if;
    if v_rastro then
      raise exception 'El contenedor % tiene fotos, incidencias o módulos que ya avanzaron. No se borra.', c.codigo;
    end if;
  end if;

  perform set_config('alusur.purge_status_events', 'on', true);

  delete from public.modulo_posiciones
   where modulo_id in (select id from public.modulos where contenedor_id = c.id);

  delete from public.status_events
   where contenedor_id = c.id
      or modulo_id in (select id from public.modulos where contenedor_id = c.id);

  delete from public.modulos where contenedor_id = c.id;
  delete from public.contenedores where id = c.id;
end $$;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261025191500', 'ceo_elimina_contenedor_prueba')
on conflict (version) do nothing;
