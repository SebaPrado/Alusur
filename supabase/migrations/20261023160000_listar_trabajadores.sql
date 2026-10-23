-- Listado de obreros de una obra (incluye código/bloqueo solo con members.manage).
begin;

create or replace function public.listar_trabajadores(p_obra uuid)
returns table (
  user_id uuid, full_name text, phone text,
  empresa_id uuid, empresa text,
  worker_code text, bloqueado_hasta timestamptz,
  equipo_id uuid, equipo text,
  habilitaciones text[], activo boolean
)
language plpgsql
stable
security definer            -- necesario para leer worker_credentials; el permiso se valida abajo
set search_path = public
as $$
#variable_conflict use_column
declare
  v_gestion boolean;
  v_ver     boolean;
begin
  v_gestion := (select is_ceo()) or p_obra in (select obras_with_perm('members.manage'));
  v_ver     := v_gestion or p_obra in (select obras_with_perm('equipo.manage'));
  if not v_ver then
    raise exception 'Sin permiso para ver el personal de esta obra' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    case when v_gestion then p.phone end,
    m.empresa_id,
    e.nombre,
    case when v_gestion then wc.worker_code end,
    case when v_gestion and wc.locked_until > now() then wc.locked_until end,
    em.equipo_id,
    eq.nombre,
    coalesce((
      select array_agg(mt.nombre order by mt.nombre)
      from habilitaciones h
      join maquina_tipos mt on mt.id = h.maquina_tipo_id
      where h.user_id = p.id and (h.valid_until is null or h.valid_until >= current_date)
    ), '{}'),
    m.active
  from obra_members m
  join profiles p            on p.id = m.user_id
  left join empresas e       on e.id = m.empresa_id
  left join worker_credentials wc on wc.user_id = p.id
  left join equipo_members em on em.obra_id = m.obra_id and em.user_id = m.user_id and em.left_at is null
  left join equipos eq       on eq.id = em.equipo_id
  where m.obra_id = p_obra and m.role = 'obrero'
  order by m.active desc, p.full_name;
end;
$$;

revoke all on function public.listar_trabajadores(uuid) from public;
grant execute on function public.listar_trabajadores(uuid) to authenticated;

commit;
