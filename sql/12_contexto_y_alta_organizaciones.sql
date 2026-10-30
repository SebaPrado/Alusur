-- =====================================================================
-- 12 · Contexto del usuario y alta de organizaciones (plataforma)
-- 29/10/2026 · Ejecutar entero en el SQL Editor. Una sola transacción.
--
--   mi_contexto()                      → qué es el usuario y en qué organizaciones está
--   crear_organizacion(nombre, areas)  → solo plataforma
--   actualizar_areas_organizacion(...) → solo plataforma
--   guardia: las áreas de una organización solo las cambia la plataforma
--            (un dueño no puede habilitarse Construcción solo)
--
-- El dueño de una organización nueva se crea con la Edge Function
-- admin-users, acción create_admin_member, rol 'dueno' (ya funciona:
-- la plataforma pasa admin_can_manage_members desde la migración 11).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Contexto: una sola llamada al entrar
-- {
--   "plataforma": false,
--   "organizaciones": [
--     { "id": "…", "nombre": "Alusur", "rol": "dueno", "areas": ["construccion","administracion"] }
--   ]
-- }
-- Plataforma: todas las organizaciones, con rol "plataforma".
-- Un obrero o un usuario solo de obra (sin admin_members) recibe
-- "organizaciones" con las organizaciones de sus obras y rol "obra".
-- ---------------------------------------------------------------------
create or replace function public.mi_contexto()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with yo as (select public.is_plataforma() as plataforma),
  orgs as (
    -- plataforma: todas
    select o.id, o.name, o.areas, 'plataforma'::text as rol, 1 as prioridad
    from public.admin_organizations o, yo where yo.plataforma
    union all
    -- miembro de la organización (dueno / admin / vendedor)
    select o.id, o.name, o.areas, m.role, 2
    from public.admin_members m
    join public.admin_organizations o on o.id = m.organization_id
    where m.user_id = auth.uid() and m.active
    union all
    -- solo miembro de alguna obra de la organización
    select distinct o.id, o.name, o.areas, 'obra', 3
    from public.obra_members om
    join public.obras ob on ob.id = om.obra_id
    join public.admin_organizations o on o.id = ob.organization_id
    where om.user_id = auth.uid() and om.active
  ),
  una as (
    select distinct on (id) id, name, areas, rol from orgs order by id, prioridad
  )
  select jsonb_build_object(
    'plataforma', (select plataforma from yo),
    'organizaciones', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'nombre', name, 'rol', rol, 'areas', to_jsonb(areas))
                       order by name)
      from una), '[]'::jsonb));
$$;

revoke all on function public.mi_contexto() from public, anon;
grant execute on function public.mi_contexto() to authenticated;

-- ---------------------------------------------------------------------
-- 2) Guardia: áreas solo las cambia la plataforma (o el SQL Editor)
-- ---------------------------------------------------------------------
create or replace function public.tg_organizacion_areas()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.areas is distinct from old.areas
     and auth.uid() is not null
     and not public.is_plataforma() then
    raise exception 'Solo la plataforma puede cambiar las áreas de una organización' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger admin_organizations_areas
  before update on public.admin_organizations
  for each row execute function public.tg_organizacion_areas();

-- ---------------------------------------------------------------------
-- 3) Alta y áreas (solo plataforma)
-- ---------------------------------------------------------------------
create or replace function public.crear_organizacion(p_nombre text, p_areas text[])
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  if not public.is_plataforma() then
    raise exception 'Solo la plataforma puede crear organizaciones' using errcode = '42501';
  end if;
  if nullif(trim(p_nombre), '') is null then
    raise exception 'El nombre es obligatorio';
  end if;
  if exists (select 1 from public.admin_organizations where lower(name) = lower(trim(p_nombre))) then
    raise exception 'Ya existe una organización llamada "%"', trim(p_nombre);
  end if;

  insert into public.admin_organizations (name, areas, allow_negative_stock, receipt_footer, next_sale_number)
  values (trim(p_nombre), p_areas, false, 'Control interno - No válido como factura DGI', 1)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_areas_organizacion(p_organizacion uuid, p_areas text[])
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_plataforma() then
    raise exception 'Solo la plataforma puede cambiar las áreas' using errcode = '42501';
  end if;
  update public.admin_organizations set areas = p_areas where id = p_organizacion;
  if not found then
    raise exception 'No existe la organización';
  end if;
end $$;

revoke all on function public.crear_organizacion(text, text[])                 from public, anon;
revoke all on function public.actualizar_areas_organizacion(uuid, text[])      from public, anon;
grant execute on function public.crear_organizacion(text, text[])              to authenticated;
grant execute on function public.actualizar_areas_organizacion(uuid, text[])   to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261029120000', 'contexto_y_alta_organizaciones')
on conflict (version) do nothing;

commit;
