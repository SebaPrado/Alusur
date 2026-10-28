-- =====================================================================
-- admin_10_cuentas_corrientes.sql
-- Cuentas corrientes con empresas: proveedores (ALUMAN) y clientes (Cipriani).
--
-- Idea para no-contadores:
--   * FACTURA        → crea deuda. No mueve plata.
--   * NOTA DE CRÉDITO→ achica una deuda (ej. ALUMAN descuenta módulos dañados).
--   * PAGO           → plata que va o viene; achica la deuda.
--
--   lado = 'compra'  (la empresa nos vende: proveedor)
--   lado = 'venta'   (nosotros le vendemos: cliente)
--
-- SALDO por empresa y moneda (nunca se mezclan pesos y dólares):
--   > 0  → la empresa NOS DEBE
--   < 0  → NOSOTROS LE DEBEMOS
--   = 0  → están a mano
--
--   venta:  factura +   nota_credito −   pago (cobro) −
--   compra: factura −   nota_credito +   pago         +
--
-- Los clientes de mostrador de Los Ceibos siguen en admin_customers (no cambia
-- nada). Esto es para empresas con las que hay facturas y pagos de por medio.
--
-- Nada se borra: los movimientos se ANULAN con motivo.
-- Ejecutar en byfdrcdiqwlbaldewikg: pegar TODO → Run.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Empresas con las que hay vínculo económico
-- ---------------------------------------------------------------------
create table public.admin_contrapartes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations (id),
  nombre          text not null check (btrim(nombre) <> ''),
  es_proveedor    boolean not null default false,
  es_cliente      boolean not null default false,
  empresa_id      uuid references public.empresas (id),   -- opcional: la misma empresa en Construcción
  rut             text,
  contacto        text,
  notas           text,
  activa          boolean not null default true,
  created_by      uuid references auth.users (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (organization_id, nombre),
  unique (id, organization_id),
  check (es_proveedor or es_cliente)
);

-- ---------------------------------------------------------------------
-- 2. Movimientos (facturas, notas de crédito, pagos)
-- ---------------------------------------------------------------------
create table public.admin_cc_movimientos (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contraparte_id  uuid not null,
  lado            text not null check (lado in ('compra', 'venta')),
  tipo            text not null check (tipo in ('factura', 'nota_credito', 'pago')),
  moneda          text not null check (moneda in ('UYU', 'USD')),
  importe         numeric(14,2) not null check (importe > 0),
  fecha           date not null default current_date,
  vencimiento     date,                 -- solo facturas
  numero          text,                 -- nº de factura / nota / comprobante
  concepto        text,
  medio           text check (medio in ('transferencia', 'efectivo', 'cheque', 'otro')),  -- solo pagos
  obra_id         uuid references public.obras (id),   -- opcional: a qué obra corresponde
  anulado         boolean not null default false,
  anulado_motivo  text,
  anulado_por     uuid references auth.users (id),
  anulado_at      timestamptz,
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  foreign key (contraparte_id, organization_id)
    references public.admin_contrapartes (id, organization_id),
  check (tipo = 'factura' or vencimiento is null),
  check (tipo = 'pago' or medio is null),
  check (vencimiento is null or vencimiento >= fecha),
  check (not anulado or (anulado_motivo is not null and anulado_at is not null))
);
create index admin_cc_mov_contraparte_idx on public.admin_cc_movimientos (contraparte_id, fecha, created_at);
create index admin_cc_mov_org_idx         on public.admin_cc_movimientos (organization_id, fecha desc);

-- Efecto de un movimiento sobre el saldo (positivo = nos deben más)
create function public.admin_cc_signo(p_lado text, p_tipo text)
returns int language sql immutable set search_path = '' as $$
  select case
    when p_lado = 'venta'  and p_tipo = 'factura' then  1
    when p_lado = 'venta'                         then -1   -- nota de crédito o cobro
    when p_lado = 'compra' and p_tipo = 'factura' then -1
    else 1                                                  -- compra: nota de crédito o pago
  end;
$$;

-- ---------------------------------------------------------------------
-- 3. RLS: todos los miembros miran; escribir es solo dueño/admin y vía RPC
-- ---------------------------------------------------------------------
alter table public.admin_contrapartes   enable row level security;
alter table public.admin_cc_movimientos enable row level security;

create policy "ver contrapartes" on public.admin_contrapartes
  for select to authenticated using (public.admin_has_role(organization_id));

create policy "ver movimientos cc" on public.admin_cc_movimientos
  for select to authenticated using (public.admin_has_role(organization_id));

-- sin políticas de insert/update/delete: todo pasa por las funciones de abajo
revoke insert, update, delete on public.admin_contrapartes, public.admin_cc_movimientos from anon, authenticated;
grant select on public.admin_contrapartes, public.admin_cc_movimientos to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------

-- Crear o editar empresa (p_id null = crear)
create function public.admin_cc_guardar_contraparte(
  p_organization_id uuid,
  p_nombre          text,
  p_es_proveedor    boolean,
  p_es_cliente      boolean,
  p_rut             text default null,
  p_contacto        text default null,
  p_notas           text default null,
  p_id              uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not admin_has_role(p_organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden gestionar empresas' using errcode = '42501';
  end if;
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if not (coalesce(p_es_proveedor, false) or coalesce(p_es_cliente, false)) then
    raise exception 'Marcá si es proveedor, cliente o ambos';
  end if;

  if p_id is null then
    insert into admin_contrapartes (organization_id, nombre, es_proveedor, es_cliente, rut, contacto, notas)
    values (p_organization_id, btrim(p_nombre), p_es_proveedor, p_es_cliente,
            nullif(btrim(p_rut), ''), nullif(btrim(p_contacto), ''), nullif(btrim(p_notas), ''))
    returning id into v_id;
  else
    -- no se puede quitar un lado si ya tiene movimientos de ese lado
    if not p_es_proveedor and exists (select 1 from admin_cc_movimientos
        where contraparte_id = p_id and lado = 'compra' and not anulado) then
      raise exception 'Tiene compras registradas: no puede dejar de ser proveedor';
    end if;
    if not p_es_cliente and exists (select 1 from admin_cc_movimientos
        where contraparte_id = p_id and lado = 'venta' and not anulado) then
      raise exception 'Tiene ventas registradas: no puede dejar de ser cliente';
    end if;

    update admin_contrapartes
       set nombre = btrim(p_nombre), es_proveedor = p_es_proveedor, es_cliente = p_es_cliente,
           rut = nullif(btrim(p_rut), ''), contacto = nullif(btrim(p_contacto), ''), notas = nullif(btrim(p_notas), '')
     where id = p_id and organization_id = p_organization_id
    returning id into v_id;
    if v_id is null then raise exception 'Empresa no encontrada'; end if;
  end if;
  return v_id;
end $$;

-- Registrar factura / nota de crédito / pago
create function public.admin_cc_registrar(
  p_contraparte_id uuid,
  p_lado           text,
  p_tipo           text,
  p_moneda         text,
  p_importe        numeric,
  p_fecha          date default current_date,
  p_vencimiento    date default null,
  p_numero         text default null,
  p_concepto       text default null,
  p_medio          text default null,
  p_obra_id        uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_c       admin_contrapartes%rowtype;
  v_empresa uuid;
  v_id      uuid;
begin
  select * into v_c from admin_contrapartes where id = p_contraparte_id;
  if not found then raise exception 'Empresa no encontrada'; end if;

  if not admin_has_role(v_c.organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin registran facturas y pagos' using errcode = '42501';
  end if;
  if not v_c.activa then raise exception 'La empresa está archivada'; end if;
  if p_lado = 'compra' and not v_c.es_proveedor then
    raise exception '% no está marcada como proveedor', v_c.nombre;
  end if;
  if p_lado = 'venta' and not v_c.es_cliente then
    raise exception '% no está marcada como cliente', v_c.nombre;
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe tiene que ser mayor que cero';
  end if;
  if p_tipo = 'pago' and p_medio is null then
    raise exception 'Indicá el medio de pago';
  end if;

  -- la obra tiene que ser de la empresa de Construcción vinculada a esta organización
  if p_obra_id is not null then
    select empresa_id into v_empresa from admin_organizations where id = v_c.organization_id;
    if v_empresa is null or not exists (
      select 1 from obra_empresas where obra_id = p_obra_id and empresa_id = v_empresa
    ) then
      raise exception 'Esa obra no pertenece a esta empresa';
    end if;
  end if;

  insert into admin_cc_movimientos (
    organization_id, contraparte_id, lado, tipo, moneda, importe, fecha,
    vencimiento, numero, concepto, medio, obra_id, created_by)
  values (
    v_c.organization_id, v_c.id, p_lado, p_tipo, p_moneda, round(p_importe, 2),
    coalesce(p_fecha, current_date),
    case when p_tipo = 'factura' then p_vencimiento end,
    nullif(btrim(p_numero), ''), nullif(btrim(p_concepto), ''),
    case when p_tipo = 'pago' then p_medio end,
    p_obra_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Anular (nunca borrar)
create function public.admin_cc_anular(p_movimiento_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_m admin_cc_movimientos%rowtype;
begin
  select * into v_m from admin_cc_movimientos where id = p_movimiento_id for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if not admin_has_role(v_m.organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden anular' using errcode = '42501';
  end if;
  if v_m.anulado then raise exception 'Ya está anulado'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'El motivo es obligatorio'; end if;

  update admin_cc_movimientos
     set anulado = true, anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_movimiento_id;
end $$;

-- Archivar / reactivar empresa (no se borra: tiene historia)
create function public.admin_cc_archivar_contraparte(p_id uuid, p_activa boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from admin_contrapartes where id = p_id;
  if v_org is null then raise exception 'Empresa no encontrada'; end if;
  if not admin_has_role(v_org, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin' using errcode = '42501';
  end if;
  update admin_contrapartes set activa = coalesce(p_activa, false) where id = p_id;
end $$;

-- Obras disponibles para asociar facturas (las de la empresa vinculada)
create function public.admin_cc_obras(p_organization_id uuid)
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select o.id, o.nombre
  from admin_organizations org
  join obra_empresas oe on oe.empresa_id = org.empresa_id
  join obras o          on o.id = oe.obra_id
  where org.id = p_organization_id
    and admin_has_role(p_organization_id)
  order by o.nombre;
$$;

-- ---------------------------------------------------------------------
-- 5. Vistas (respetan RLS)
-- ---------------------------------------------------------------------

-- Saldo por empresa + cuánto está VENCIDO
-- Vencido (criterio simple y estándar): los pagos y notas cancelan primero
-- las facturas más viejas.
create view public.admin_cc_saldos with (security_invoker = true) as
with m as (
  select contraparte_id, lado, tipo, moneda, importe, vencimiento,
         admin_cc_signo(lado, tipo) * importe as efecto
  from public.admin_cc_movimientos
  where not anulado
),
por_lado as (
  select contraparte_id, lado, moneda,
         sum(importe) filter (where tipo = 'factura')                              as facturado,
         sum(importe) filter (where tipo = 'factura' and vencimiento < current_date) as facturado_vencido,
         coalesce(sum(importe) filter (where tipo <> 'factura'), 0)                as cancelado
  from m group by contraparte_id, lado, moneda
),
vencido as (
  select contraparte_id, moneda,
         sum(greatest(0, coalesce(facturado_vencido, 0) - cancelado)) filter (where lado = 'venta')  as vencido_a_cobrar,
         sum(greatest(0, coalesce(facturado_vencido, 0) - cancelado)) filter (where lado = 'compra') as vencido_a_pagar
  from por_lado group by contraparte_id, moneda
),
saldo as (
  select contraparte_id, moneda, sum(efecto) as saldo
  from m group by contraparte_id, moneda
)
select
  c.organization_id,
  c.id as contraparte_id,
  c.nombre,
  c.es_proveedor,
  c.es_cliente,
  c.activa,
  coalesce((select saldo from saldo where contraparte_id = c.id and moneda = 'UYU'), 0) as saldo_uyu,
  coalesce((select saldo from saldo where contraparte_id = c.id and moneda = 'USD'), 0) as saldo_usd,
  coalesce((select vencido_a_cobrar from vencido where contraparte_id = c.id and moneda = 'UYU'), 0) as vencido_a_cobrar_uyu,
  coalesce((select vencido_a_cobrar from vencido where contraparte_id = c.id and moneda = 'USD'), 0) as vencido_a_cobrar_usd,
  coalesce((select vencido_a_pagar  from vencido where contraparte_id = c.id and moneda = 'UYU'), 0) as vencido_a_pagar_uyu,
  coalesce((select vencido_a_pagar  from vencido where contraparte_id = c.id and moneda = 'USD'), 0) as vencido_a_pagar_usd,
  (select min(mv.vencimiento) from public.admin_cc_movimientos mv
    where mv.contraparte_id = c.id and not mv.anulado and mv.tipo = 'factura'
      and mv.vencimiento >= current_date) as proximo_vencimiento
from public.admin_contrapartes c;

-- Estado de cuenta: una fila por movimiento con saldo acumulado (como el banco)
create view public.admin_cc_estado with (security_invoker = true) as
select
  mv.*,
  c.nombre as contraparte,
  o.nombre as obra,
  case when mv.anulado then 0 else admin_cc_signo(mv.lado, mv.tipo) * mv.importe end as efecto,
  sum(case when mv.anulado then 0 else admin_cc_signo(mv.lado, mv.tipo) * mv.importe end)
    over (partition by mv.contraparte_id, mv.moneda order by mv.fecha, mv.created_at, mv.id) as saldo_acumulado
from public.admin_cc_movimientos mv
join public.admin_contrapartes c on c.id = mv.contraparte_id
left join public.obras o         on o.id = mv.obra_id;

-- Resumen de la organización: los números grandes de la pantalla de inicio
create view public.admin_cc_resumen with (security_invoker = true) as
select
  organization_id,
  sum(greatest(saldo_uyu, 0))  as nos_deben_uyu,
  sum(greatest(saldo_usd, 0))  as nos_deben_usd,
  sum(greatest(-saldo_uyu, 0)) as debemos_uyu,
  sum(greatest(-saldo_usd, 0)) as debemos_usd,
  sum(vencido_a_cobrar_uyu)    as vencido_a_cobrar_uyu,
  sum(vencido_a_cobrar_usd)    as vencido_a_cobrar_usd,
  sum(vencido_a_pagar_uyu)     as vencido_a_pagar_uyu,
  sum(vencido_a_pagar_usd)     as vencido_a_pagar_usd
from public.admin_cc_saldos
group by organization_id;

grant select on public.admin_cc_saldos, public.admin_cc_estado, public.admin_cc_resumen to authenticated;

-- ---------------------------------------------------------------------
-- 6. Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on function public.admin_cc_guardar_contraparte(uuid, text, boolean, boolean, text, text, text, uuid) from public, anon;
revoke all on function public.admin_cc_registrar(uuid, text, text, text, numeric, date, date, text, text, text, uuid) from public, anon;
revoke all on function public.admin_cc_anular(uuid, text) from public, anon;
revoke all on function public.admin_cc_archivar_contraparte(uuid, boolean) from public, anon;
revoke all on function public.admin_cc_obras(uuid) from public, anon;

grant execute on function public.admin_cc_signo(text, text) to authenticated;
grant execute on function public.admin_cc_guardar_contraparte(uuid, text, boolean, boolean, text, text, text, uuid) to authenticated;
grant execute on function public.admin_cc_registrar(uuid, text, text, text, numeric, date, date, text, text, text, uuid) to authenticated;
grant execute on function public.admin_cc_anular(uuid, text) to authenticated;
grant execute on function public.admin_cc_archivar_contraparte(uuid, boolean) to authenticated;
grant execute on function public.admin_cc_obras(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
