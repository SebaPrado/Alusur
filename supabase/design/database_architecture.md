## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `full_name` | `text` |  |
| `phone` | `text` |  Nullable |
| `platform_role` | `platform_role` |  Nullable |
| `is_worker` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `empresas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `text` |  Unique |
| `pais` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `obras`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `text` |  |
| `ubicacion` | `text` |  Nullable |
| `activa` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `obra_empresas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `obra_id` | `uuid` | Primary |
| `empresa_id` | `uuid` | Primary |
| `tipo` | `empresa_tipo` |  |

## Table `obra_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `obra_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `empresa_id` | `uuid` |  |
| `role` | `obra_role` |  |
| `active` | `bool` |  |
| `added_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `role_permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `role` | `obra_role` | Primary |
| `permission` | `text` | Primary |

## Table `equipos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `nombre` | `text` |  |
| `lider_user_id` | `uuid` |  Nullable → `profiles(id)` |
| `created_at` | `timestamptz` |  |

## Table `equipo_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `equipo_id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `user_id` | `uuid` | Primary |
| `joined_at` | `timestamptz` | Primary |
| `left_at` | `timestamptz` |  Nullable |

## Table `maquina_tipos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nombre` | `text` |  Unique |

## Table `maquinas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `maquina_tipo_id` | `uuid` |  |
| `codigo` | `text` |  |
| `estado` | `maquina_estado` |  |
| `created_at` | `timestamptz` |  |

## Table `habilitaciones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `maquina_tipo_id` | `uuid` | Primary |
| `valid_until` | `date` |  Nullable |
| `granted_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `contenedores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `codigo` | `text` |  |
| `codigo_iso` | `text` |  Nullable |
| `estado` | `contenedor_estado` |  |
| `created_at` | `timestamptz` |  |

## Table `modulos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `contenedor_id` | `uuid` |  |
| `posicion` | `int4` |  |
| `codigo` | `text` |  |
| `tipo` | `modulo_tipo` |  |
| `referencia` | `text` |  Nullable |
| `estado` | `modulo_estado` |  |
| `created_at` | `timestamptz` |  |

## Table `incidencias`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `contenedor_id` | `uuid` |  Nullable |
| `modulo_id` | `uuid` |  Nullable |
| `maquina_id` | `uuid` |  Nullable |
| `tipo` | `text` |  |
| `severidad` | `incidencia_severidad` |  |
| `descripcion` | `text` |  Nullable |
| `estado` | `incidencia_estado` |  |
| `reported_by` | `uuid` |  |
| `created_at` | `timestamptz` |  |

## Table `status_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `contenedor_id` | `uuid` |  Nullable |
| `modulo_id` | `uuid` |  Nullable |
| `incidencia_id` | `uuid` |  Nullable |
| `maquina_id` | `uuid` |  Nullable |
| `from_state` | `text` |  Nullable |
| `to_state` | `text` |  |
| `nota` | `text` |  Nullable |
| `user_id` | `uuid` |  |
| `created_at` | `timestamptz` |  |

## Table `fotos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `obra_id` | `uuid` |  |
| `storage_path` | `text` |  Unique |
| `uploaded_by` | `uuid` |  |
| `taken_at` | `timestamptz` |  Nullable |
| `server_at` | `timestamptz` |  |
| `contenedor_id` | `uuid` |  Nullable |
| `modulo_id` | `uuid` |  Nullable |
| `incidencia_id` | `uuid` |  Nullable |
| `status_event_id` | `uuid` |  Nullable |
| `anulada` | `bool` |  |
| `anulada_motivo` | `text` |  Nullable |
| `anulada_por` | `uuid` |  Nullable |

## Table `foto_correcciones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `foto_id` | `uuid` |  |
| `antes` | `jsonb` |  |
| `despues` | `jsonb` |  |
| `motivo` | `text` |  |
| `user_id` | `uuid` |  |
| `created_at` | `timestamptz` |  |

## Table `worker_credentials`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `worker_code` | `text` |  Unique |
| `pin_hash` | `text` |  |
| `failed_attempts` | `int4` |  |
| `locked_until` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  |
| `lockouts` | `int4` |  |

## Table `transiciones`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `entidad` | `text` | Primary |
| `from_state` | `text` | Primary |
| `to_state` | `text` | Primary |
| `permission` | `text` |  |

## Table `fachadas`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `obra_id` | `uuid` | Primary |
| `piso_desde` | `int4` |  |
| `piso_hasta` | `int4` |  |
| `ancho_modulo_m` | `numeric` |  |
| `alto_piso_m` | `numeric` |  |
| `updated_by` | `uuid` |  Nullable |
| `updated_at` | `timestamptz` |  |
| `modo` | `fachada_modo` |  |
| `vista_simple` | `fachada_vista_simple` |  |

## Table `fachada_caras`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `obra_id` | `uuid` | Primary |
| `orden` | `int2` | Primary |
| `codigo` | `text` |  |
| `nombre` | `text` |  |
| `modulos_por_piso` | `int4` |  |
| `secuencia` | `_modulo_tipo` |  |
| `entorno` | `cara_entorno` |  |

## Custom Types / Enums

### `platform_role`

`ceo`

### `obra_role`

`superadmin` | `admin` | `obrero` | `owner`

### `empresa_tipo`

`socia` | `contratada`

### `contenedor_estado`

`en_produccion` | `en_camino` | `en_puerto` | `en_deposito` | `en_obra` | `descargado`

### `modulo_estado`

`en_contenedor` | `descargado` | `instalado` | `terminado`

### `modulo_tipo`

`ventana` | `panel`

### `incidencia_estado`

`abierta` | `en_revision` | `cerrada`

### `incidencia_severidad`

`leve` | `media` | `grave`

### `maquina_estado`

`operativa` | `en_uso` | `averiada` | `mantenimiento`

### `cara_entorno`

`mar` | `calle` | `parque`

### `fachada_modo`

`torre` | `simple`

### `fachada_vista_simple`

`plano` | `lamina`

## RLS Policies

### `role_permissions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read role_permissions` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `transiciones`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read transiciones` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `maquina_tipos`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read maquina_tipos` | SELECT | authenticated | PERMISSIVE | `true` | — |
| `ceo manage maquina_tipos` | ALL | authenticated | PERMISSIVE | `( SELECT is_ceo() AS is_ceo)` | `( SELECT is_ceo() AS is_ceo)` |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read profiles` | SELECT | authenticated | PERMISSIVE | `((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_ceo() AS is_ceo) OR (id IN ( SELECT m.user_id    FROM obra_members m   WHERE (m.obra_id IN ( SELECT my_obra_ids() AS my_obra_ids)))))` | — |
| `update own profile` | UPDATE | authenticated | PERMISSIVE | `(id = ( SELECT auth.uid() AS uid))` | `(id = ( SELECT auth.uid() AS uid))` |

### `empresas`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read empresas` | SELECT | authenticated | PERMISSIVE | `(( SELECT is_ceo() AS is_ceo) OR (id IN ( SELECT oe.empresa_id    FROM obra_empresas oe   WHERE (oe.obra_id IN ( SELECT my_obra_ids() AS my_obra_ids)))))` | — |
| `ceo manage empresas` | ALL | authenticated | PERMISSIVE | `( SELECT is_ceo() AS is_ceo)` | `( SELECT is_ceo() AS is_ceo)` |

### `obras`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read obras` | SELECT | authenticated | PERMISSIVE | `(id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |
| `ceo update obras` | UPDATE | authenticated | PERMISSIVE | `( SELECT is_ceo() AS is_ceo)` | `( SELECT is_ceo() AS is_ceo)` |

### `obra_empresas`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read obra_empresas` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `obra_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read obra_members` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `equipos`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read equipos` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |
| `manage equipos` | ALL | authenticated | PERMISSIVE | `(obra_id IN ( SELECT obras_with_perm('equipo.manage'::text) AS obras_with_perm))` | `(obra_id IN ( SELECT obras_with_perm('equipo.manage'::text) AS obras_with_perm))` |

### `equipo_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read equipo_members` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |
| `insert equipo_members` | INSERT | authenticated | PERMISSIVE | — | `(obra_id IN ( SELECT obras_with_perm('equipo.manage'::text) AS obras_with_perm))` |
| `update equipo_members` | UPDATE | authenticated | PERMISSIVE | `(obra_id IN ( SELECT obras_with_perm('equipo.manage'::text) AS obras_with_perm))` | `(obra_id IN ( SELECT obras_with_perm('equipo.manage'::text) AS obras_with_perm))` |

### `habilitaciones`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read habilitaciones` | SELECT | authenticated | PERMISSIVE | `((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IN ( SELECT m.user_id    FROM obra_members m   WHERE (m.obra_id IN ( SELECT my_obra_ids() AS my_obra_ids)))))` | — |
| `manage habilitaciones` | ALL | authenticated | PERMISSIVE | `(user_id IN ( SELECT m.user_id    FROM obra_members m   WHERE (m.obra_id IN ( SELECT obras_with_perm('habilitacion.manage'::text) AS obras_with_perm))))` | `(user_id IN ( SELECT m.user_id    FROM obra_members m   WHERE (m.obra_id IN ( SELECT obras_with_perm('habilitacion.manage'::text) AS obras_with_perm))))` |

### `maquinas`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read maquinas` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |
| `insert maquinas` | INSERT | authenticated | PERMISSIVE | — | `(obra_id IN ( SELECT obras_with_perm('maquina.manage'::text) AS obras_with_perm))` |
| `update maquinas` | UPDATE | authenticated | PERMISSIVE | `(obra_id IN ( SELECT obras_with_perm('maquina.manage'::text) AS obras_with_perm))` | `(obra_id IN ( SELECT obras_with_perm('maquina.manage'::text) AS obras_with_perm))` |

### `contenedores`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read contenedores` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `modulos`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read modulos` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `incidencias`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read incidencias` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `status_events`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read status_events` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `foto_correcciones`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read foto_correcciones` | SELECT | authenticated | PERMISSIVE | `(foto_id IN ( SELECT f.id    FROM fotos f   WHERE (f.obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))))` | — |

### `fotos`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read fotos` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |
| `insert fotos` | INSERT | authenticated | PERMISSIVE | — | `((obra_id IN ( SELECT obras_with_perm('foto.create'::text) AS obras_with_perm)) AND (uploaded_by = ( SELECT auth.uid() AS uid)) AND (anulada = false))` |

### `fachadas`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read fachadas` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

### `fachada_caras`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `read fachada_caras` | SELECT | authenticated | PERMISSIVE | `(obra_id IN ( SELECT my_obra_ids() AS my_obra_ids))` | — |

