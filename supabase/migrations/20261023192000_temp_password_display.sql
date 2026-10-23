-- Contraseña temporal visible para CEO / members.manage (como pin_display).
-- Se limpia cuando el usuario elige su contraseña definitiva.
begin;

alter table public.profiles
  add column if not exists temp_password_display text;

comment on column public.profiles.temp_password_display is
  'Contraseña temporal en claro para reimpresión/gestión (como pin_display).';

drop function if exists public.listar_usuarios(uuid);

create or replace function public.listar_usuarios(p_obra uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  empresa_id uuid,
  empresa text,
  role public.obra_role,
  temp_password text,
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
    p.temp_password_display,
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
