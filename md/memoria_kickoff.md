ESTADO PROYECTO
MD · 6.9kB · hace 16 minutos


# ALUSUR / Cipriani Torre 1: estado del proyecto
 
_Última actualización: 22/10/2026_
 
## 1. Qué es
 
Sistema para gestionar la llegada, descarga e instalación de ~270 contenedores con módulos (ventanas y paneles) en la obra Cipriani Torre 1, con foco en **documentar daños para reclamaciones**.
 
- **Frontend:** React + Vite + MUI + React Router (repo `SebaPrado/Alusur`, Vercel)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Proyecto Supabase:** `byfdrcdiqwlbaldewikg`, región **São Paulo**, plan Free (pasar a Pro antes de producción)
---
 
## 2. Decisiones de arquitectura
 
| Tema | Decisión |
|---|---|
| Roles | El rol vive en la relación **usuario ↔ obra** (`obra_members`), no en el usuario |
| CEO | Rol de **plataforma** (`profiles.platform_role`). Ve y hace todo en todas las obras |
| Habilidades especiales | **Habilitaciones** por tipo de máquina (ej. Spider), separadas del rol |
| Visibilidad | Todo lo de la obra es visible para sus miembros; no hay filtro por empresa |
| Estado logístico | Vive en el **contenedor**; el módulo tiene estado propio desde la descarga |
| Daños | Son **incidencias** (entidad propia), no un estado del módulo |
| Auditoría | `status_events` y `foto_correcciones` **append-only** (ni el superusuario puede editarlos) |
| Fotos | Nunca se borran: se **anulan** con motivo. Bucket privado `fotos`, path `{obra_id}/{uuid}.jpg` |
| Fechas | Siempre `timestamptz` (equipo entre España y Uruguay) |
| Códigos | `C-0142` (contenedor), `C-0142-07-K` (módulo + dígito de control Luhn mod 36), QR generados por el sistema desde el packing list de ALUMAN |
| Escritura | Casi todo vía **RPC** (validan permiso, transición y dejan evento). El cliente no hace `UPDATE` directo |
| Seguridad | La aplica la **RLS** en la base de datos. Ocultar pantallas en el frontend es solo usabilidad |
 
---
 
## 3. Roles y permisos
 
| Rol | Alcance | Puede |
|---|---|---|
| **CEO** | Plataforma | Todo. Crea obras, vincula empresas y asigna cualquier rol (incluido Owner) |
| **SuperAdmin** | Obra | Usuarios y roles **por debajo** de él (no Owner), logística, importar packing list, **cerrar** incidencias, máquinas, habilitaciones |
| **Admin** | Obra | Operar la obra, **revisar** incidencias, corregir módulos y cualquier foto. **No** crea usuarios |
| **Obrero** | Obra | Fotos, avance de módulos, reportar incidencias, corregir **sus** fotos durante 48 h, operar máquinas para las que está habilitado |
| **Owner** | Obra | **Solo lectura** (el dueño o inversor). Garantizado por RLS |
 
**Jerarquía:** nadie asigna un rol igual o superior al suyo, ni modifica a un usuario de rango igual o superior, ni se cambia a sí mismo.
 
**Incidencias:** `abierta` → (Admin) `en_revision` → (SuperAdmin) `cerrada`. Cerrar exige una nota de resolución.
 
**Contenedor:** `en_produccion → en_camino → en_puerto → (en_deposito) → en_obra → descargado`
 
**Módulo:** `en_contenedor → descargado → instalado → terminado`
 
Los permisos y las transiciones son **datos** (tablas `role_permissions` y `transiciones`): se ajustan sin cambiar código.
 
---
 
## 4. Login
 
| Usuario | Método |
|---|---|
| CEO, SuperAdmin, Admin, Owner | Email + contraseña (Supabase Auth) |
| Obrero | **Código + PIN de 4 dígitos.** El móvil guarda el código (enrolamiento por QR); el obrero solo escribe el PIN |
 
**Protección del PIN:** 10 intentos, después bloqueo **progresivo** (15 min → 30 min → 1 h → … tope 24 h). Un login correcto o un reset lo ponen a cero.
 
---
 
## 5. Lo que está desplegado
 
### Base de datos (2 migraciones aplicadas y registradas)
 
| Archivo | Contenido |
|---|---|
| `20261022000000_init_roles.sql` | 19 tablas, 29 políticas RLS, RPCs, bucket `fotos`, vistas |
| `20261022150000_pin_10_intentos.sql` | 10 intentos + bloqueo progresivo |
 
Validado con **75 tests de permisos** (`supabase/tests/rls_test.sql`), todos en verde.
 
### Edge Functions
 
| Función | Para qué |
|---|---|
| `worker-login` | PIN → sesión de Supabase (desplegada con `--no-verify-jwt`) |
| `admin-users` | `create_worker`, `create_user`, `reset_pin`. La jerarquía la valida la base de datos |
 
Existen porque son lo único que necesita la key secreta (`service_role`).
 
### Datos
 
- CEOs: **Ricardo Prado** y **Juan Prado**
- Script `supabase/scripts/01_obra_inicial_y_obrero_prueba.sql`: obra **Cipriani Torre 1**, ALUMAN y ALUSUR como socias, obrero de prueba (PIN `1234`)
### Frontend: helpers en `src/lib/`
 
| Archivo | Para qué |
|---|---|
| `supabase.js` | Cliente de Supabase (usa `VITE_SUPABASE_PUBLISHABLE_KEY`) |
| `workerAuth.js` | Enrolamiento y login del obrero con PIN, devuelve los intentos restantes |
| `fotos.js` | Comprime (1600 px), sube a Storage y registra la foto |
 
---
 
## 6. Referencia rápida de RPCs
 
| Acción | RPC |
|---|---|
| Crear obra (CEO) | `create_obra` |
| Vincular empresa (CEO) | `add_empresa_to_obra` |
| Asignar o cambiar rol | `assign_role` |
| Dar de baja (lógica) | `remove_member` |
| Importar contenedor del packing list | `import_contenedor` |
| Buscar por código escaneado | `buscar_codigo` |
| Mover contenedor | `transition_contenedor` |
| Avance de módulo | `transition_modulo` |
| Reportar problema | `create_incidencia` |
| Revisar o cerrar incidencia | `transition_incidencia` |
| Corregir o anular foto | `corregir_foto` |
| Estado de máquina | `update_maquina_estado` |
 
Vistas: `v_modulos` (estado efectivo) y `v_obra_resumen` (dashboard del Owner).
 
---
 
## 7. Forma de trabajo
 
- **SQL:** Claude escribe el script y Seba lo ejecuta en el **SQL Editor**.
  - **Migración** (cambia el esquema) → `supabase/migrations/`, con transacción y autorregistro en el historial.
  - **Script de datos** → `supabase/scripts/`.
  - Nunca se modifica una migración ya aplicada: cada cambio es un archivo nuevo.
- **Edge Functions:** `npx supabase functions deploy <nombre>`.
- **`.env`** ignorado en git; `.env.example` commiteado.
---
 
## 8. Pendiente
 
### Configuración
- [ ] Authentication → "Allow new users to sign up": **OFF**
- [ ] Variables de entorno en Vercel
- [ ] `.gitattributes` con `* text=auto eol=lf`
- [ ] Actualizar a React Router 7 (`npm install react-router-dom@7`)
### Frontend (en orden)
1. **Base:** sesión, perfil, obra activa, rutas según el rol
2. **CEO:** crear obra, vincular empresas, dar de alta SuperAdmins
3. **SuperAdmin:** alta de obreros con QR; importar packing list y generar el PDF de etiquetas
4. **Obrero (mobile):** PIN → escanear → foto / avance / problema
5. **Admin / SuperAdmin:** gestión de incidencias
6. **Owner:** dashboard ejecutivo
### Antes de producción
- [ ] Plan **Pro** (backups diarios; en Free no hay)
- [ ] Respaldo de las fotos a S3 (los backups de Supabase no incluyen Storage)
- [ ] SMTP propio para las invitaciones por email
### Para arrancar el frontend, falta
- Maqueta HTML del panel
- `src/App.jsx` y `src/main.jsx` actuales