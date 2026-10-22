-- =====================================================================
-- Test de permisos/RLS. Ejecutar como superusuario (postgres) en una BD
-- de pruebas DESPUÉS de la migración. No ejecutar en producción.
--   psql "$DB_URL" -f supabase/tests/rls_test.sql
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ---------- helpers ----------
create or replace function pg_temp.as_user(p_uid uuid, p_sql text)
returns text language plpgsql as $$
declare r text;
begin
  begin
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('role', 'authenticated', true);
    execute p_sql into r;
    perform set_config('role', 'postgres', true);
    return coalesce(nullif(r, ''), 'OK');
  exception when others then
    perform set_config('role', 'postgres', true);
    return 'ERR: ' || sqlerrm;
  end;
end $$;

create temp table results (n serial, caso text, esperado text, obtenido text);

create or replace function pg_temp.t(p_caso text, p_uid uuid, p_sql text, p_expect text)
returns void language plpgsql as $$
declare r text := pg_temp.as_user(p_uid, p_sql);
begin
  insert into results (caso, esperado, obtenido) values (p_caso, p_expect, r);
end $$;

-- ---------- usuarios ----------
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'ricardo@test',   '{"full_name":"Ricardo (CEO)"}', '{}'),
 ('00000000-0000-0000-0000-00000000000b', 'sa.aluman@test', '{"full_name":"SA Aluman"}', '{}'),
 ('00000000-0000-0000-0000-00000000000c', 'sa.alusur@test', '{"full_name":"SA Alusur"}', '{}'),
 ('00000000-0000-0000-0000-00000000000d', 'admin@test',     '{"full_name":"Admin Obra"}', '{}'),
 ('00000000-0000-0000-0000-00000000000e', 'w_pepe@obra.internal', '{"full_name":"Pepe"}', '{"is_worker":true}'),
 ('00000000-0000-0000-0000-00000000000f', 'w_juan@obra.internal', '{"full_name":"Juan Obrero"}', '{"is_worker":true}'),
 ('00000000-0000-0000-0000-000000000010', 'dueno@test',     '{"full_name":"Dueño"}', '{}'),
 ('00000000-0000-0000-0000-000000000011', 'extraño@test',   '{"full_name":"No miembro"}', '{}');

select set_config('request.jwt.claim.role', 'service_role', false);
update public.profiles set platform_role = 'ceo' where id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claim.role', '', false);

insert into public.empresas (id, nombre, pais) values
 ('10000000-0000-0000-0000-000000000001', 'ALUMAN', 'ES'),
 ('10000000-0000-0000-0000-000000000002', 'ALUSUR', 'UY'),
 ('10000000-0000-0000-0000-000000000003', 'Contratista X', 'UY');
insert into public.maquina_tipos (id, nombre) values ('20000000-0000-0000-0000-000000000001', 'spider');

\set CEO    '''00000000-0000-0000-0000-00000000000a'''
\set SA1    '''00000000-0000-0000-0000-00000000000b'''
\set SA2    '''00000000-0000-0000-0000-00000000000c'''
\set ADM    '''00000000-0000-0000-0000-00000000000d'''
\set PEPE   '''00000000-0000-0000-0000-00000000000e'''
\set JUAN   '''00000000-0000-0000-0000-00000000000f'''
\set OWNER  '''00000000-0000-0000-0000-000000000010'''
\set OUT    '''00000000-0000-0000-0000-000000000011'''

-- ---------- CEO monta la obra ----------
create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

select pg_temp.t('CEO crea obra', :CEO,
  $$ with x as (select public.create_obra('Cipriani Torre 1', 'Punta del Este') id)
     insert into ctx select 'obra', id from x returning 'OK' $$, 'OK');
\set OBRA '(select v from ctx where k=''obra'')'

select pg_temp.t('No-CEO no crea obra', :SA1, $$ select public.create_obra('X')::text $$, 'ERR');

select pg_temp.t('CEO vincula empresas', :CEO, format($$
  select public.add_empresa_to_obra(%1$L,'10000000-0000-0000-0000-000000000001','socia');
  $$, (select v from ctx where k='obra')) || format($$ $$), 'OK');
select pg_temp.as_user(:CEO, format($$ select public.add_empresa_to_obra(%L,'10000000-0000-0000-0000-000000000002','socia')::text $$, (select v from ctx where k='obra')));
select pg_temp.as_user(:CEO, format($$ select public.add_empresa_to_obra(%L,'10000000-0000-0000-0000-000000000003','contratada')::text $$, (select v from ctx where k='obra')));

select pg_temp.t('CEO asigna SA ALUMAN', :CEO, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000001', 'superadmin')::text $$, (select v from ctx where k='obra'), :SA1), 'OK');
select pg_temp.t('CEO asigna SA ALUSUR', :CEO, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'superadmin')::text $$, (select v from ctx where k='obra'), :SA2), 'OK');
select pg_temp.t('CEO asigna owner', :CEO, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'owner')::text $$, (select v from ctx where k='obra'), :OWNER), 'OK');

-- ---------- Jerarquía de roles ----------
select pg_temp.t('SA asigna admin', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'admin')::text $$, (select v from ctx where k='obra'), :ADM), 'OK');
select pg_temp.t('SA asigna obrero Pepe', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000003', 'obrero')::text $$, (select v from ctx where k='obra'), :PEPE), 'OK');
select pg_temp.t('SA asigna obrero Juan', :SA1, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000001', 'obrero')::text $$, (select v from ctx where k='obra'), :JUAN), 'OK');
select pg_temp.t('SA NO asigna superadmin', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'superadmin')::text $$, (select v from ctx where k='obra'), :OUT), 'ERR');
select pg_temp.t('SA NO asigna owner', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'owner')::text $$, (select v from ctx where k='obra'), :OUT), 'ERR');
select pg_temp.t('SA NO degrada a otro SA', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000001', 'obrero')::text $$, (select v from ctx where k='obra'), :SA1), 'ERR');
select pg_temp.t('SA NO toca al owner', :SA2, format($$ select public.remove_member(%L, %L)::text $$, (select v from ctx where k='obra'), :OWNER), 'ERR');
select pg_temp.t('SA NO se cambia a sí mismo', :SA2, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'admin')::text $$, (select v from ctx where k='obra'), :SA2), 'ERR');
select pg_temp.t('Admin NO crea usuarios', :ADM, format($$ select public.assign_role(%L, %L, '10000000-0000-0000-0000-000000000002', 'obrero')::text $$, (select v from ctx where k='obra'), :OUT), 'ERR');
select pg_temp.t('Empresa no vinculada a la obra → error', :CEO, format($$ select public.assign_role(%L, %L, gen_random_uuid(), 'obrero')::text $$, (select v from ctx where k='obra'), :OUT), 'ERR');
select pg_temp.t('Insert directo en obra_members bloqueado', :SA2, format($$ insert into public.obra_members (obra_id,user_id,empresa_id,role) values (%L,%L,'10000000-0000-0000-0000-000000000002','superadmin') returning 'OK' $$, (select v from ctx where k='obra'), :OUT), 'ERR');

-- ---------- Logística ----------
select pg_temp.t('Obrero NO importa packing list', :PEPE, format($$ select public.import_contenedor(%L, '{"codigo":"C-0001","modulos":[{"tipo":"ventana"}]}')::text $$, (select v from ctx where k='obra')), 'ERR');
select pg_temp.t('SA ALUMAN importa contenedor', :SA1, format($$
  with x as (select public.import_contenedor(%L, '{"codigo":"C-0142","codigo_iso":"MSCU1234565","modulos":[{"tipo":"ventana","referencia":"V-01"},{"tipo":"panel","referencia":"P-01"},{"tipo":"ventana","referencia":"V-02"}]}') id)
  insert into ctx select 'cont', id from x returning 'OK' $$, (select v from ctx where k='obra')), 'OK');
select pg_temp.t('Código de contenedor inválido', :SA1, format($$ select public.import_contenedor(%L, '{"codigo":"XX","modulos":[{"tipo":"ventana"}]}')::text $$, (select v from ctx where k='obra')), 'ERR');

select pg_temp.t('Módulos generados con dígito de control', :SA1,
  $$ select string_agg(codigo, ',' order by posicion) || ' valid=' || bool_and(public.codigo_valido(codigo)) from public.modulos $$, 'C-0142');

select pg_temp.t('Obrero NO mueve contenedor', :PEPE, format($$ select public.transition_contenedor(%L,'en_camino')::text $$, (select v from ctx where k='cont')), 'ERR');
select pg_temp.t('Salto ilegal produccion→obra', :SA1, format($$ select public.transition_contenedor(%L,'en_obra')::text $$, (select v from ctx where k='cont')), 'ERR');
select pg_temp.t('Obrero NO descarga módulo antes de llegar', :PEPE,
  $$ select public.transition_modulo((select id from public.modulos where posicion=1),'descargado')::text $$, 'ERR');
select pg_temp.as_user(:SA1,  format($$ select public.transition_contenedor(%L,'en_camino')::text $$, (select v from ctx where k='cont')));
select pg_temp.t('ALUMAN en Uruguay marca en_puerto', :SA1, format($$ select 'OK' from public.transition_contenedor(%L,'en_puerto') $$, (select v from ctx where k='cont')), 'OK');
select pg_temp.t('ALUSUR marca en_obra', :SA2, format($$ select 'OK' from public.transition_contenedor(%L,'en_obra') $$, (select v from ctx where k='cont')), 'OK');

select pg_temp.t('Obrero descarga módulo', :PEPE,
  $$ select 'OK' from public.transition_modulo((select id from public.modulos where posicion=1),'descargado') $$, 'OK');
select pg_temp.t('Obrero NO retrocede módulo', :PEPE,
  $$ select public.transition_modulo((select id from public.modulos where posicion=1),'en_contenedor')::text $$, 'ERR');
select pg_temp.t('Admin corrige módulo', :ADM,
  $$ select 'OK' from public.transition_modulo((select id from public.modulos where posicion=1),'en_contenedor') $$, 'OK');
select pg_temp.as_user(:PEPE, $$ select public.transition_modulo((select id from public.modulos where posicion=1),'descargado')::text $$);
select pg_temp.t('No se recarga contenedor con módulos fuera', :SA2, format($$ select public.transition_contenedor(%L,'en_puerto')::text $$, (select v from ctx where k='cont')), 'ERR');

select pg_temp.t('Vista estado efectivo', :PEPE,
  $$ select string_agg(estado_efectivo, ',' order by posicion) from public.v_modulos $$, 'descargado,en_obra,en_obra');

-- ---------- Escaneo ----------
select pg_temp.t('Escaneo código correcto', :PEPE, format($$ select (public.buscar_codigo(%L, (select codigo from public.modulos where posicion=2)) ->> 'tipo') $$, (select v from ctx where k='obra')), 'modulo');
select pg_temp.t('Escaneo con dígito de control mal', :PEPE, format($$ select public.buscar_codigo(%L, (select left(codigo, length(codigo)-1) || case when right(codigo,1)='Z' then 'Y' else 'Z' end from public.modulos where posicion=2))::text $$, (select v from ctx where k='obra')), 'ERR');

-- ---------- Incidencias ----------
select pg_temp.t('Obrero crea incidencia', :PEPE, format($$
  with x as (select public.create_incidencia(%L, null, (select id from public.modulos where posicion=1), null, 'daño', 'grave', 'Vidrio roto') id)
  insert into ctx select 'inc', id from x returning 'OK' $$, (select v from ctx where k='obra')), 'OK');
select pg_temp.t('Obrero NO revisa incidencia', :PEPE, format($$ select public.transition_incidencia(%L,'en_revision')::text $$, (select v from ctx where k='inc')), 'ERR');
select pg_temp.t('Admin NO cierra directo', :ADM, format($$ select public.transition_incidencia(%L,'cerrada','x')::text $$, (select v from ctx where k='inc')), 'ERR');
select pg_temp.t('Admin pasa a revisión', :ADM, format($$ select 'OK' from public.transition_incidencia(%L,'en_revision','Revisado, reposición pedida') $$, (select v from ctx where k='inc')), 'OK');
select pg_temp.t('Admin NO cierra desde revisión', :ADM, format($$ select public.transition_incidencia(%L,'cerrada','x')::text $$, (select v from ctx where k='inc')), 'ERR');
select pg_temp.t('SA NO cierra sin nota', :SA2, format($$ select public.transition_incidencia(%L,'cerrada')::text $$, (select v from ctx where k='inc')), 'ERR');
select pg_temp.t('SA cierra con nota', :SA2, format($$ select 'OK' from public.transition_incidencia(%L,'cerrada','Repuesto e instalado') $$, (select v from ctx where k='inc')), 'OK');

-- ---------- Fotos ----------
select pg_temp.t('Obrero sube foto a Storage', :PEPE, format($$ insert into storage.objects (bucket_id, name) values ('fotos', %L || '/a.jpg') returning 'OK' $$, (select v from ctx where k='obra')), 'OK');
select pg_temp.t('Obrero NO sube a otra obra', :PEPE, $$ insert into storage.objects (bucket_id, name) values ('fotos', gen_random_uuid() || '/a.jpg') returning 'OK' $$, 'ERR');
select pg_temp.t('Obrero NO sube a path basura', :PEPE, $$ insert into storage.objects (bucket_id, name) values ('fotos', 'basura/a.jpg') returning 'OK' $$, 'ERR');
select pg_temp.t('Obrero NO borra de Storage', :PEPE, $$ with d as (delete from storage.objects returning 1) select count(*)::text from d $$, '0');
select pg_temp.t('Obrero registra foto', :PEPE, format($$
  with x as (insert into public.fotos (obra_id, storage_path, modulo_id) values (%1$L, %1$L || '/a.jpg', (select id from public.modulos where posicion=2)) returning id)
  insert into ctx select 'foto', id from x returning 'OK' $$, (select v from ctx where k='obra')), 'OK');
select pg_temp.t('Foto sin destino rechazada', :PEPE, format($$ insert into public.fotos (obra_id, storage_path) values (%1$L, %1$L || '/b.jpg') returning 'OK' $$, (select v from ctx where k='obra')), 'ERR');
select pg_temp.t('Foto firmada por otro rechazada', :PEPE, format($$ insert into public.fotos (obra_id, storage_path, modulo_id, uploaded_by) values (%1$L, %1$L || '/c.jpg', (select id from public.modulos where posicion=2), %2$L) returning 'OK' $$, (select v from ctx where k='obra'), :JUAN), 'ERR');
select pg_temp.t('Otro obrero NO corrige foto ajena', :JUAN, format($$ select public.corregir_foto(%L, 'equivocada', false, null, (select id from public.modulos where posicion=3))::text $$, (select v from ctx where k='foto')), 'ERR');
select pg_temp.t('Obrero corrige su foto', :PEPE, format($$ select public.corregir_foto(%L, 'Era el módulo 3', false, null, (select id from public.modulos where posicion=3))::text $$, (select v from ctx where k='foto')), 'OK');
update public.fotos set server_at = now() - interval '3 days';
select pg_temp.t('Obrero NO corrige pasadas 48h', :PEPE, format($$ select public.corregir_foto(%L, 'otra vez', true)::text $$, (select v from ctx where k='foto')), 'ERR');
select pg_temp.t('Admin corrige pasadas 48h', :ADM, format($$ select public.corregir_foto(%L, 'Foto movida', true)::text $$, (select v from ctx where k='foto')), 'OK');
select pg_temp.t('Historial de correcciones', :OWNER, $$ select count(*)::text from public.foto_correcciones $$, '2');
select pg_temp.t('Update directo de foto bloqueado', :PEPE, $$ with u as (update public.fotos set anulada=false returning 1) select count(*)::text from u $$, '0');

-- ---------- Máquinas ----------
insert into public.maquinas (id, obra_id, maquina_tipo_id, codigo)
values ('30000000-0000-0000-0000-000000000001', (select v from ctx where k='obra'), '20000000-0000-0000-0000-000000000001', 'SPIDER-1');
select pg_temp.t('Obrero sin habilitación NO opera spider', :JUAN, $$ select public.update_maquina_estado('30000000-0000-0000-0000-000000000001','en_uso')::text $$, 'ERR');
select pg_temp.t('SA habilita a Pepe para spider', :SA2, format($$ insert into public.habilitaciones (user_id, maquina_tipo_id, granted_by) values (%L,'20000000-0000-0000-0000-000000000001',%L) returning 'OK' $$, :PEPE, :SA2), 'OK');
select pg_temp.t('Obrero NO se auto-habilita', :JUAN, format($$ insert into public.habilitaciones (user_id, maquina_tipo_id) values (%L,'20000000-0000-0000-0000-000000000001') returning 'OK' $$, :JUAN), 'ERR');
select pg_temp.t('Pepe habilitado opera spider', :PEPE, $$ select public.update_maquina_estado('30000000-0000-0000-0000-000000000001','en_uso')::text $$, 'OK');

-- ---------- Owner (solo lectura) ----------
select pg_temp.t('Owner lee contenedores', :OWNER, $$ select count(*)::text from public.contenedores $$, '1');
select pg_temp.t('Owner lee resumen', :OWNER, $$ select modulos || ' módulos / ' || incidencias_abiertas || ' abiertas' from public.v_obra_resumen $$, '3 módulos');
select pg_temp.t('Owner NO crea incidencia', :OWNER, format($$ select public.create_incidencia(%L)::text $$, (select v from ctx where k='obra')), 'ERR');
select pg_temp.t('Owner NO sube foto', :OWNER, format($$ insert into storage.objects (bucket_id, name) values ('fotos', %L || '/z.jpg') returning 'OK' $$, (select v from ctx where k='obra')), 'ERR');
select pg_temp.t('Owner NO modifica módulos (0 filas)', :OWNER, $$ with u as (update public.modulos set estado='terminado' returning 1) select count(*)::text from u $$, '0');
select pg_temp.t('Owner NO avanza módulo', :OWNER, $$ select public.transition_modulo((select id from public.modulos where posicion=2),'descargado')::text $$, 'ERR');

-- ---------- Aislamiento ----------
select pg_temp.t('No miembro ve 0 obras', :OUT, $$ select count(*)::text from public.obras $$, '0');
select pg_temp.t('No miembro ve 0 fotos', :OUT, $$ select count(*)::text from public.fotos $$, '0');
select pg_temp.t('Nadie se auto-promueve a CEO', :PEPE, format($$ with u as (update public.profiles set platform_role='ceo' where id=%L returning 1) select count(*)::text from u $$, :PEPE), 'ERR');

-- ---------- Auditoría ----------
select pg_temp.t('status_events inmutable', :CEO, $$ with u as (update public.status_events set nota='x' returning 1) select count(*)::text from u $$, '0');
do $$ begin
  update public.status_events set nota = 'hack';
  insert into results (caso, esperado, obtenido) values ('status_events inmutable (incluso superuser)', 'ERR', 'OK (MAL)');
exception when others then
  insert into results (caso, esperado, obtenido) values ('status_events inmutable (incluso superuser)', 'ERR', 'ERR: ' || sqlerrm);
end $$;
select pg_temp.t('Eventos registrados', :OWNER, $$ select count(*)::text from public.status_events $$, '1');

-- ---------- Baja de miembro ----------
select pg_temp.t('SA da de baja a Juan', :SA2, format($$ select public.remove_member(%L, %L)::text $$, (select v from ctx where k='obra'), :JUAN), 'OK');
select pg_temp.t('Juan dado de baja ya no ve la obra', :JUAN, $$ select count(*)::text from public.obras $$, '0');

-- ---------- Login por PIN (service_role) ----------
select pg_temp.t('Authenticated NO ejecuta verify_worker_pin', :PEPE, $$ select public.verify_worker_pin('W-00000','1234')::text $$, 'ERR');
do $$
declare code text; r jsonb; i int;
begin
  code := public.set_worker_pin('00000000-0000-0000-0000-00000000000e', '4321');
  r := public.verify_worker_pin(code, '4321');
  insert into results (caso, esperado, obtenido) values ('PIN correcto', 'ok', r->>'status');
  for i in 1..5 loop r := public.verify_worker_pin(code, '0000'); end loop;
  r := public.verify_worker_pin(code, '4321');
  insert into results (caso, esperado, obtenido) values ('Bloqueo tras 5 fallos (aun con PIN bueno)', 'locked', r->>'status');
  r := public.verify_worker_pin('W-99999', '4321');
  insert into results (caso, esperado, obtenido) values ('Código inexistente → respuesta genérica', 'invalid', r->>'status');
end $$;

-- ---------- Resultado ----------
select n, case when obtenido like esperado || '%' then '✅' else '❌' end as ok, caso, left(obtenido, 90) as obtenido
from results order by n;
select count(*) filter (where obtenido like esperado || '%') as pasan,
       count(*) filter (where obtenido not like esperado || '%') as fallan
from results;
