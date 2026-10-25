-- Borrado real de un contenedor en nivel libre.
-- El import deja filas en status_events. Esa tabla es append-only, así que
-- el DELETE del RPC chocaba con el trigger. La excepción solo se abre
-- dentro de esta transacción, con un ajuste local.

create or replace function public.block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'status_events'
     and tg_op = 'DELETE'
     and current_setting('alusur.purge_status_events', true) = 'on' then
    return old;
  end if;
  raise exception '% es append-only: no se permite %', tg_table_name, tg_op;
end $$;

create or replace function public.contenedor_eliminar(p_contenedor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contenedores%rowtype;
begin
  select * into c from public.contenedores where id = p_contenedor;
  if not found then raise exception 'No existe el contenedor %', p_contenedor; end if;
  perform public.require_perm(c.obra_id, 'contenedor.delete');

  if public.contenedor_nivel_edicion(p_contenedor) <> 'libre' then
    raise exception 'El contenedor % ya no se puede eliminar: anulalo indicando el motivo', c.codigo;
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
values ('20261025190500', 'contenedor_eliminar_eventos')
on conflict (version) do nothing;
