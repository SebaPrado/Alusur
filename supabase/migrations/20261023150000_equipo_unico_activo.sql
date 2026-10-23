-- Un solo equipo activo por trabajador y obra; líder opcional; RPC asignar_equipo.
begin;

-- un solo equipo activo por trabajador y obra
create unique index if not exists equipo_members_un_activo
  on public.equipo_members (obra_id, user_id)
  where left_at is null;

-- líder opcional
alter table public.equipos
  add column if not exists lider_user_id uuid references public.profiles(id);

-- cambiar de equipo (o sacarlo de todo equipo con p_equipo = null)
create or replace function public.asignar_equipo(p_obra uuid, p_user uuid, p_equipo uuid)
returns void
language plpgsql
security invoker            -- los permisos los aplica la RLS de equipo_members (equipo.manage)
set search_path = public
as $$
begin
  if p_equipo is not null and not exists (
    select 1 from equipos where id = p_equipo and obra_id = p_obra) then
    raise exception 'El equipo no pertenece a esta obra';
  end if;

  if not exists (
    select 1 from obra_members where obra_id = p_obra and user_id = p_user and active) then
    raise exception 'El trabajador no es miembro activo de esta obra';
  end if;

  -- ya está en ese equipo: no hacer nada
  if p_equipo is not null and exists (
    select 1 from equipo_members
    where obra_id = p_obra and user_id = p_user and equipo_id = p_equipo and left_at is null) then
    return;
  end if;

  update equipo_members set left_at = now()
  where obra_id = p_obra and user_id = p_user and left_at is null;

  if p_equipo is not null then
    insert into equipo_members (equipo_id, obra_id, user_id, joined_at)
    values (p_equipo, p_obra, p_user, now());
  end if;
end;
$$;

grant execute on function public.asignar_equipo(uuid, uuid, uuid) to authenticated;

commit;
