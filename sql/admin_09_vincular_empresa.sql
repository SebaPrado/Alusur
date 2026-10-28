-- =====================================================================
-- admin_09_vincular_empresa.sql
-- Una empresa, dos secciones: vincula una organización de Administración
-- con la empresa de Construcción que representa.
--
--   empresas (Construcción)  1 ─── 0..1  admin_organizations (Administración)
--
-- * Vincula DATOS, no permisos: ser CEO en Construcción sigue sin dar
--   nada en Administración. Los roles se asignan explícitamente en cada lado.
-- * Es opcional: ALUMAN es empresa en Construcción y no tiene Administración;
--   Los Ceibos tiene Administración y no participa en obras.
--
-- Ejecutar en el proyecto byfdrcdiqwlbaldewikg: pegar TODO → Run.
-- =====================================================================
begin;

-- 1. El vínculo (como mucho una organización por empresa y viceversa)
alter table public.admin_organizations
  add column if not exists empresa_id uuid unique references public.empresas (id);

-- 2. Organización de Alusur, vinculada a la empresa existente, con Ricardo como dueño
do $$
declare
  v_empresa uuid := '6cdeca3b-95dc-4084-a600-37aa5f86d1d0';  -- empresas: Alusur
  v_ricardo uuid := 'a7c2d371-2dab-444a-8cab-eac52dc5563d';  -- Ricardo Prado
  v_org     uuid;
begin
  if not exists (select 1 from public.empresas where id = v_empresa) then
    raise exception 'No existe la empresa Alusur con ese id';
  end if;
  if not exists (select 1 from auth.users where id = v_ricardo) then
    raise exception 'No existe el usuario de Ricardo con ese id';
  end if;

  select id into v_org from public.admin_organizations where empresa_id = v_empresa;

  if v_org is null then
    -- datos fiscales provisorios: se completan después desde la app
    insert into public.admin_organizations (name, legal_name, tax_id, address, phone, empresa_id)
    values ('Alusur', 'Alusur (completar razón social)', '000000000000', '(completar)', '(completar)', v_empresa)
    returning id into v_org;
  end if;

  insert into public.admin_members (organization_id, user_id, role, display_name, active)
  values (v_org, v_ricardo, 'dueno', 'Ricardo Prado', true)
  on conflict do nothing;

  raise notice 'Organización Alusur: %', v_org;
end $$;

-- 3. Comprobación
select o.name as organizacion, e.nombre as empresa_construccion, m.display_name, m.role
from public.admin_organizations o
left join public.empresas e      on e.id = o.empresa_id
left join public.admin_members m on m.organization_id = o.id
order by o.name, m.role;

commit;
