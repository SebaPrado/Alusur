-- =====================================================================
-- ALUSUR / Cipriani — Migración inicial
-- Usuarios, roles por obra, logística (contenedores/módulos),
-- incidencias, fotos, máquinas, auditoría y RLS.
--
-- Principios:
--   * El rol vive en la relación usuario↔obra (obra_members), no en el usuario.
--   * CEO es un rol de PLATAFORMA (profiles.platform_role) y ve/hace todo.
--   * Lectura: cualquier miembro de la obra (incluido 'owner').
--   * Escritura: casi siempre vía RPC (security definer) que valida
--     permiso + transición legal + deja evento de auditoría.
--   * status_events es append-only (trigger bloquea UPDATE/DELETE).
--   * Todas las fechas son timestamptz.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.platform_role       as enum ('ceo');
create type public.obra_role           as enum ('superadmin', 'admin', 'obrero', 'owner');
create type public.empresa_tipo        as enum ('socia', 'contratada');
create type public.contenedor_estado   as enum ('en_produccion', 'en_camino', 'en_puerto', 'en_deposito', 'en_obra', 'descargado');
create type public.modulo_estado       as enum ('en_contenedor', 'descargado', 'instalado', 'terminado');
create type public.modulo_tipo         as enum ('ventana', 'panel');
create type public.incidencia_estado   as enum ('abierta', 'en_revision', 'cerrada');
create type public.incidencia_severidad as enum ('leve', 'media', 'grave');
create type public.maquina_estado      as enum ('operativa', 'en_uso', 'averiada', 'mantenimiento');

-- ---------------------------------------------------------------------
-- 2. IDENTIDAD Y ORGANIZACIONES
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  phone          text,
  platform_role  public.platform_role,          -- null = usuario normal; 'ceo' = plataforma
  is_worker      boolean not null default false, -- true = login por PIN (sin email real)
  created_at     timestamptz not null default now()
);

create table public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  pais       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. OBRA Y PARTICIPACIÓN
-- ---------------------------------------------------------------------
create table public.obras (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  ubicacion  text,
  activa     boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.obra_empresas (
  obra_id    uuid not null references public.obras (id),
  empresa_id uuid not null references public.empresas (id),
  tipo       public.empresa_tipo not null,
  primary key (obra_id, empresa_id)
);

create table public.obra_members (
  obra_id    uuid not null references public.obras (id),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  empresa_id uuid not null,
  role       public.obra_role not null,
  active     boolean not null default true,      -- baja = false (se conserva el historial)
  added_by   uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (obra_id, user_id),
  -- la empresa del miembro tiene que participar en esa obra
  foreign key (obra_id, empresa_id) references public.obra_empresas (obra_id, empresa_id)
);
create index obra_members_user_idx on public.obra_members (user_id, obra_id) where active;

-- ---------------------------------------------------------------------
-- 4. PERMISOS (datos, no código)
-- ---------------------------------------------------------------------
create table public.role_permissions (
  role       public.obra_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  -- OBRERO: fotos, avances, incidencias
  ('obrero', 'foto.create'),
  ('obrero', 'foto.correct_own'),
  ('obrero', 'incidencia.create'),
  ('obrero', 'modulo.avanzar'),
  ('obrero', 'maquina.update_status'),        -- además necesita habilitación

  -- ADMIN: opera la obra y revisa incidencias. NO crea usuarios.
  ('admin', 'foto.create'),
  ('admin', 'foto.correct_own'),
  ('admin', 'foto.correct_any'),
  ('admin', 'incidencia.create'),
  ('admin', 'incidencia.revisar'),
  ('admin', 'modulo.avanzar'),
  ('admin', 'modulo.corregir'),
  ('admin', 'maquina.update_status'),
  ('admin', 'maquina.sin_habilitacion'),      -- puede actualizar cualquier máquina
  ('admin', 'equipo.manage'),

  -- SUPERADMIN: todo lo anterior + usuarios, logística y cierre
  ('superadmin', 'foto.create'),
  ('superadmin', 'foto.correct_own'),
  ('superadmin', 'foto.correct_any'),
  ('superadmin', 'incidencia.create'),
  ('superadmin', 'incidencia.revisar'),
  ('superadmin', 'incidencia.cerrar'),
  ('superadmin', 'modulo.avanzar'),
  ('superadmin', 'modulo.corregir'),
  ('superadmin', 'contenedor.transicion'),
  ('superadmin', 'contenedor.import'),
  ('superadmin', 'maquina.update_status'),
  ('superadmin', 'maquina.sin_habilitacion'),
  ('superadmin', 'maquina.manage'),
  ('superadmin', 'equipo.manage'),
  ('superadmin', 'habilitacion.manage'),
  ('superadmin', 'members.manage');

  -- OWNER: ninguna fila → solo lectura, garantizado por RLS.

-- ---------------------------------------------------------------------
-- 5. EQUIPOS
-- ---------------------------------------------------------------------
create table public.equipos (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references public.obras (id),
  nombre     text not null,
  created_at timestamptz not null default now(),
  unique (obra_id, nombre),
  unique (id, obra_id)
);

create table public.equipo_members (
  equipo_id uuid not null,
  obra_id   uuid not null,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,                         -- null = activo
  primary key (equipo_id, user_id, joined_at),
  foreign key (equipo_id, obra_id) references public.equipos (id, obra_id),
  foreign key (obra_id, user_id)   references public.obra_members (obra_id, user_id),
  check (left_at is null or left_at > joined_at)
);
-- un usuario no puede estar dos veces activo en el mismo equipo
create unique index equipo_members_activo_uq on public.equipo_members (equipo_id, user_id) where left_at is null;

-- ---------------------------------------------------------------------
-- 6. MÁQUINAS Y HABILITACIONES
-- ---------------------------------------------------------------------
create table public.maquina_tipos (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique                    -- 'spider', 'telescópica', ...
);

create table public.maquinas (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id),
  maquina_tipo_id uuid not null references public.maquina_tipos (id),
  codigo          text not null,
  estado          public.maquina_estado not null default 'operativa',
  created_at      timestamptz not null default now(),
  unique (obra_id, codigo),
  unique (id, obra_id)
);

-- la habilitación es de la PERSONA (no de la obra): si Pepe sabe manejar
-- la spider, sabe en cualquier obra.
create table public.habilitaciones (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  maquina_tipo_id uuid not null references public.maquina_tipos (id),
  valid_until     date,                          -- null = sin caducidad
  granted_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  primary key (user_id, maquina_tipo_id)
);

-- ---------------------------------------------------------------------
-- 7. LOGÍSTICA: CONTENEDORES Y MÓDULOS
-- ---------------------------------------------------------------------
create table public.contenedores (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras (id),
  codigo      text not null,                     -- interno: 'C-0142'
  codigo_iso  text,                              -- ISO 6346 pintado en el contenedor: 'MSCU1234567'
  estado      public.contenedor_estado not null default 'en_produccion',
  created_at  timestamptz not null default now(),
  unique (obra_id, codigo),
  unique (id, obra_id)
);

create table public.modulos (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null,                   -- denormalizado para RLS rápida
  contenedor_id uuid not null,
  posicion      int  not null check (posicion between 1 and 99),
  codigo        text not null,                   -- 'C-0142-07-K' (K = dígito de control)
  tipo          public.modulo_tipo not null,
  referencia    text,                            -- referencia de ALUMAN (plano)
  estado        public.modulo_estado not null default 'en_contenedor',
  created_at    timestamptz not null default now(),
  unique (obra_id, codigo),
  unique (contenedor_id, posicion),
  unique (id, obra_id),
  -- FK compuesta: garantiza que el módulo y su contenedor son de la misma obra
  foreign key (contenedor_id, obra_id) references public.contenedores (id, obra_id)
);
create index modulos_contenedor_idx on public.modulos (contenedor_id);

-- ---------------------------------------------------------------------
-- 8. INCIDENCIAS
-- ---------------------------------------------------------------------
create table public.incidencias (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id),
  contenedor_id uuid,
  modulo_id     uuid,
  maquina_id    uuid,
  tipo          text not null default 'daño',    -- 'daño' | 'faltante' | 'otro'
  severidad     public.incidencia_severidad not null default 'media',
  descripcion   text,
  estado        public.incidencia_estado not null default 'abierta',
  reported_by   uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (id, obra_id),
  foreign key (contenedor_id, obra_id) references public.contenedores (id, obra_id),
  foreign key (modulo_id, obra_id)     references public.modulos (id, obra_id),
  foreign key (maquina_id, obra_id)    references public.maquinas (id, obra_id)
);
create index incidencias_obra_estado_idx on public.incidencias (obra_id, estado);
create index incidencias_modulo_idx      on public.incidencias (modulo_id) where modulo_id is not null;
create index incidencias_contenedor_idx  on public.incidencias (contenedor_id) where contenedor_id is not null;

-- ---------------------------------------------------------------------
-- 9. EVENTOS DE ESTADO (append-only, auditoría)
-- ---------------------------------------------------------------------
create table public.status_events (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id),
  contenedor_id uuid,
  modulo_id     uuid,
  incidencia_id uuid,
  maquina_id    uuid,
  from_state    text,
  to_state      text not null,
  nota          text,
  user_id       uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (id, obra_id),
  foreign key (contenedor_id, obra_id) references public.contenedores (id, obra_id),
  foreign key (modulo_id, obra_id)     references public.modulos (id, obra_id),
  foreign key (incidencia_id, obra_id) references public.incidencias (id, obra_id),
  foreign key (maquina_id, obra_id)    references public.maquinas (id, obra_id),
  check (num_nonnulls(contenedor_id, modulo_id, incidencia_id, maquina_id) = 1)
);
create index status_events_modulo_idx     on public.status_events (modulo_id, created_at) where modulo_id is not null;
create index status_events_contenedor_idx on public.status_events (contenedor_id, created_at) where contenedor_id is not null;
create index status_events_incidencia_idx on public.status_events (incidencia_id, created_at) where incidencia_id is not null;
create index status_events_obra_idx       on public.status_events (obra_id, created_at desc);

create function public.block_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% es append-only: no se permite %', tg_table_name, tg_op;
end $$;

create trigger status_events_append_only
  before update or delete on public.status_events
  for each row execute function public.block_mutation();

-- ---------------------------------------------------------------------
-- 10. FOTOS
-- ---------------------------------------------------------------------
create table public.fotos (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id),
  storage_path    text not null unique,          -- '{obra_id}/{uuid}.jpg' en bucket 'fotos'
  uploaded_by     uuid not null default auth.uid() references public.profiles (id),
  taken_at        timestamptz,                   -- EXIF / dispositivo
  server_at       timestamptz not null default now(),
  contenedor_id   uuid,
  modulo_id       uuid,
  incidencia_id   uuid,
  status_event_id uuid,
  anulada         boolean not null default false,
  anulada_motivo  text,
  anulada_por     uuid references public.profiles (id),
  foreign key (contenedor_id, obra_id)   references public.contenedores (id, obra_id),
  foreign key (modulo_id, obra_id)       references public.modulos (id, obra_id),
  foreign key (incidencia_id, obra_id)   references public.incidencias (id, obra_id),
  foreign key (status_event_id, obra_id) references public.status_events (id, obra_id),
  check (num_nonnulls(contenedor_id, modulo_id, incidencia_id, status_event_id) >= 1),
  check (split_part(storage_path, '/', 1) = obra_id::text),
  check (not anulada or anulada_motivo is not null)
);
create index fotos_modulo_idx     on public.fotos (modulo_id)     where modulo_id is not null;
create index fotos_contenedor_idx on public.fotos (contenedor_id) where contenedor_id is not null;
create index fotos_incidencia_idx on public.fotos (incidencia_id) where incidencia_id is not null;
create index fotos_obra_idx       on public.fotos (obra_id, server_at desc);

-- historial de correcciones de fotos (quién movió/anuló qué y cuándo)
create table public.foto_correcciones (
  id         uuid primary key default gen_random_uuid(),
  foto_id    uuid not null references public.fotos (id),
  antes      jsonb not null,
  despues    jsonb not null,
  motivo     text not null,
  user_id    uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create trigger foto_correcciones_append_only
  before update or delete on public.foto_correcciones
  for each row execute function public.block_mutation();

-- ---------------------------------------------------------------------
-- 11. LOGIN DE OBREROS (PIN) — solo accesible por service_role
-- ---------------------------------------------------------------------
create table public.worker_credentials (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  worker_code     text not null unique,           -- 'W-48213' (va en el QR de enrolamiento)
  pin_hash        text not null,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 12. MÁQUINA DE ESTADOS (datos): qué transición requiere qué permiso
-- ---------------------------------------------------------------------
create table public.transiciones (
  entidad    text not null check (entidad in ('contenedor', 'modulo', 'incidencia')),
  from_state text not null,
  to_state   text not null,
  permission text not null,
  primary key (entidad, from_state, to_state)
);

insert into public.transiciones (entidad, from_state, to_state, permission) values
  -- Contenedor (logística): avance normal
  ('contenedor', 'en_produccion', 'en_camino',   'contenedor.transicion'),
  ('contenedor', 'en_camino',     'en_puerto',   'contenedor.transicion'),
  ('contenedor', 'en_puerto',     'en_deposito', 'contenedor.transicion'),
  ('contenedor', 'en_puerto',     'en_obra',     'contenedor.transicion'),
  ('contenedor', 'en_deposito',   'en_obra',     'contenedor.transicion'),
  ('contenedor', 'en_obra',       'descargado',  'contenedor.transicion'),
  -- Contenedor: corrección (un paso atrás)
  ('contenedor', 'en_camino',     'en_produccion', 'contenedor.transicion'),
  ('contenedor', 'en_puerto',     'en_camino',     'contenedor.transicion'),
  ('contenedor', 'en_deposito',   'en_puerto',     'contenedor.transicion'),
  ('contenedor', 'en_obra',       'en_deposito',   'contenedor.transicion'),
  ('contenedor', 'en_obra',       'en_puerto',     'contenedor.transicion'),
  ('contenedor', 'descargado',    'en_obra',       'contenedor.transicion'),

  -- Módulo: avance (obrero)
  ('modulo', 'en_contenedor', 'descargado', 'modulo.avanzar'),
  ('modulo', 'descargado',    'instalado',  'modulo.avanzar'),
  ('modulo', 'instalado',     'terminado',  'modulo.avanzar'),
  -- Módulo: corrección (admin+)
  ('modulo', 'descargado', 'en_contenedor', 'modulo.corregir'),
  ('modulo', 'instalado',  'descargado',    'modulo.corregir'),
  ('modulo', 'terminado',  'instalado',     'modulo.corregir'),

  -- Incidencia: doble validación
  ('incidencia', 'abierta',     'en_revision', 'incidencia.revisar'),  -- admin propone cierre
  ('incidencia', 'en_revision', 'abierta',     'incidencia.revisar'),  -- admin la devuelve
  ('incidencia', 'en_revision', 'cerrada',     'incidencia.cerrar'),   -- superadmin cierra
  ('incidencia', 'cerrada',     'abierta',     'incidencia.cerrar');   -- superadmin reabre

-- =====================================================================
-- 13. FUNCIONES DE AUTORIZACIÓN
-- =====================================================================

create function public.is_ceo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'ceo'
  );
$$;

-- Obras visibles para el usuario actual (todas si es CEO).
-- Se usa en RLS como `obra_id in (select public.my_obra_ids())`:
-- la subconsulta no depende de la fila → Postgres la ejecuta UNA vez por query.
create function public.my_obra_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.obras o where public.is_ceo()
  union
  select m.obra_id from public.obra_members m where m.user_id = auth.uid() and m.active;
$$;

-- Obras donde el usuario actual tiene un permiso concreto.
create function public.obras_with_perm(p_perm text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.obras o where public.is_ceo()
  union
  select m.obra_id
  from public.obra_members m
  join public.role_permissions rp on rp.role = m.role
  where m.user_id = auth.uid() and m.active and rp.permission = p_perm;
$$;

-- Versión escalar, para usar dentro de RPCs.
create function public.has_perm(p_obra uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_ceo() or exists (
    select 1
    from public.obra_members m
    join public.role_permissions rp on rp.role = m.role
    where m.obra_id = p_obra and m.user_id = auth.uid() and m.active and rp.permission = p_perm
  );
$$;

create function public.require_perm(p_obra uuid, p_perm text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if not public.has_perm(p_obra, p_perm) then
    raise exception 'Permiso denegado: %', p_perm using errcode = '42501';
  end if;
end $$;

create function public.role_rank(p_role public.obra_role)
returns int language sql immutable set search_path = '' as $$
  select case p_role
    when 'superadmin' then 50
    when 'admin'      then 40
    when 'obrero'     then 10
    when 'owner'      then 0
  end;
$$;

-- =====================================================================
-- 14. TRIGGER: profile automático al crear usuario en auth
-- =====================================================================
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, is_worker)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    -- app_metadata solo lo puede escribir el servidor (user_metadata lo controla el usuario)
    coalesce((new.raw_app_meta_data ->> 'is_worker')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie puede auto-asignarse platform_role desde el cliente.
create function public.protect_platform_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() null = acceso directo a la BD (SQL Editor, migraciones): permitido.
  -- Por la API siempre hay un usuario, y ahí solo un CEO puede tocarlo.
  if new.platform_role is distinct from old.platform_role
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_ceo() then
    raise exception 'Solo un CEO puede cambiar platform_role' using errcode = '42501';
  end if;
  if new.is_worker is distinct from old.is_worker
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_worker solo puede cambiarse desde el servidor' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_protect_platform_role
  before update on public.profiles
  for each row execute function public.protect_platform_role();

-- =====================================================================
-- 15. CÓDIGOS CON DÍGITO DE CONTROL (Luhn mod 36)
-- =====================================================================
create function public.luhn36_check(p_input text)
returns char language plpgsql immutable set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  s       text := upper(regexp_replace(p_input, '[^0-9A-Za-z]', '', 'g'));
  factor  int  := 2;
  total   int  := 0;
  code    int;
  addend  int;
  i       int;
begin
  for i in reverse length(s)..1 loop
    code := strpos(alphabet, substr(s, i, 1)) - 1;
    addend := factor * code;
    factor := case when factor = 2 then 1 else 2 end;
    addend := (addend / 36) + (addend % 36);
    total := total + addend;
  end loop;
  return substr(alphabet, ((36 - (total % 36)) % 36) + 1, 1);
end $$;

-- Valida un código completo 'C-0142-07-K'
create function public.codigo_valido(p_codigo text)
returns boolean language sql immutable set search_path = '' as $$
  select upper(right(p_codigo, 1)) =
         public.luhn36_check(left(p_codigo, length(p_codigo) - 2));
$$;

-- =====================================================================
-- 16. RPCs — gestión de obras y miembros
-- =====================================================================

-- Solo CEO: crear obra
create function public.create_obra(p_nombre text, p_ubicacion text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_ceo() then
    raise exception 'Solo un CEO puede crear obras' using errcode = '42501';
  end if;
  insert into public.obras (nombre, ubicacion, created_by)
  values (p_nombre, p_ubicacion, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Solo CEO: vincular empresa a obra
create function public.add_empresa_to_obra(p_obra uuid, p_empresa uuid, p_tipo public.empresa_tipo)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_ceo() then
    raise exception 'Solo un CEO puede vincular empresas' using errcode = '42501';
  end if;
  insert into public.obra_empresas (obra_id, empresa_id, tipo)
  values (p_obra, p_empresa, p_tipo)
  on conflict (obra_id, empresa_id) do update set tipo = excluded.tipo;
end $$;

-- Asignar / cambiar rol con jerarquía:
--   CEO: cualquier rol.
--   Resto: necesita 'members.manage', solo roles de rango INFERIOR al suyo,
--          no puede tocar a un igual o superior, no puede asignar 'owner',
--          no puede cambiarse a sí mismo.
create function public.assign_role(
  p_obra uuid, p_user uuid, p_empresa uuid, p_role public.obra_role
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_caller_role public.obra_role;
  v_target_role public.obra_role;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if not public.is_ceo() then
    perform public.require_perm(p_obra, 'members.manage');

    if p_user = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
    end if;
    if p_role = 'owner' then
      raise exception 'Solo un CEO puede asignar el rol owner' using errcode = '42501';
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
end $$;

create function public.remove_member(p_obra uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_caller_role public.obra_role;
  v_target_role public.obra_role;
begin
  if not public.is_ceo() then
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
end $$;

-- =====================================================================
-- 17. RPCs — logística
-- =====================================================================

-- Importa UN contenedor del packing list de ALUMAN.
-- p_data = {"codigo":"C-0142","codigo_iso":"MSCU1234567",
--           "modulos":[{"tipo":"ventana","referencia":"V-12-03"}, ...]}
-- La posición se asigna por orden; el código del módulo se genera con dígito de control.
create function public.import_contenedor(p_obra uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cont_id uuid;
  v_codigo  text := upper(trim(p_data ->> 'codigo'));
  v_mod     jsonb;
  v_pos     int := 0;
  v_base    text;
begin
  perform public.require_perm(p_obra, 'contenedor.import');

  if v_codigo is null or v_codigo !~ '^C-[0-9]{4}$' then
    raise exception 'Código de contenedor inválido: % (formato C-0000)', v_codigo;
  end if;
  if jsonb_array_length(coalesce(p_data -> 'modulos', '[]'::jsonb)) = 0 then
    raise exception 'El contenedor % no tiene módulos', v_codigo;
  end if;

  insert into public.contenedores (obra_id, codigo, codigo_iso)
  values (p_obra, v_codigo, nullif(upper(trim(p_data ->> 'codigo_iso')), ''))
  returning id into v_cont_id;

  for v_mod in select * from jsonb_array_elements(p_data -> 'modulos') loop
    v_pos  := v_pos + 1;
    v_base := v_codigo || '-' || lpad(v_pos::text, 2, '0');
    insert into public.modulos (obra_id, contenedor_id, posicion, codigo, tipo, referencia)
    values (
      p_obra, v_cont_id, v_pos,
      v_base || '-' || public.luhn36_check(v_base),
      (v_mod ->> 'tipo')::public.modulo_tipo,
      v_mod ->> 'referencia'
    );
  end loop;

  insert into public.status_events (obra_id, contenedor_id, from_state, to_state, nota, user_id)
  values (p_obra, v_cont_id, null, 'en_produccion', 'Importado desde packing list', auth.uid());

  return v_cont_id;
end $$;

-- Valida transición contra la tabla `transiciones` y el permiso que exige.
create function public.check_transition(p_obra uuid, p_entidad text, p_from text, p_to text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.transiciones
    where entidad = p_entidad and from_state = p_from and to_state = p_to
  ) then
    raise exception 'Transición no permitida para %: % → %', p_entidad, p_from, p_to;
  end if;

  select bool_or(public.has_perm(p_obra, t.permission)) into v_ok
  from public.transiciones t
  where t.entidad = p_entidad and t.from_state = p_from and t.to_state = p_to;

  if not v_ok then
    raise exception 'Permiso denegado para %: % → %', p_entidad, p_from, p_to using errcode = '42501';
  end if;
end $$;

create function public.transition_contenedor(
  p_contenedor uuid, p_to public.contenedor_estado, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_c  public.contenedores;
  v_ev uuid;
begin
  select * into v_c from public.contenedores where id = p_contenedor for update;
  if not found then raise exception 'Contenedor no encontrado'; end if;

  perform public.check_transition(v_c.obra_id, 'contenedor', v_c.estado::text, p_to::text);

  -- no se puede "re-cargar" un contenedor si ya hay módulos descargados
  if p_to in ('en_produccion', 'en_camino', 'en_puerto', 'en_deposito')
     and exists (select 1 from public.modulos where contenedor_id = p_contenedor and estado <> 'en_contenedor') then
    raise exception 'El contenedor tiene módulos ya descargados';
  end if;

  update public.contenedores set estado = p_to where id = p_contenedor;

  insert into public.status_events (obra_id, contenedor_id, from_state, to_state, nota, user_id)
  values (v_c.obra_id, p_contenedor, v_c.estado::text, p_to::text, p_nota, auth.uid())
  returning id into v_ev;
  return v_ev;
end $$;

create function public.transition_modulo(
  p_modulo uuid, p_to public.modulo_estado, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_m       public.modulos;
  v_cestado public.contenedor_estado;
  v_ev      uuid;
begin
  select * into v_m from public.modulos where id = p_modulo for update;
  if not found then raise exception 'Módulo no encontrado'; end if;

  perform public.check_transition(v_m.obra_id, 'modulo', v_m.estado::text, p_to::text);

  if v_m.estado = 'en_contenedor' and p_to = 'descargado' then
    select estado into v_cestado from public.contenedores where id = v_m.contenedor_id;
    if v_cestado not in ('en_obra', 'en_deposito', 'descargado') then
      raise exception 'No se puede descargar: el contenedor está en estado %', v_cestado;
    end if;
  end if;

  update public.modulos set estado = p_to where id = p_modulo;

  insert into public.status_events (obra_id, modulo_id, from_state, to_state, nota, user_id)
  values (v_m.obra_id, p_modulo, v_m.estado::text, p_to::text, p_nota, auth.uid())
  returning id into v_ev;
  return v_ev;
end $$;

-- Busca módulo o contenedor por código escaneado (valida dígito de control)
create function public.buscar_codigo(p_obra uuid, p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cod text := upper(trim(p_codigo));
  v_r   jsonb;
begin
  if p_obra not in (select public.my_obra_ids()) then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;

  if v_cod ~ '^C-[0-9]{4}$' then
    select jsonb_build_object('tipo', 'contenedor', 'id', id, 'codigo', codigo, 'estado', estado)
    into v_r from public.contenedores where obra_id = p_obra and codigo = v_cod;
  elsif v_cod ~ '^C-[0-9]{4}-[0-9]{2}-[0-9A-Z]$' then
    if not public.codigo_valido(v_cod) then
      raise exception 'Código mal escrito (dígito de control incorrecto): %', v_cod using errcode = '22023';
    end if;
    select jsonb_build_object('tipo', 'modulo', 'id', id, 'codigo', codigo, 'estado', estado,
                              'contenedor_id', contenedor_id, 'tipo_modulo', tipo)
    into v_r from public.modulos where obra_id = p_obra and codigo = v_cod;
  else
    raise exception 'Formato de código no reconocido: %', v_cod using errcode = '22023';
  end if;

  return v_r;  -- null si no existe
end $$;

-- =====================================================================
-- 18. RPCs — incidencias
-- =====================================================================
create function public.create_incidencia(
  p_obra uuid,
  p_contenedor uuid default null,
  p_modulo uuid default null,
  p_maquina uuid default null,
  p_tipo text default 'daño',
  p_severidad public.incidencia_severidad default 'media',
  p_descripcion text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_perm(p_obra, 'incidencia.create');
  if p_tipo not in ('daño', 'faltante', 'otro') then
    raise exception 'Tipo de incidencia inválido: %', p_tipo;
  end if;

  insert into public.incidencias (obra_id, contenedor_id, modulo_id, maquina_id, tipo, severidad, descripcion, reported_by)
  values (p_obra, p_contenedor, p_modulo, p_maquina, p_tipo, p_severidad, p_descripcion, auth.uid())
  returning id into v_id;

  insert into public.status_events (obra_id, incidencia_id, from_state, to_state, nota, user_id)
  values (p_obra, v_id, null, 'abierta', p_descripcion, auth.uid());
  return v_id;
end $$;

create function public.transition_incidencia(
  p_incidencia uuid, p_to public.incidencia_estado, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_i  public.incidencias;
  v_ev uuid;
begin
  select * into v_i from public.incidencias where id = p_incidencia for update;
  if not found then raise exception 'Incidencia no encontrada'; end if;

  perform public.check_transition(v_i.obra_id, 'incidencia', v_i.estado::text, p_to::text);

  if p_to = 'cerrada' and coalesce(trim(p_nota), '') = '' then
    raise exception 'Cerrar una incidencia requiere una nota de resolución';
  end if;

  update public.incidencias set estado = p_to where id = p_incidencia;

  insert into public.status_events (obra_id, incidencia_id, from_state, to_state, nota, user_id)
  values (v_i.obra_id, p_incidencia, v_i.estado::text, p_to::text, p_nota, auth.uid())
  returning id into v_ev;
  return v_ev;
end $$;

-- =====================================================================
-- 19. RPCs — fotos (corrección) y máquinas
-- =====================================================================

-- Corregir una foto: reasignar destino y/o anular. Nunca se borra.
--   foto.correct_own: solo las propias, dentro de 48 h y si la incidencia
--                     asociada no está cerrada.
--   foto.correct_any: cualquiera, sin límite de tiempo.
create function public.corregir_foto(
  p_foto uuid,
  p_motivo text,
  p_anular boolean default false,
  p_contenedor uuid default null,
  p_modulo uuid default null,
  p_incidencia uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_f      public.fotos;
  v_antes  jsonb;
  v_any    boolean;
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'La corrección requiere un motivo';
  end if;

  select * into v_f from public.fotos where id = p_foto for update;
  if not found then raise exception 'Foto no encontrada'; end if;

  v_any := public.has_perm(v_f.obra_id, 'foto.correct_any');
  if not v_any then
    perform public.require_perm(v_f.obra_id, 'foto.correct_own');
    if v_f.uploaded_by <> auth.uid() then
      raise exception 'Solo puedes corregir tus propias fotos' using errcode = '42501';
    end if;
    if v_f.server_at < now() - interval '48 hours' then
      raise exception 'Plazo de corrección (48 h) vencido; pide a un admin' using errcode = '42501';
    end if;
    if v_f.incidencia_id is not null and exists (
      select 1 from public.incidencias where id = v_f.incidencia_id and estado = 'cerrada'
    ) then
      raise exception 'La incidencia asociada está cerrada' using errcode = '42501';
    end if;
  end if;

  v_antes := jsonb_build_object(
    'contenedor_id', v_f.contenedor_id, 'modulo_id', v_f.modulo_id,
    'incidencia_id', v_f.incidencia_id, 'anulada', v_f.anulada);

  if p_anular then
    update public.fotos
    set anulada = true, anulada_motivo = p_motivo, anulada_por = auth.uid()
    where id = p_foto;
  else
    update public.fotos
    set contenedor_id = p_contenedor, modulo_id = p_modulo, incidencia_id = p_incidencia
    where id = p_foto;
  end if;

  insert into public.foto_correcciones (foto_id, antes, despues, motivo, user_id)
  select p_foto, v_antes,
         jsonb_build_object('contenedor_id', f.contenedor_id, 'modulo_id', f.modulo_id,
                            'incidencia_id', f.incidencia_id, 'anulada', f.anulada),
         p_motivo, auth.uid()
  from public.fotos f where f.id = p_foto;
end $$;

-- Estado de máquina: requiere permiso Y habilitación vigente para ese tipo
-- (salvo roles con 'maquina.sin_habilitacion').
create function public.update_maquina_estado(
  p_maquina uuid, p_estado public.maquina_estado, p_nota text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.maquinas;
begin
  select * into v_m from public.maquinas where id = p_maquina for update;
  if not found then raise exception 'Máquina no encontrada'; end if;

  perform public.require_perm(v_m.obra_id, 'maquina.update_status');

  if not public.has_perm(v_m.obra_id, 'maquina.sin_habilitacion')
     and not exists (
       select 1 from public.habilitaciones h
       where h.user_id = auth.uid()
         and h.maquina_tipo_id = v_m.maquina_tipo_id
         and (h.valid_until is null or h.valid_until >= current_date)
     ) then
    raise exception 'No tienes habilitación vigente para este tipo de máquina' using errcode = '42501';
  end if;

  update public.maquinas set estado = p_estado where id = p_maquina;

  insert into public.status_events (obra_id, maquina_id, from_state, to_state, nota, user_id)
  values (v_m.obra_id, p_maquina, v_m.estado::text, p_estado::text, p_nota, auth.uid());
end $$;

-- =====================================================================
-- 20. FUNCIONES PARA EDGE FUNCTIONS (solo service_role)
-- =====================================================================

-- Verifica PIN con bloqueo: 5 fallos → 15 min bloqueado.
create function public.verify_worker_pin(p_worker_code text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_c public.worker_credentials;
begin
  select * into v_c from public.worker_credentials
  where worker_code = upper(trim(p_worker_code)) for update;

  if not found then
    -- respuesta genérica: no revelar si el código existe
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_c.locked_until is not null and v_c.locked_until > now() then
    return jsonb_build_object('status', 'locked', 'locked_until', v_c.locked_until);
  end if;

  if extensions.crypt(p_pin, v_c.pin_hash) = v_c.pin_hash then
    update public.worker_credentials
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where user_id = v_c.user_id;
    return jsonb_build_object('status', 'ok', 'user_id', v_c.user_id);
  end if;

  update public.worker_credentials
  set failed_attempts = case when v_c.failed_attempts + 1 >= 5 then 0 else v_c.failed_attempts + 1 end,
      locked_until    = case when v_c.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
      updated_at      = now()
  where user_id = v_c.user_id;

  return jsonb_build_object('status', 'invalid');
end $$;

-- Crea/actualiza credenciales de obrero. Devuelve el worker_code.
create function public.set_worker_pin(p_user uuid, p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener 4 dígitos';
  end if;

  select worker_code into v_code from public.worker_credentials where user_id = p_user;

  if v_code is null then
    loop
      v_code := 'W-' || lpad((floor(random() * 100000))::int::text, 5, '0');
      exit when not exists (select 1 from public.worker_credentials where worker_code = v_code);
    end loop;
    insert into public.worker_credentials (user_id, worker_code, pin_hash)
    values (p_user, v_code, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));
  else
    update public.worker_credentials
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
        failed_attempts = 0, locked_until = null, updated_at = now()
    where user_id = p_user;
  end if;

  return v_code;
end $$;

-- Buscar usuario existente por email (para añadir a una obra a alguien que ya existe)
create function public.user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

-- =====================================================================
-- 21. VISTAS (security_invoker → respetan la RLS del usuario)
-- =====================================================================
create view public.v_modulos with (security_invoker = true) as
select
  m.*,
  c.codigo  as contenedor_codigo,
  c.estado  as contenedor_estado,
  case when m.estado = 'en_contenedor' then c.estado::text else m.estado::text end as estado_efectivo,
  (select count(*) from public.incidencias i where i.modulo_id = m.id and i.estado <> 'cerrada') as incidencias_abiertas,
  (select count(*) from public.fotos f where f.modulo_id = m.id and not f.anulada) as num_fotos
from public.modulos m
join public.contenedores c on c.id = m.contenedor_id;

create view public.v_obra_resumen with (security_invoker = true) as
select
  o.id as obra_id,
  o.nombre,
  (select count(*) from public.contenedores c where c.obra_id = o.id) as contenedores,
  (select count(*) from public.contenedores c where c.obra_id = o.id and c.estado in ('en_obra','descargado')) as contenedores_en_obra,
  (select count(*) from public.modulos m where m.obra_id = o.id) as modulos,
  (select count(*) from public.modulos m where m.obra_id = o.id and m.estado in ('instalado','terminado')) as modulos_instalados,
  (select count(*) from public.incidencias i where i.obra_id = o.id and i.estado <> 'cerrada') as incidencias_abiertas,
  (select count(*) from public.incidencias i where i.obra_id = o.id and i.estado <> 'cerrada' and i.severidad = 'grave') as incidencias_graves
from public.obras o;

-- =====================================================================
-- 22. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.empresas           enable row level security;
alter table public.obras              enable row level security;
alter table public.obra_empresas      enable row level security;
alter table public.obra_members       enable row level security;
alter table public.role_permissions   enable row level security;
alter table public.equipos            enable row level security;
alter table public.equipo_members     enable row level security;
alter table public.maquina_tipos      enable row level security;
alter table public.maquinas           enable row level security;
alter table public.habilitaciones     enable row level security;
alter table public.contenedores       enable row level security;
alter table public.modulos            enable row level security;
alter table public.incidencias        enable row level security;
alter table public.status_events      enable row level security;
alter table public.fotos              enable row level security;
alter table public.foto_correcciones  enable row level security;
alter table public.worker_credentials enable row level security;  -- sin políticas = solo service_role
alter table public.transiciones       enable row level security;

-- ---- Catálogos de solo lectura para cualquier autenticado ----
create policy "read role_permissions" on public.role_permissions for select to authenticated using (true);
create policy "read transiciones"     on public.transiciones     for select to authenticated using (true);
create policy "read maquina_tipos"    on public.maquina_tipos    for select to authenticated using (true);
create policy "ceo manage maquina_tipos" on public.maquina_tipos for all to authenticated
  using ((select public.is_ceo())) with check ((select public.is_ceo()));

-- ---- Profiles: yo, la gente de mis obras, y el CEO todo ----
create policy "read profiles" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select public.is_ceo())
  or id in (select m.user_id from public.obra_members m where m.obra_id in (select public.my_obra_ids()))
);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---- Empresas ----
create policy "read empresas" on public.empresas for select to authenticated using (
  (select public.is_ceo())
  or id in (select oe.empresa_id from public.obra_empresas oe where oe.obra_id in (select public.my_obra_ids()))
);
create policy "ceo manage empresas" on public.empresas for all to authenticated
  using ((select public.is_ceo())) with check ((select public.is_ceo()));

-- ---- Obras / participación (escritura vía RPC) ----
create policy "read obras"         on public.obras         for select to authenticated using (id      in (select public.my_obra_ids()));
create policy "read obra_empresas" on public.obra_empresas for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "read obra_members"  on public.obra_members  for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "ceo update obras"   on public.obras for update to authenticated
  using ((select public.is_ceo())) with check ((select public.is_ceo()));

-- ---- Equipos ----
create policy "read equipos" on public.equipos for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "manage equipos" on public.equipos for all to authenticated
  using      (obra_id in (select public.obras_with_perm('equipo.manage')))
  with check (obra_id in (select public.obras_with_perm('equipo.manage')));

create policy "read equipo_members" on public.equipo_members for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "insert equipo_members" on public.equipo_members for insert to authenticated
  with check (obra_id in (select public.obras_with_perm('equipo.manage')));
create policy "update equipo_members" on public.equipo_members for update to authenticated
  using      (obra_id in (select public.obras_with_perm('equipo.manage')))
  with check (obra_id in (select public.obras_with_perm('equipo.manage')));
-- sin DELETE: se cierra con left_at para conservar historial

-- ---- Máquinas (estado vía RPC; alta/baja por superadmin) ----
create policy "read maquinas" on public.maquinas for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "insert maquinas" on public.maquinas for insert to authenticated
  with check (obra_id in (select public.obras_with_perm('maquina.manage')));
create policy "update maquinas" on public.maquinas for update to authenticated
  using      (obra_id in (select public.obras_with_perm('maquina.manage')))
  with check (obra_id in (select public.obras_with_perm('maquina.manage')));

-- ---- Habilitaciones: visibles/gestionables para gente de obras compartidas ----
create policy "read habilitaciones" on public.habilitaciones for select to authenticated using (
  user_id = (select auth.uid())
  or user_id in (select m.user_id from public.obra_members m where m.obra_id in (select public.my_obra_ids()))
);
create policy "manage habilitaciones" on public.habilitaciones for all to authenticated
  using (user_id in (select m.user_id from public.obra_members m
                     where m.obra_id in (select public.obras_with_perm('habilitacion.manage'))))
  with check (user_id in (select m.user_id from public.obra_members m
                          where m.obra_id in (select public.obras_with_perm('habilitacion.manage'))));

-- ---- Logística, incidencias, eventos: lectura por obra, escritura SOLO vía RPC ----
create policy "read contenedores"      on public.contenedores      for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "read modulos"           on public.modulos           for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "read incidencias"       on public.incidencias       for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "read status_events"     on public.status_events     for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "read foto_correcciones" on public.foto_correcciones for select to authenticated using (
  foto_id in (select f.id from public.fotos f where f.obra_id in (select public.my_obra_ids()))
);

-- ---- Fotos: insert directo (tras subir a Storage), corrección vía RPC ----
create policy "read fotos" on public.fotos for select to authenticated using (obra_id in (select public.my_obra_ids()));
create policy "insert fotos" on public.fotos for insert to authenticated with check (
  obra_id in (select public.obras_with_perm('foto.create'))
  and uploaded_by = (select auth.uid())
  and anulada = false
);

-- =====================================================================
-- 23. STORAGE: bucket privado 'fotos', path '{obra_id}/{archivo}'
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create policy "fotos: subir si tengo foto.create en esa obra" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'fotos'
    and public.try_uuid((storage.foldername(name))[1]) in (select public.obras_with_perm('foto.create'))
  );

create policy "fotos: ver si soy miembro de la obra" on storage.objects
  for select to authenticated using (
    bucket_id = 'fotos'
    and public.try_uuid((storage.foldername(name))[1]) in (select public.my_obra_ids())
  );
-- sin UPDATE/DELETE: la evidencia no se toca.

-- =====================================================================
-- 24. PRIVILEGIOS DE FUNCIONES
-- =====================================================================
-- Por defecto Postgres da EXECUTE a PUBLIC (incluye 'anon'). Lo cerramos.
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.is_ceo(), public.my_obra_ids(), public.obras_with_perm(text),
  public.has_perm(uuid, text), public.require_perm(uuid, text), public.role_rank(public.obra_role),
  public.luhn36_check(text), public.codigo_valido(text), public.try_uuid(text),
  public.create_obra(text, text), public.add_empresa_to_obra(uuid, uuid, public.empresa_tipo),
  public.assign_role(uuid, uuid, uuid, public.obra_role), public.remove_member(uuid, uuid),
  public.import_contenedor(uuid, jsonb), public.check_transition(uuid, text, text, text),
  public.transition_contenedor(uuid, public.contenedor_estado, text),
  public.transition_modulo(uuid, public.modulo_estado, text),
  public.buscar_codigo(uuid, text),
  public.create_incidencia(uuid, uuid, uuid, uuid, text, public.incidencia_severidad, text),
  public.transition_incidencia(uuid, public.incidencia_estado, text),
  public.corregir_foto(uuid, text, boolean, uuid, uuid, uuid),
  public.update_maquina_estado(uuid, public.maquina_estado, text)
to authenticated;

-- Solo el servidor (Edge Functions con service_role)
revoke execute on function public.verify_worker_pin(text, text) from authenticated;
revoke execute on function public.set_worker_pin(uuid, text)    from authenticated;
revoke execute on function public.user_id_by_email(text)        from authenticated;
grant  execute on function public.user_id_by_email(text)        to service_role;
grant  execute on function public.verify_worker_pin(text, text) to service_role;
grant  execute on function public.set_worker_pin(uuid, text)    to service_role;

-- Las tablas no tienen privilegios para anon (todas las políticas son 'to authenticated'),
-- pero lo dejamos explícito:
revoke all on all tables in schema public from anon;
