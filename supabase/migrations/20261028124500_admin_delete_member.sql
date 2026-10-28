-- Eliminar para siempre un miembro ya dado de baja.
-- Las ventas y cajas quedan (seller_id / opened_by apuntan a auth.users).

create or replace function public.admin_delete_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  if not public.admin_can_manage_members(p_organization_id) then
    raise exception 'Solo el dueño (o el CEO) puede gestionar el equipo'
      using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No podés eliminarte a vos mismo';
  end if;

  select m.active
    into v_active
    from public.admin_members m
   where m.organization_id = p_organization_id
     and m.user_id = p_user_id;

  if v_active is null then
    raise exception 'Miembro no encontrado';
  end if;

  if v_active then
    raise exception 'Primero hay que darlo de baja';
  end if;

  delete from public.admin_members
   where organization_id = p_organization_id
     and user_id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_member(uuid, uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid, uuid) to authenticated;
