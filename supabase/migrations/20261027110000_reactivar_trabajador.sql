-- El CEO puede volver a activar un obrero dado de baja.
-- No reabre el equipo: queda sin equipo, como al alta.

begin;

create or replace function public.reactivar_trabajador(p_obra uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.obra_role;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if not public.is_ceo() then
    raise exception 'Solo un CEO puede reactivar trabajadores' using errcode = '42501';
  end if;

  select role into v_role
  from public.obra_members
  where obra_id = p_obra and user_id = p_user;

  if not found then
    raise exception 'El trabajador no pertenece a esta obra';
  end if;
  if v_role is distinct from 'obrero' then
    raise exception 'Solo se pueden reactivar trabajadores';
  end if;

  update public.obra_members
  set active = true
  where obra_id = p_obra and user_id = p_user;
end;
$$;

revoke all on function public.reactivar_trabajador(uuid, uuid) from public, anon;
grant execute on function public.reactivar_trabajador(uuid, uuid) to authenticated;

commit;
