-- Listado de usuarios web de una obra (no obreros). Email desde auth.users.
begin;

create or replace function public.listar_usuarios(p_obra uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  empresa_id uuid,
  empresa text,
  role public.obra_role,
  activo boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not ((select is_ceo()) or p_obra in (select obras_with_perm('members.manage'))) then
    raise exception 'Sin permiso para ver los usuarios de esta obra' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    au.email::text,
    m.empresa_id,
    e.nombre,
    m.role,
    m.active
  from obra_members m
  join profiles p on p.id = m.user_id
  left join auth.users au on au.id = p.id
  left join empresas e on e.id = m.empresa_id
  where m.obra_id = p_obra
    and m.role <> 'obrero'
  order by m.active desc, p.full_name;
end;
$$;

revoke all on function public.listar_usuarios(uuid) from public;
grant execute on function public.listar_usuarios(uuid) to authenticated;

commit;
