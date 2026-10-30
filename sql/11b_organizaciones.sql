-- =====================================================================
-- 11b · Organizaciones (multiempresa)
-- 29/10/2026 · Ejecutar DESPUÉS de 11a, entero, en el SQL Editor.
-- Una sola transacción: si algo falla, no cambia nada.
--
-- La organización es la fila de admin_organizations (ya existía para
-- Administración; ahora es la de toda la app). Se mantienen los nombres
-- admin_organizations / admin_members para no romper Administración.
--
--   plataforma  = profiles.platform_role 'plataforma' → ve y puede todo (Sebastián)
--   dueño       = admin_members.role 'dueno' → todo dentro de SU organización
--   obra        = obra_members, igual que hoy
--
-- Transición: Ricardo y Juan conservan platform_role = 'ceo' SOLO para que
-- el front actual les siga mostrando sus menús. La base ya no le da ningún
-- poder a 'ceo': su acceso viene de ser dueños de Alusur. Cuando el front
-- deje de mirar platform_role, se borra (script de limpieza aparte).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0) Datos que esta migración asume
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.admin_organizations
                 where id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120' and name = 'Alusur') then
    raise exception 'No encuentro la organización Alusur (fbb7b1e2-…): no sigo';
  end if;
  if not exists (select 1 from auth.users where lower(email) = 'sebastian.pradomelesi@gmail.com') then
    raise exception 'No existe un usuario con el mail sebastian.pradomelesi@gmail.com: no sigo';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) Organización: áreas habilitadas
-- ---------------------------------------------------------------------
alter table public.admin_organizations
  add column areas text[] not null default '{administracion}'
  constraint admin_organizations_areas_check
    check (cardinality(areas) > 0 and areas <@ array['construccion', 'administracion']);

update public.admin_organizations
   set areas = '{construccion,administracion}'
 where id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120';

-- ---------------------------------------------------------------------
-- 2) Obras y empresas pertenecen a una organización (hoy todo es de Alusur)
-- ---------------------------------------------------------------------
alter table public.obras add column organization_id uuid references public.admin_organizations;
update public.obras set organization_id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120';
alter table public.obras alter column organization_id set not null;
create index on public.obras (organization_id);

alter table public.empresas add column organization_id uuid references public.admin_organizations;
update public.empresas set organization_id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120';
alter table public.empresas alter column organization_id set not null;

-- el nombre deja de ser único en todo el sistema: pasa a ser único por organización
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.empresas'::regclass and c.contype = 'u'
      and c.conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.empresas'::regclass and attname = 'nombre')]
  loop
    execute format('alter table public.empresas drop constraint %I', r.conname);
  end loop;
  for r in
    select i.indexrelid::regclass::text as idx from pg_index i
    where i.indrelid = 'public.empresas'::regclass and i.indisunique and not i.indisprimary
      and i.indkey::text = (select attnum::text from pg_attribute
                            where attrelid = 'public.empresas'::regclass and attname = 'nombre')
  loop
    execute format('drop index %s', r.idx);
  end loop;
end $$;
alter table public.empresas add constraint empresas_org_nombre_key unique (organization_id, nombre);

-- ---------------------------------------------------------------------
-- 3) Funciones base de acceso
-- ---------------------------------------------------------------------
create or replace function public.is_plataforma()
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and platform_role::text = 'plataforma');
$$;

-- organizaciones donde soy dueño (plataforma: todas)
create or replace function public.mis_orgs_dueno()
returns setof uuid language sql stable security definer set search_path to '' as $$
  select o.id from public.admin_organizations o where public.is_plataforma()
  union
  select m.organization_id from public.admin_members m
  where m.user_id = auth.uid() and m.active and m.role = 'dueno';
$$;

-- organizaciones donde tengo cualquier rol (plataforma: todas)
create or replace function public.mis_orgs()
returns setof uuid language sql stable security definer set search_path to '' as $$
  select o.id from public.admin_organizations o where public.is_plataforma()
  union
  select m.organization_id from public.admin_members m
  where m.user_id = auth.uid() and m.active;
$$;

create or replace function public.mis_obras_dueno()
returns setof uuid language sql stable security definer set search_path to '' as $$
  select o.id from public.obras o
  where o.organization_id in (select public.mis_orgs_dueno());
$$;

create or replace function public.es_dueno_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.obras o
                 where o.id = p_obra and o.organization_id in (select public.mis_orgs_dueno()));
$$;

-- Compatibilidad con el front actual (que pueda seguir preguntando "¿es CEO?"):
-- ahora significa "plataforma, o dueño de alguna organización". La base ya no la usa.
create or replace function public.is_ceo()
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_plataforma()
      or exists (select 1 from public.admin_members m
                 where m.user_id = auth.uid() and m.active and m.role = 'dueno');
$$;

create or replace function public.my_obra_ids()
returns setof uuid language sql stable security definer set search_path to '' as $$
  select public.mis_obras_dueno()
  union
  select m.obra_id from public.obra_members m where m.user_id = auth.uid() and m.active;
$$;

create or replace function public.obras_with_perm(p_perm text)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select public.mis_obras_dueno()
  union
  select m.obra_id
  from public.obra_members m
  join public.role_permissions rp on rp.role = m.role
  where m.user_id = auth.uid() and m.active and rp.permission = p_perm;
$$;

-- Administración: plataforma pasa siempre
create or replace function public.admin_has_role(
  p_organization_id uuid,
  p_roles text[] default array['dueno'::text, 'admin'::text, 'vendedor'::text])
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_plataforma() or exists (
    select 1 from public.admin_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role = any (p_roles)
  );
$$;

create or replace function public.admin_can_manage_members(p_organization_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select public.is_plataforma() or exists (
    select 1 from public.admin_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role = 'dueno'
  );
$$;

create or replace function public.protect_platform_role()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  -- auth.uid() null = acceso directo a la BD (SQL Editor, migraciones): permitido.
  -- Por la API, solo plataforma puede tocarlo.
  if new.platform_role is distinct from old.platform_role
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_plataforma() then
    raise exception 'Solo la plataforma puede cambiar platform_role' using errcode = '42501';
  end if;
  if new.is_worker is distinct from old.is_worker
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_worker solo puede cambiarse desde el servidor' using errcode = '42501';
  end if;
  return new;
end $function$;

-- ---------------------------------------------------------------------
-- 4) Crear obra: dentro de una organización con Construcción
--    El front actual (p_nombre, p_ubicacion) sigue funcionando: si sos
--    dueño de una sola organización con Construcción, se usa esa.
-- ---------------------------------------------------------------------
drop function public.create_obra(text, text);

create function public.create_obra(
  p_nombre text, p_ubicacion text default null, p_organizacion uuid default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_org uuid := p_organizacion;
  v_n   int;
  v_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if v_org is null then
    select count(*), min(o.id::text)::uuid into v_n, v_org
    from public.admin_organizations o
    where o.id in (select public.mis_orgs_dueno()) and 'construccion' = any (o.areas);
    if v_n = 0 then
      raise exception 'Solo el dueño de una organización con Construcción puede crear obras' using errcode = '42501';
    elsif v_n > 1 then
      raise exception 'Indicá en qué organización va la obra (p_organizacion)';
    end if;
  end if;

  if v_org not in (select public.mis_orgs_dueno()) then
    raise exception 'Solo el dueño de la organización puede crear obras' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admin_organizations
                 where id = v_org and 'construccion' = any (areas)) then
    raise exception 'Esa organización no tiene habilitada el área Construcción';
  end if;

  insert into public.obras (nombre, ubicacion, created_by, organization_id)
  values (p_nombre, p_ubicacion, auth.uid(), v_org)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.create_obra(text, text, uuid) from public, anon;
grant execute on function public.create_obra(text, text, uuid) to authenticated, service_role;

-- empresas: si el front no manda la organización, va a la única donde soy dueño
create or replace function public.tg_empresas_org()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_n int; v_org uuid;
begin
  if new.organization_id is null then
    select count(*), min(x::text)::uuid into v_n, v_org from public.mis_orgs_dueno() x;
    if v_n <> 1 then
      raise exception 'Indicá a qué organización pertenece la empresa (organization_id)';
    end if;
    new.organization_id := v_org;
  end if;
  return new;
end $$;
create trigger empresas_org before insert on public.empresas
  for each row execute function public.tg_empresas_org();

create or replace function public.add_empresa_to_obra(p_obra uuid, p_empresa uuid, p_tipo public.empresa_tipo)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.es_dueno_obra(p_obra) then
    raise exception 'Solo el dueño de la organización puede vincular empresas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.empresas e join public.obras o on o.organization_id = e.organization_id
                 where e.id = p_empresa and o.id = p_obra) then
    raise exception 'La empresa no pertenece a la organización de esta obra' using errcode = '42501';
  end if;
  insert into public.obra_empresas (obra_id, empresa_id, tipo)
  values (p_obra, p_empresa, p_tipo)
  on conflict (obra_id, empresa_id) do update set tipo = excluded.tipo;
end $function$;

-- ---------------------------------------------------------------------
-- 5) Funciones que hoy preguntan "¿es CEO?" → "¿es dueño de esta obra?"
--    (copiadas de producción; solo cambia ese chequeo)
-- ---------------------------------------------------------------------
-- actualizar_contenedor: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.actualizar_contenedor(p_contenedor uuid, p_bl text, p_precinto text, p_planta uuid, p_llegada date, p_codigo_iso text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_obra   uuid;
  v_estado text;
begin
  select obra_id, estado::text into v_obra, v_estado
  from contenedores where id = p_contenedor;

  if v_obra is null then
    raise exception 'El contenedor no existe';
  end if;

  if not (public.es_dueno_obra(v_obra) or v_obra in (select obras_with_perm('contenedor.import'))) then
    raise exception 'Sin permiso para editar este contenedor' using errcode = '42501';
  end if;

  update contenedores set
    bl                = nullif(trim(p_bl), ''),
    precinto_esperado = nullif(trim(p_precinto), ''),
    planta_id         = p_planta,
    llegada_estimada  = p_llegada,
    codigo_iso        = coalesce(nullif(upper(trim(p_codigo_iso)), ''), codigo_iso)
  where id = p_contenedor;

  insert into status_events (obra_id, contenedor_id, from_state, to_state, nota, user_id)
  values (v_obra, p_contenedor, v_estado, v_estado, 'Datos del contenedor actualizados', auth.uid());
end;
$function$
;

-- contenedor_eliminar: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.contenedor_eliminar(p_contenedor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if not public.es_dueno_obra(c.obra_id) then
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
end $function$
;

-- listar_trabajadores: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.listar_trabajadores(p_obra uuid)
 RETURNS TABLE(user_id uuid, full_name text, phone text, empresa_id uuid, empresa text, worker_code text, pin text, bloqueado_hasta timestamp with time zone, equipo_id uuid, equipo text, habilitaciones text[], activo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_gestion boolean;
  v_ver boolean;
begin
  v_gestion := public.es_dueno_obra(p_obra)
    or p_obra in (select obras_with_perm('members.manage'));
  v_ver := v_gestion
    or p_obra in (select obras_with_perm('equipo.manage'));
  if not v_ver then
    raise exception 'Sin permiso para ver el personal de esta obra'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    case when v_gestion then p.phone end,
    m.empresa_id,
    e.nombre,
    case when v_gestion then wc.worker_code end,
    case when v_gestion then wc.pin_display end,
    case when v_gestion and wc.locked_until > now() then wc.locked_until end,
    em.equipo_id,
    eq.nombre,
    coalesce((
      select array_agg(mt.nombre order by mt.nombre)
      from habilitaciones h
      join maquina_tipos mt on mt.id = h.maquina_tipo_id
      where h.user_id = p.id
        and (h.valid_until is null or h.valid_until >= current_date)
    ), '{}'),
    m.active
  from obra_members m
  join profiles p on p.id = m.user_id
  left join empresas e on e.id = m.empresa_id
  left join worker_credentials wc on wc.user_id = p.id
  left join equipo_members em
    on em.obra_id = m.obra_id
    and em.user_id = m.user_id
    and em.left_at is null
  left join equipos eq on eq.id = em.equipo_id
  where m.obra_id = p_obra and m.role = 'obrero'
  order by m.active desc, p.full_name;
end;
$function$
;

-- listar_usuarios: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.listar_usuarios(p_obra uuid)
 RETURNS TABLE(user_id uuid, full_name text, email text, empresa_id uuid, empresa text, role obra_role, temp_password text, activo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if not (public.es_dueno_obra(p_obra) or p_obra in (select obras_with_perm('members.manage'))) then
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
$function$
;

-- reactivar_trabajador: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.reactivar_trabajador(p_obra uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.obra_role;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if not public.es_dueno_obra(p_obra) then
    raise exception 'Solo el dueño de la organización puede reactivar trabajadores' using errcode = '42501';
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
$function$
;

-- remove_member: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.remove_member(p_obra uuid, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caller_role public.obra_role;
  v_target_role public.obra_role;
begin
  if not public.es_dueno_obra(p_obra) then
    perform public.require_perm(p_obra, 'members.manage');
    if p_user = auth.uid() then
      raise exception 'No puedes eliminarte a ti mismo' using errcode = '42501';
    end if;
    select role into v_caller_role from public.obra_members where obra_id = p_obra and user_id = auth.uid();
    select role into v_target_role from public.obra_members where obra_id = p_obra and user_id = p_user;
    if v_target_role = 'owner' or public.role_rank(v_target_role) >= public.role_rank(v_caller_role) then
      raise exception 'No puedes eliminar a un usuario de rango igual o superior' using errcode = '42501';
    end if;
  end if;
  -- baja lógica: se conserva quién fue miembro (sus fotos y eventos siguen firmados)
  update public.equipo_members set left_at = now()
  where obra_id = p_obra and user_id = p_user and left_at is null;
  update public.obra_members set active = false
  where obra_id = p_obra and user_id = p_user;
end $function$
;

-- has_perm: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.has_perm(p_obra uuid, p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.es_dueno_obra(p_obra) or exists (
    select 1
    from public.obra_members m
    join public.role_permissions rp on rp.role = m.role
    where m.obra_id = p_obra and m.user_id = auth.uid() and m.active and rp.permission = p_perm
  );
$function$
;

-- assign_role: igual que hoy, cambiando el chequeo de CEO por dueño de la obra
CREATE OR REPLACE FUNCTION public.assign_role(p_obra uuid, p_user uuid, p_empresa uuid, p_role obra_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caller_role public.obra_role;
  v_target_role public.obra_role;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  -- la empresa tiene que ser del directorio de la organización dueña de la obra
  if not exists (select 1 from public.empresas e join public.obras o on o.organization_id = e.organization_id
                 where e.id = p_empresa and o.id = p_obra) then
    raise exception 'La empresa no pertenece a la organización de esta obra' using errcode = '42501';
  end if;

  if not public.es_dueno_obra(p_obra) then
    perform public.require_perm(p_obra, 'members.manage');

    if p_user = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
    end if;
    if p_role = 'owner' then
      raise exception 'Solo el dueño de la organización puede asignar el rol owner' using errcode = '42501';
    end if;

    select role into v_caller_role from public.obra_members
    where obra_id = p_obra and user_id = auth.uid() and active;

    if public.role_rank(p_role) >= public.role_rank(v_caller_role) then
      raise exception 'No puedes asignar un rol igual o superior al tuyo' using errcode = '42501';
    end if;

    select role into v_target_role from public.obra_members
    where obra_id = p_obra and user_id = p_user;

    if v_target_role is not null
       and (v_target_role = 'owner'
            or public.role_rank(v_target_role) >= public.role_rank(v_caller_role)) then
      raise exception 'No puedes modificar a un usuario de rango igual o superior' using errcode = '42501';
    end if;
  end if;

  insert into public.obra_members (obra_id, user_id, empresa_id, role, added_by)
  values (p_obra, p_user, p_empresa, p_role, auth.uid())
  on conflict (obra_id, user_id)
  do update set role = excluded.role, empresa_id = excluded.empresa_id, active = true;
end $function$
;

-- ---------------------------------------------------------------------
-- 6) Políticas que dependían de "CEO"
-- ---------------------------------------------------------------------
drop policy "ceo manage empresas" on public.empresas;
drop policy "read empresas" on public.empresas;
create policy "read empresas" on public.empresas for select to authenticated
  using (organization_id in (select public.mis_orgs())
         or id in (select oe.empresa_id from public.obra_empresas oe
                   where oe.obra_id in (select public.my_obra_ids())));
create policy "dueno manage empresas" on public.empresas for all to authenticated
  using (organization_id in (select public.mis_orgs_dueno()))
  with check (organization_id in (select public.mis_orgs_dueno()));

drop policy "ceo update obras" on public.obras;
create policy "dueno update obras" on public.obras for update to authenticated
  using (organization_id in (select public.mis_orgs_dueno()))
  with check (organization_id in (select public.mis_orgs_dueno()));

drop policy "ceo manage plantas" on public.plantas;
drop policy "read plantas" on public.plantas;
create policy "read plantas" on public.plantas for select to authenticated
  using (empresa_id in (select e.id from public.empresas e));          -- las que veo por RLS de empresas
create policy "dueno manage plantas" on public.plantas for all to authenticated
  using (empresa_id in (select e.id from public.empresas e
                        where e.organization_id in (select public.mis_orgs_dueno())))
  with check (empresa_id in (select e.id from public.empresas e
                             where e.organization_id in (select public.mis_orgs_dueno())));

drop policy "ceo manage maquina_tipos" on public.maquina_tipos;
create policy "plataforma manage maquina_tipos" on public.maquina_tipos for all to authenticated
  using ((select public.is_plataforma())) with check ((select public.is_plataforma()));

drop policy "ceo manage posiciones" on public.posiciones;
create policy "dueno manage posiciones" on public.posiciones for all to authenticated
  using (obra_id in (select public.mis_obras_dueno()))
  with check (obra_id in (select public.mis_obras_dueno()));

drop policy "ceo manage tipos_modulo" on public.tipos_modulo;
create policy "dueno manage tipos_modulo" on public.tipos_modulo for all to authenticated
  using (obra_id in (select public.mis_obras_dueno()))
  with check (obra_id in (select public.mis_obras_dueno()));

drop policy "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or (select public.is_plataforma())
         or id in (select m.user_id from public.obra_members m
                   where m.obra_id in (select public.my_obra_ids()))
         or id in (select am.user_id from public.admin_members am
                   where am.organization_id in (select public.mis_orgs())));

-- ---------------------------------------------------------------------
-- 7) Vistas: TODAS respetan los permisos de quien consulta.
--    Sin esto, una vista creada por postgres saltea RLS y muestra filas de
--    todas las obras y organizaciones (hoy pasa con v_mis_obras, v_modulos,
--    v_obra_resumen y las admin_*: el front filtra, pero la base no).
-- ---------------------------------------------------------------------
create or replace view public.v_mis_obras with (security_invoker = true) as
select o.id,
       o.nombre,
       o.ubicacion,
       case when public.es_dueno_obra(o.id) then 'ceo'::text   -- 'ceo' = control total en ESTA obra (compatibilidad front)
            else m.role::text end as mi_rol,
       (select count(*) from public.modulos x where x.obra_id = o.id) as modulos_total,
       (select count(*) from public.modulos x
         where x.obra_id = o.id
           and x.estado = any (array['instalado'::public.modulo_estado, 'terminado'::public.modulo_estado])) as modulos_instalados,
       (select count(*) from public.incidencias i
         where i.obra_id = o.id and i.estado <> 'cerrada'::public.incidencia_estado) as incidencias_abiertas,
       o.organization_id
from public.obras o
left join public.obra_members m on m.obra_id = o.id and m.user_id = (select auth.uid()) and m.active
where o.activa;

do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = true)', r.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8) Personas: dueños de Alusur y plataforma
--    Orden pensado para que nadie quede sin acceso: primero dueños, después plataforma.
-- ---------------------------------------------------------------------
insert into public.admin_members (organization_id, user_id, role, display_name, active)
values
  ('fbb7b1e2-5d4d-48a5-9256-62ad620e0120', 'a7c2d371-2dab-444a-8cab-eac52dc5563d', 'dueno', 'Ricardo Prado', true),
  ('fbb7b1e2-5d4d-48a5-9256-62ad620e0120', 'c5be3e8c-8de9-4e46-bee6-cdf777d1e8b0', 'dueno', 'Juan Prado', true)
on conflict (organization_id, user_id) do update set role = 'dueno', active = true;

update public.profiles
   set platform_role = 'plataforma'
 where id = (select id from auth.users where lower(email) = 'sebastian.pradomelesi@gmail.com');

insert into supabase_migrations.schema_migrations (version, name)
values ('20261029100100', 'organizaciones')
on conflict (version) do nothing;

commit;

-- ---------------------------------------------------------------------
-- Verificación (no cambia nada). Tiene que mostrar:
--   obras de Alusur = 6 · empresas de Alusur = 3 · dueños de Alusur = 2
--   plataforma = Sebastián · vistas sin security_invoker = 0
-- ---------------------------------------------------------------------
select
  (select count(*) from public.obras where organization_id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120') as obras_alusur,
  (select count(*) from public.empresas where organization_id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120') as empresas_alusur,
  (select string_agg(display_name, ', ') from public.admin_members
    where organization_id = 'fbb7b1e2-5d4d-48a5-9256-62ad620e0120' and role = 'dueno' and active) as duenos_alusur,
  (select string_agg(full_name, ', ') from public.profiles where platform_role::text = 'plataforma') as plataforma,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)) as vistas_sin_invoker;
