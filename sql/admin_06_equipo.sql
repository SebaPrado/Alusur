-- =====================================================================
-- admin_06_equipo.sql
-- Gestión de miembros de la organización (dueño / admin / vendedor).
-- Puede gestionar: dueño activo, o CEO de plataforma que ya es miembro.
-- Ejecutar DESPUÉS de admin_01_schema.sql (y de init_roles con is_ceo).
-- =====================================================================

create or replace function public.admin_can_manage_members(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and (m.role = 'dueno' or public.is_ceo())
  );
$$;

create or replace function public.admin_list_members(p_organization_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.admin_has_role(p_organization_id) then
    raise exception 'Sin permiso para ver el equipo de esta organización'
      using errcode = '42501';
  end if;

  return query
  select
    m.user_id,
    m.display_name,
    au.email::text,
    m.role,
    m.active
  from public.admin_members m
  left join auth.users au on au.id = m.user_id
  where m.organization_id = p_organization_id
  order by m.active desc, m.display_name;
end;
$$;

create or replace function public.admin_upsert_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_can_manage_members(p_organization_id) then
    raise exception 'Solo el dueño (o el CEO) puede gestionar el equipo'
      using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('dueno', 'admin', 'vendedor') then
    raise exception 'Rol inválido';
  end if;

  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  if exists (
    select 1
    from public.admin_members m
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
  ) then
    update public.admin_members
       set role = p_role,
           display_name = btrim(p_display_name),
           active = true
     where organization_id = p_organization_id
       and user_id = p_user_id;
  else
    insert into public.admin_members (
      organization_id, user_id, role, display_name, active
    ) values (
      p_organization_id, p_user_id, p_role, btrim(p_display_name), true
    );
  end if;
end;
$$;

create or replace function public.admin_set_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_active boolean;
  v_duenos int;
begin
  if not public.admin_can_manage_members(p_organization_id) then
    raise exception 'Solo el dueño (o el CEO) puede gestionar el equipo'
      using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol';
  end if;

  if p_role is null or p_role not in ('dueno', 'admin', 'vendedor') then
    raise exception 'Rol inválido';
  end if;

  select m.role, m.active
    into v_current, v_active
    from public.admin_members m
   where m.organization_id = p_organization_id
     and m.user_id = p_user_id;

  if v_current is null then
    raise exception 'Miembro no encontrado';
  end if;

  if v_current = 'dueno' and p_role <> 'dueno' and v_active then
    select count(*)::int into v_duenos
      from public.admin_members m
     where m.organization_id = p_organization_id
       and m.role = 'dueno'
       and m.active;
    if v_duenos <= 1 then
      raise exception 'Debe quedar al menos un dueño activo';
    end if;
  end if;

  update public.admin_members
     set role = p_role
   where organization_id = p_organization_id
     and user_id = p_user_id;
end;
$$;

create or replace function public.admin_set_member_active(
  p_organization_id uuid,
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_duenos int;
begin
  if not public.admin_can_manage_members(p_organization_id) then
    raise exception 'Solo el dueño (o el CEO) puede gestionar el equipo'
      using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No podés darte de baja a vos mismo';
  end if;

  select m.role, m.active
    into v_role, v_active
    from public.admin_members m
   where m.organization_id = p_organization_id
     and m.user_id = p_user_id;

  if v_role is null then
    raise exception 'Miembro no encontrado';
  end if;

  if v_role = 'dueno' and v_active and p_active is false then
    select count(*)::int into v_duenos
      from public.admin_members m
     where m.organization_id = p_organization_id
       and m.role = 'dueno'
       and m.active;
    if v_duenos <= 1 then
      raise exception 'Debe quedar al menos un dueño activo';
    end if;
  end if;

  update public.admin_members
     set active = coalesce(p_active, false)
   where organization_id = p_organization_id
     and user_id = p_user_id;
end;
$$;

revoke all on function public.admin_can_manage_members(uuid) from public, anon;
revoke all on function public.admin_list_members(uuid) from public, anon;
revoke all on function public.admin_upsert_member(uuid, uuid, text, text) from public, anon;
revoke all on function public.admin_set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.admin_set_member_active(uuid, uuid, boolean) from public, anon;

grant execute on function public.admin_can_manage_members(uuid) to authenticated;
grant execute on function public.admin_list_members(uuid) to authenticated;
grant execute on function public.admin_upsert_member(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_member_active(uuid, uuid, boolean) to authenticated;
