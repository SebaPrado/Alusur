-- =====================================================================
-- ÁREA ADMINISTRACIÓN — Script 01: esquema base, seguridad y operaciones
-- Bimoneda UYU / USD
-- Ejecutar completo en Supabase → SQL Editor (una sola vez)
--
-- Reglas de moneda:
--   * Cada producto tiene su precio en UNA moneda (UYU o USD).
--   * Cada venta se hace en UNA moneda; si un producto está en la otra,
--     se convierte con la cotización vigente y la cotización queda grabada.
--   * Un pago puede hacerse en cualquier moneda: se guarda lo que entró
--     físicamente (moneda + importe) y lo que cancela de la deuda
--     (moneda de la deuda + importe aplicado).
--   * Las deudas de clientes se llevan POR MONEDA: quien debe dólares
--     debe dólares. Nunca se mezclan en un único saldo.
--   * La caja física tiene dos cajones: se abre, se espera y se cuenta
--     por separado en UYU y en USD.
--   * Cotización = pesos por 1 dólar, cargada por dueño/admin.
--
-- Otros supuestos (corregibles):
--   * Precios con IVA incluido.
--   * Stock en numeric(14,3): las raciones se venden por kg/fracción.
--   * Se permite stock negativo por defecto (configurable).
--   * Toda venta/pago exige una caja abierta en la terminal (PC).
--   * Los vendedores ven todas las ventas y clientes, pero solo SUS cajas.
--   * Anular ventas y cargar cotización: solo 'dueno' y 'admin'.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() no es IMMUTABLE; este wrapper sí, para poder indexarlo
create or replace function public.admin_unaccent(text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- Conversión entre monedas. p_rate = pesos por 1 dólar.
create or replace function public.admin_convert(
  p_amount numeric, p_from text, p_to text, p_rate numeric
)
returns numeric
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_from = p_to then return p_amount; end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'No hay cotización del dólar cargada';
  end if;
  if p_from = 'USD' and p_to = 'UYU' then return round(p_amount * p_rate, 2); end if;
  if p_from = 'UYU' and p_to = 'USD' then return round(p_amount / p_rate, 2); end if;
  raise exception 'Conversión no soportada: % → %', p_from, p_to;
end;
$$;

-- =====================================================================
-- 1. ORGANIZACIONES (tenants) Y MIEMBROS
-- =====================================================================

create table public.admin_organizations (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  legal_name           text,
  tax_id               text,                         -- RUT
  address              text,
  phone                text,
  email                text,
  logo_url             text,
  allow_negative_stock boolean not null default true,
  receipt_footer       text not null default 'Control interno - No válido como factura DGI',
  next_sale_number     bigint not null default 1,    -- correlativo sin huecos
  created_at           timestamptz not null default now()
);

create table public.admin_members (
  organization_id uuid not null references public.admin_organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('dueno', 'admin', 'vendedor')),
  display_name    text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index admin_members_user_idx on public.admin_members(user_id);

-- SECURITY DEFINER para que las políticas RLS no entren en recursión
create or replace function public.admin_has_role(
  p_organization_id uuid,
  p_roles text[] default array['dueno', 'admin', 'vendedor']
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role = any (p_roles)
  );
$$;

-- Historial de cotizaciones (nunca se pisa: cada cambio es una fila nueva)
create table public.admin_exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  rate            numeric(12,4) not null check (rate > 0),   -- UYU por 1 USD
  valid_from      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index admin_exchange_rates_org_idx on public.admin_exchange_rates(organization_id, valid_from desc);

create or replace function public.admin_current_rate(p_organization_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select r.rate from public.admin_exchange_rates r
   where r.organization_id = p_organization_id and r.valid_from <= now()
   order by r.valid_from desc
   limit 1;
$$;

-- =====================================================================
-- 2. DATOS MAESTROS
-- =====================================================================

-- Terminal = PC / punto de caja físico ("Caja 1", "Mostrador", "Sucursal")
create table public.admin_terminals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  name            text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.admin_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  name            text not null,                     -- Veterinaria, Raciones, Ropa, Talabartería...
  unique (organization_id, name)
);

create table public.admin_products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  category_id     uuid references public.admin_categories(id),
  sku             text,
  barcode         text,
  name            text not null,
  unit            text not null default 'unidad',    -- unidad, kg, bolsa, litro...
  currency        text not null default 'UYU' check (currency in ('UYU', 'USD')),
  price           numeric(14,2) not null check (price >= 0),   -- IVA incluido, en "currency"
  cost            numeric(14,2) check (cost >= 0),             -- en la misma moneda que price
  iva_rate        numeric(5,2) not null default 22 check (iva_rate >= 0),
  stock           numeric(14,3) not null default 0,  -- caché; la verdad está en admin_stock_movements
  min_stock       numeric(14,3),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index admin_products_sku_uq     on public.admin_products(organization_id, sku)     where sku is not null;
create unique index admin_products_barcode_uq on public.admin_products(organization_id, barcode) where barcode is not null;
create index admin_products_name_trgm on public.admin_products
  using gin (public.admin_unaccent(lower(name)) extensions.gin_trgm_ops);

create table public.admin_customers (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.admin_organizations(id),
  name                  text not null,
  doc_type              text check (doc_type in ('CI', 'RUT', 'OTRO')),
  doc_number            text,
  phone                 text,
  email                 text,
  address               text,
  notes                 text,
  credit_limit          numeric(14,2) check (credit_limit >= 0),   -- null = sin límite
  credit_limit_currency text not null default 'USD' check (credit_limit_currency in ('UYU', 'USD')),
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check ((doc_type is null) = (doc_number is null))
);
create unique index admin_customers_doc_uq on public.admin_customers(organization_id, doc_type, doc_number)
  where doc_number is not null;
create index admin_customers_name_trgm on public.admin_customers
  using gin (public.admin_unaccent(lower(name)) extensions.gin_trgm_ops);

-- =====================================================================
-- 3. CAJA (dos cajones: UYU y USD)
-- =====================================================================

create table public.admin_cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  terminal_id     uuid not null references public.admin_terminals(id),
  opened_by       uuid not null references auth.users(id),
  opened_at       timestamptz not null default now(),
  opening_uyu     numeric(14,2) not null default 0 check (opening_uyu >= 0),
  opening_usd     numeric(14,2) not null default 0 check (opening_usd >= 0),
  status          text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  closed_by       uuid references auth.users(id),
  closed_at       timestamptz,
  expected_uyu    numeric(14,2),
  expected_usd    numeric(14,2),
  counted_uyu     numeric(14,2),
  counted_usd     numeric(14,2),
  difference_uyu  numeric(14,2),
  difference_usd  numeric(14,2),
  closing_notes   text
);
create unique index admin_cash_sessions_one_open_per_terminal
  on public.admin_cash_sessions(terminal_id) where status = 'abierta';

-- Movimientos manuales de efectivo (retiros, pagos a proveedor, ingresos manuales)
create table public.admin_cash_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  cash_session_id uuid not null references public.admin_cash_sessions(id),
  direction       text not null check (direction in ('ingreso', 'egreso')),
  reason          text not null check (reason in (
                    'retiro_socio', 'pago_proveedor', 'flete', 'sueldo_adelanto',
                    'gastos', 'ingreso_manual', 'otro')),
  currency        text not null check (currency in ('UYU', 'USD')),
  amount          numeric(14,2) not null check (amount > 0),
  notes           text,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  check (reason <> 'otro' or length(trim(coalesce(notes, ''))) > 0)
);
create index admin_cash_movements_session_idx on public.admin_cash_movements(cash_session_id);

-- =====================================================================
-- 4. VENTAS, PAGOS Y STOCK
-- =====================================================================

create table public.admin_sales (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.admin_organizations(id),
  number           bigint not null,
  kind             text not null default 'venta' check (kind in ('venta', 'devolucion')),
  original_sale_id uuid references public.admin_sales(id),          -- para devoluciones
  customer_id      uuid references public.admin_customers(id),      -- null = consumidor final
  seller_id        uuid not null references auth.users(id),
  terminal_id      uuid not null references public.admin_terminals(id),
  cash_session_id  uuid not null references public.admin_cash_sessions(id),
  condition        text not null check (condition in ('contado', 'credito')),
  status           text not null default 'completada' check (status in ('completada', 'anulada')),
  currency         text not null check (currency in ('UYU', 'USD')),
  exchange_rate    numeric(12,4),            -- cotización vigente al vender (histórico)
  subtotal         numeric(14,2) not null,   -- sin IVA, en "currency"
  tax_total        numeric(14,2) not null,
  total            numeric(14,2) not null,   -- con IVA, en "currency"
  notes            text,
  voided_at        timestamptz,
  voided_by        uuid references auth.users(id),
  void_reason      text,
  -- Reservado para facturación electrónica DGI (CFE) más adelante
  cfe_type         text,
  cfe_series       text,
  cfe_number       bigint,
  created_at       timestamptz not null default now(),
  unique (organization_id, number),
  check (condition = 'contado' or customer_id is not null),
  check (kind = 'venta' or original_sale_id is not null)
);
create index admin_sales_org_created_idx on public.admin_sales(organization_id, created_at desc);
create index admin_sales_customer_idx    on public.admin_sales(customer_id);
create index admin_sales_session_idx     on public.admin_sales(cash_session_id);

create table public.admin_sale_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  sale_id         uuid not null references public.admin_sales(id),
  product_id      uuid not null references public.admin_products(id),
  description     text not null,                 -- foto del nombre al momento de vender
  quantity        numeric(14,3) not null check (quantity > 0),
  list_currency   text not null,                 -- moneda de lista del producto
  list_price      numeric(14,2) not null,        -- precio de lista en esa moneda
  unit_price      numeric(14,2) not null check (unit_price >= 0),   -- en moneda de la venta
  iva_rate        numeric(5,2) not null,
  line_total      numeric(14,2) not null         -- en moneda de la venta
);
create index admin_sale_items_sale_idx    on public.admin_sale_items(sale_id);
create index admin_sale_items_product_idx on public.admin_sale_items(product_id);

-- Todo dinero que entra o sale ligado a clientes/ventas.
--   currency/amount                  = lo que entró o salió físicamente
--   applied_currency/applied_amount  = lo que cancela de la deuda
-- kind 'vuelto' = cambio entregado en efectivo (ej.: paga USD, vuelto en pesos)
create table public.admin_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.admin_organizations(id),
  kind             text not null check (kind in ('venta', 'vuelto', 'cobranza', 'reintegro')),
  sale_id          uuid references public.admin_sales(id),
  customer_id      uuid references public.admin_customers(id),
  cash_session_id  uuid not null references public.admin_cash_sessions(id),
  method           text not null check (method in ('efectivo', 'transferencia', 'pos_debito', 'pos_credito')),
  currency         text not null check (currency in ('UYU', 'USD')),
  amount           numeric(14,2) not null check (amount > 0),
  applied_currency text not null check (applied_currency in ('UYU', 'USD')),
  applied_amount   numeric(14,2) not null check (applied_amount > 0),
  exchange_rate    numeric(12,4),
  reference        text,                          -- nº transferencia / voucher POS
  notes            text,
  status           text not null default 'vigente' check (status in ('vigente', 'anulado')),
  received_by      uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  check (kind <> 'cobranza' or customer_id is not null),
  check (kind = 'cobranza' or sale_id is not null),
  check (kind <> 'vuelto' or method = 'efectivo'),
  check (currency = applied_currency or exchange_rate is not null)
);
create index admin_payments_sale_idx     on public.admin_payments(sale_id);
create index admin_payments_customer_idx on public.admin_payments(customer_id);
create index admin_payments_session_idx  on public.admin_payments(cash_session_id);

-- Libro de stock: cada cambio de stock deja una fila
create table public.admin_stock_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.admin_organizations(id),
  product_id      uuid not null references public.admin_products(id),
  quantity        numeric(14,3) not null check (quantity <> 0),   -- con signo
  stock_after     numeric(14,3) not null,
  reason          text not null check (reason in ('venta', 'devolucion', 'compra', 'ajuste', 'anulacion')),
  sale_id         uuid references public.admin_sales(id),
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index admin_stock_movements_product_idx on public.admin_stock_movements(product_id, created_at desc);

-- =====================================================================
-- 5. AUDITORÍA
-- =====================================================================

create table public.admin_audit_log (
  id              bigint generated always as identity primary key,
  organization_id uuid,
  user_id         uuid,
  terminal_id     text,          -- header x-terminal-id que manda el front
  ip              text,
  user_agent      text,
  action          text not null,
  table_name      text not null,
  record_id       uuid,
  old_data        jsonb,
  new_data        jsonb,
  created_at      timestamptz not null default now()
);
create index admin_audit_log_org_created_idx on public.admin_audit_log(organization_id, created_at desc);

create or replace function public.admin_audit_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_row     jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.admin_audit_log
    (organization_id, user_id, terminal_id, ip, user_agent, action, table_name, record_id, old_data, new_data)
  values (
    coalesce(v_row->>'organization_id',
             case when tg_table_name = 'admin_organizations' then v_row->>'id' end)::uuid,
    auth.uid(),
    v_headers->>'x-terminal-id',
    coalesce(v_headers->>'cf-connecting-ip',
             nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), '')),
    v_headers->>'user-agent',
    tg_op,
    tg_table_name,
    (v_row->>'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'admin_organizations', 'admin_members', 'admin_exchange_rates', 'admin_terminals',
    'admin_products', 'admin_customers', 'admin_cash_sessions', 'admin_cash_movements',
    'admin_sales', 'admin_payments'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.admin_audit_trigger()',
      t || '_audit', t);
  end loop;
end $$;

create or replace function public.admin_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger admin_products_updated_at  before update on public.admin_products
  for each row execute function public.admin_set_updated_at();
create trigger admin_customers_updated_at before update on public.admin_customers
  for each row execute function public.admin_set_updated_at();

-- =====================================================================
-- 6. VISTAS (security_invoker → respetan RLS del usuario)
-- =====================================================================

-- Saldo de cuenta corriente por cliente, SEPARADO por moneda.
-- Ventas suman deuda en su moneda; pagos restan en la moneda que cancelan.
-- "Entrega a cuenta" = venta a crédito con pago parcial: no necesita tipo propio.
create view public.admin_customer_balances
with (security_invoker = true) as
with charges as (
  select customer_id, currency,
         sum(case when kind = 'venta' then total else -total end) as amount
    from public.admin_sales
   where status = 'completada' and customer_id is not null
   group by customer_id, currency
),
paid as (
  select customer_id, applied_currency as currency,
         sum(case when kind in ('vuelto', 'reintegro') then -applied_amount else applied_amount end) as amount
    from public.admin_payments
   where status = 'vigente' and customer_id is not null
   group by customer_id, applied_currency
)
select
  c.organization_id,
  c.id   as customer_id,
  c.name,
  c.credit_limit,
  c.credit_limit_currency,
  coalesce((select amount from charges where customer_id = c.id and currency = 'UYU'), 0)
    - coalesce((select amount from paid where customer_id = c.id and currency = 'UYU'), 0) as balance_uyu,
  coalesce((select amount from charges where customer_id = c.id and currency = 'USD'), 0)
    - coalesce((select amount from paid where customer_id = c.id and currency = 'USD'), 0) as balance_usd
from public.admin_customers c;

-- Planilla maestra: UNA fila por operación (venta, cobranza, movimiento de caja,
-- apertura y cierre) con el efectivo de cada cajón (UYU / USD) calculado, no guardado.
-- El saldo arranca en la fila de apertura (su delta es el fondo) y el cierre no lo mueve.
create view public.admin_ledger
with (security_invoker = true) as
with cash as (
  -- efecto de cada pago en efectivo sobre los cajones
  select p.id, p.sale_id, p.kind,
         case when p.currency = 'UYU' then sgn * p.amount else 0 end as d_uyu,
         case when p.currency = 'USD' then sgn * p.amount else 0 end as d_usd
    from public.admin_payments p,
         lateral (select case when p.kind in ('vuelto', 'reintegro') then -1 else 1 end as sgn) s
   where p.method = 'efectivo' and p.status = 'vigente'
),
events as (
  select
    s.organization_id, s.created_at, s.kind as event_type, s.id as ref_id, s.number,
    s.customer_id, s.seller_id as user_id, s.terminal_id, s.cash_session_id,
    s.condition, s.status, s.currency, s.total as amount, s.exchange_rate,
    (select string_agg(i.description || ' x' || trim_scale(i.quantity)::text, ', ' order by i.description)
       from public.admin_sale_items i where i.sale_id = s.id) as detail,
    (select string_agg(distinct p.method || ' ' || p.currency, ' + ')
       from public.admin_payments p
      where p.sale_id = s.id and p.status = 'vigente' and p.kind = 'venta') as payment_methods,
    coalesce((select sum(d_uyu) from cash where cash.sale_id = s.id), 0) as cash_delta_uyu,
    coalesce((select sum(d_usd) from cash where cash.sale_id = s.id), 0) as cash_delta_usd
  from public.admin_sales s
  union all
  select
    p.organization_id, p.created_at, 'cobranza', p.id, null,
    p.customer_id, p.received_by, cs.terminal_id, p.cash_session_id,
    null, p.status, p.currency, p.amount, p.exchange_rate,
    p.notes, p.method || ' ' || p.currency,
    coalesce(c.d_uyu, 0), coalesce(c.d_usd, 0)
  from public.admin_payments p
  join public.admin_cash_sessions cs on cs.id = p.cash_session_id
  left join cash c on c.id = p.id
  where p.kind = 'cobranza'
  union all
  select
    m.organization_id, m.created_at, m.reason, m.id, null,
    null, m.created_by, cs.terminal_id, m.cash_session_id,
    null, 'vigente', m.currency, m.amount, null,
    m.notes, 'efectivo ' || m.currency,
    case when m.currency = 'UYU' then (case when m.direction = 'ingreso' then 1 else -1 end) * m.amount else 0 end,
    case when m.currency = 'USD' then (case when m.direction = 'ingreso' then 1 else -1 end) * m.amount else 0 end
  from public.admin_cash_movements m
  join public.admin_cash_sessions cs on cs.id = m.cash_session_id
  union all
  select
    cs.organization_id, cs.opened_at, 'apertura_caja', cs.id, null::bigint,
    null::uuid, cs.opened_by, cs.terminal_id, cs.id,
    null::text, 'abierta', null::text, null::numeric(14,2), null::numeric(12,4),
    'Fondo $ ' || trim(to_char(cs.opening_uyu, 'FM999999990.00'))
      || ' · U$S ' || trim(to_char(cs.opening_usd, 'FM999999990.00')),
    null::text,
    cs.opening_uyu, cs.opening_usd
  from public.admin_cash_sessions cs
  union all
  select
    cs.organization_id, cs.closed_at, 'cierre_caja', cs.id, null::bigint,
    null::uuid, cs.closed_by, cs.terminal_id, cs.id,
    null::text, 'cerrada', null::text, null::numeric(14,2), null::numeric(12,4),
    'Contado $ ' || trim(to_char(cs.counted_uyu, 'FM999999990.00'))
      || ' (esperado $ ' || trim(to_char(cs.expected_uyu, 'FM999999990.00'))
      || ', dif. $ ' || trim(to_char(cs.difference_uyu, 'FM999999990.00'))
      || ') · U$S ' || trim(to_char(cs.counted_usd, 'FM999999990.00'))
      || ' (esperado ' || trim(to_char(cs.expected_usd, 'FM999999990.00'))
      || ', dif. ' || trim(to_char(cs.difference_usd, 'FM999999990.00')) || ')'
      || case
           when length(trim(coalesce(cs.closing_notes, ''))) > 0
           then ' · ' || cs.closing_notes
           else ''
         end,
    null::text,
    null::numeric, null::numeric
  from public.admin_cash_sessions cs
  where cs.closed_at is not null
)
select
  e.*,
  c.name          as customer_name,
  mb.display_name as user_name,
  t.name          as terminal_name,
  sum(e.cash_delta_uyu) over w as cash_balance_uyu,
  sum(e.cash_delta_usd) over w as cash_balance_usd
from events e
left join public.admin_customers     c  on c.id = e.customer_id
left join public.admin_members       mb on mb.organization_id = e.organization_id and mb.user_id = e.user_id
left join public.admin_terminals     t  on t.id = e.terminal_id
left join public.admin_cash_sessions cs on cs.id = e.cash_session_id
window w as (
  partition by e.cash_session_id
  order by e.created_at,
    case e.event_type when 'apertura_caja' then 0 when 'cierre_caja' then 2 else 1 end,
    e.ref_id
);

-- =====================================================================
-- 7. OPERACIONES (RPC). Toda escritura transaccional pasa por aquí.
-- =====================================================================

-- Cargar cotización del dólar (dueño/admin)
create or replace function public.admin_set_exchange_rate(
  p_organization_id uuid,
  p_rate            numeric
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not admin_has_role(p_organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin cargan la cotización' using errcode = '42501';
  end if;
  if p_rate is null or p_rate <= 0 then raise exception 'Cotización inválida'; end if;
  insert into admin_exchange_rates (organization_id, rate, created_by)
  values (p_organization_id, p_rate, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Abrir caja (fondo inicial en cada cajón)
create or replace function public.admin_open_cash_session(
  p_organization_id uuid,
  p_terminal_id     uuid,
  p_opening_uyu     numeric default 0,
  p_opening_usd     numeric default 0
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not admin_has_role(p_organization_id) then
    raise exception 'Sin acceso a esta organización' using errcode = '42501';
  end if;
  perform 1 from admin_terminals
   where id = p_terminal_id and organization_id = p_organization_id and active;
  if not found then raise exception 'Terminal inválida'; end if;

  begin
    insert into admin_cash_sessions (organization_id, terminal_id, opened_by, opening_uyu, opening_usd)
    values (p_organization_id, p_terminal_id, auth.uid(), coalesce(p_opening_uyu, 0), coalesce(p_opening_usd, 0))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya hay una caja abierta en esta terminal';
  end;
  return v_id;
end;
$$;

-- Venta (contado / crédito / entrega a cuenta) con pagos mixtos y bimoneda
-- p_currency: moneda de la venta ('UYU' | 'USD')
-- p_items:    [{"product_id": "...", "quantity": 2, "unit_price": 150.00 (opcional, en moneda de la venta)}]
-- p_payments: [{"method": "efectivo", "currency": "USD", "amount": 100},
--              {"method": "efectivo", "currency": "UYU", "amount": 500, "change": true}]   ← vuelto
create or replace function public.admin_create_sale(
  p_organization_id uuid,
  p_terminal_id     uuid,
  p_condition       text,
  p_currency        text,
  p_items           jsonb,
  p_payments        jsonb default '[]'::jsonb,
  p_customer_id     uuid default null,
  p_notes           text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_org        admin_organizations%rowtype;
  v_rate       numeric(12,4) := admin_current_rate(p_organization_id);
  v_session_id uuid;
  v_sale_id    uuid := gen_random_uuid();
  v_number     bigint;
  v_item       record;
  v_pay        record;
  v_product    admin_products%rowtype;
  v_price      numeric(14,2);
  v_line       numeric(14,2);
  v_applied    numeric(14,2);
  v_total      numeric(14,2) := 0;
  v_tax        numeric(14,2) := 0;
  v_paid       numeric(14,2) := 0;
  v_diff       numeric(14,2);
  v_converted  boolean := false;
  v_lines      jsonb := '[]'::jsonb;
  v_pays       jsonb := '[]'::jsonb;
  v_last       int;
  v_bal        admin_customer_balances%rowtype;
  v_exposure   numeric(14,2);
begin
  if not admin_has_role(p_organization_id) then
    raise exception 'Sin acceso a esta organización' using errcode = '42501';
  end if;
  if p_condition is null or p_condition not in ('contado', 'credito') then
    raise exception 'Condición inválida: %', p_condition;
  end if;
  if p_currency is null or p_currency not in ('UYU', 'USD') then
    raise exception 'Moneda inválida: %', p_currency;
  end if;
  if p_condition = 'credito' and p_customer_id is null then
    raise exception 'Una venta a crédito requiere cliente';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_customer_id is not null then
    perform 1 from admin_customers where id = p_customer_id and organization_id = p_organization_id;
    if not found then raise exception 'Cliente inválido'; end if;
  end if;

  select id into v_session_id
    from admin_cash_sessions
   where terminal_id = p_terminal_id and organization_id = p_organization_id and status = 'abierta';
  if v_session_id is null then
    raise exception 'No hay caja abierta en esta terminal';
  end if;

  -- 1) Número correlativo. Bloquea la fila de la organización hasta el commit:
  --    serializa la numeración (sin huecos ni duplicados) y fija el orden de locks.
  update admin_organizations
     set next_sale_number = next_sale_number + 1
   where id = p_organization_id
  returning * into v_org;
  v_number := v_org.next_sale_number - 1;

  -- 2) Descontar stock. Orden por product_id → dos ventas concurrentes
  --    bloquean productos en el mismo orden y no hay deadlocks.
  for v_item in
    select (e->>'product_id')::uuid                 as product_id,
           (e->>'quantity')::numeric                as quantity,
           nullif(e->>'unit_price', '')::numeric    as unit_price
      from jsonb_array_elements(p_items) e
     order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if v_item.unit_price is not null and v_item.unit_price < 0 then
      raise exception 'Precio inválido';
    end if;

    update admin_products
       set stock = stock - v_item.quantity
     where id = v_item.product_id
       and organization_id = p_organization_id
       and active
       and (v_org.allow_negative_stock or stock >= v_item.quantity)
    returning * into v_product;

    if not found then
      select * into v_product from admin_products
       where id = v_item.product_id and organization_id = p_organization_id and active;
      if not found then
        raise exception 'Producto no encontrado o inactivo';
      end if;
      raise exception 'Stock insuficiente para "%" (disponible: %)', v_product.name, v_product.stock;
    end if;

    v_price := coalesce(v_item.unit_price,
                        admin_convert(v_product.price, v_product.currency, p_currency, v_rate));
    v_line  := round(v_price * v_item.quantity, 2);
    v_total := v_total + v_line;
    v_tax   := v_tax + round(v_line - v_line / (1 + v_product.iva_rate / 100), 2);

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'description', v_product.name,
      'quantity', v_item.quantity,
      'list_currency', v_product.currency, 'list_price', v_product.price,
      'unit_price', v_price, 'iva_rate', v_product.iva_rate, 'line_total', v_line,
      'stock_after', v_product.stock);
  end loop;

  -- 3) Pagos: se convierten a la moneda de la venta con la cotización vigente
  for v_pay in
    select e->>'method'                           as method,
           coalesce(e->>'currency', p_currency)   as currency,
           (e->>'amount')::numeric                as amount,
           e->>'reference'                        as reference,
           coalesce((e->>'change')::boolean, false) as is_change
      from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) e
  loop
    if v_pay.method is null or v_pay.method not in ('efectivo', 'transferencia', 'pos_debito', 'pos_credito') then
      raise exception 'Medio de pago inválido: %', v_pay.method;
    end if;
    if v_pay.currency not in ('UYU', 'USD') then
      raise exception 'Moneda de pago inválida: %', v_pay.currency;
    end if;
    if v_pay.amount is null or v_pay.amount <= 0 then
      raise exception 'Importe de pago inválido';
    end if;
    if v_pay.is_change and v_pay.method <> 'efectivo' then
      raise exception 'El vuelto solo puede ser en efectivo';
    end if;
    if v_pay.currency <> p_currency then v_converted := true; end if;

    v_applied := admin_convert(v_pay.amount, v_pay.currency, p_currency, v_rate);
    v_paid := v_paid + case when v_pay.is_change then -v_applied else v_applied end;

    v_pays := v_pays || jsonb_build_object(
      'kind', case when v_pay.is_change then 'vuelto' else 'venta' end,
      'method', v_pay.method, 'currency', v_pay.currency, 'amount', v_pay.amount,
      'applied_amount', v_applied, 'reference', v_pay.reference);
  end loop;

  -- Redondeo por conversión: si la diferencia es de centavos, se absorbe
  -- en el último pago (no-vuelto) para que la venta cierre exacta.
  v_diff := v_total - v_paid;
  if p_condition = 'contado' and v_diff <> 0 and v_converted
     and abs(v_diff) <= (case when p_currency = 'UYU' then 1.00 else 0.05 end) then
    select max(ord)::int - 1 into v_last
      from jsonb_array_elements(v_pays) with ordinality as x(e, ord)
     where e->>'kind' = 'venta';
    if v_last is not null then
      v_pays := jsonb_set(v_pays, array[v_last::text, 'applied_amount'],
                          to_jsonb((v_pays->v_last->>'applied_amount')::numeric + v_diff));
      v_paid := v_total;
    end if;
  end if;

  if p_condition = 'contado' and v_paid <> v_total then
    raise exception 'Venta contado: los pagos (% %) deben sumar el total (% %)',
      v_paid, p_currency, v_total, p_currency;
  end if;
  if p_condition = 'credito' and v_paid > v_total then
    raise exception 'Los pagos (%) superan el total (%)', v_paid, v_total;
  end if;
  if v_paid < 0 then
    raise exception 'El vuelto supera lo pagado';
  end if;

  -- 4) Límite de crédito: deuda total (UYU + USD) expresada en la moneda del límite
  if p_condition = 'credito' then
    select * into v_bal from admin_customer_balances where customer_id = p_customer_id;
    if v_bal.credit_limit is not null then
      v_exposure := admin_convert(v_bal.balance_uyu, 'UYU', v_bal.credit_limit_currency, v_rate)
                  + admin_convert(v_bal.balance_usd, 'USD', v_bal.credit_limit_currency, v_rate)
                  + admin_convert(v_total - v_paid, p_currency, v_bal.credit_limit_currency, v_rate);
      if v_exposure > v_bal.credit_limit then
        raise exception 'Supera el límite de crédito del cliente (deuda resultante % %, límite % %)',
          v_exposure, v_bal.credit_limit_currency, v_bal.credit_limit, v_bal.credit_limit_currency;
      end if;
    end if;
  end if;

  -- 5) Grabar
  insert into admin_sales (
    id, organization_id, number, customer_id, seller_id, terminal_id, cash_session_id,
    condition, currency, exchange_rate, subtotal, tax_total, total, notes)
  values (
    v_sale_id, p_organization_id, v_number, p_customer_id, v_uid, p_terminal_id, v_session_id,
    p_condition, p_currency, v_rate, v_total - v_tax, v_tax, v_total, p_notes);

  insert into admin_sale_items
    (organization_id, sale_id, product_id, description, quantity,
     list_currency, list_price, unit_price, iva_rate, line_total)
  select p_organization_id, v_sale_id, (l->>'product_id')::uuid, l->>'description',
         (l->>'quantity')::numeric, l->>'list_currency', (l->>'list_price')::numeric,
         (l->>'unit_price')::numeric, (l->>'iva_rate')::numeric, (l->>'line_total')::numeric
    from jsonb_array_elements(v_lines) l;

  insert into admin_stock_movements
    (organization_id, product_id, quantity, stock_after, reason, sale_id, created_by)
  select p_organization_id, (l->>'product_id')::uuid, -(l->>'quantity')::numeric,
         (l->>'stock_after')::numeric, 'venta', v_sale_id, v_uid
    from jsonb_array_elements(v_lines) l;

  insert into admin_payments
    (organization_id, kind, sale_id, customer_id, cash_session_id, method,
     currency, amount, applied_currency, applied_amount, exchange_rate, reference, received_by)
  select p_organization_id, e->>'kind', v_sale_id, p_customer_id, v_session_id, e->>'method',
         e->>'currency', (e->>'amount')::numeric, p_currency, (e->>'applied_amount')::numeric,
         case when e->>'currency' <> p_currency then v_rate end, e->>'reference', v_uid
    from jsonb_array_elements(v_pays) e;

  return jsonb_build_object('sale_id', v_sale_id, 'number', v_number, 'currency', p_currency,
                            'total', v_total, 'paid', v_paid, 'exchange_rate', v_rate);
end;
$$;

-- Cobranza de cuenta corriente (NO es venta).
-- p_debt_currency: qué deuda cancela (UYU o USD). p_currency: con qué moneda paga.
create or replace function public.admin_register_collection(
  p_organization_id uuid,
  p_terminal_id     uuid,
  p_customer_id     uuid,
  p_debt_currency   text,
  p_method          text,
  p_currency        text,
  p_amount          numeric,
  p_reference       text default null,
  p_notes           text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_id         uuid;
  v_rate       numeric(12,4) := admin_current_rate(p_organization_id);
  v_applied    numeric(14,2);
begin
  if not admin_has_role(p_organization_id) then
    raise exception 'Sin acceso a esta organización' using errcode = '42501';
  end if;
  perform 1 from admin_customers where id = p_customer_id and organization_id = p_organization_id;
  if not found then raise exception 'Cliente inválido'; end if;
  if p_debt_currency not in ('UYU', 'USD') or p_currency not in ('UYU', 'USD') then
    raise exception 'Moneda inválida';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Importe inválido'; end if;

  select id into v_session_id from admin_cash_sessions
   where terminal_id = p_terminal_id and organization_id = p_organization_id and status = 'abierta';
  if v_session_id is null then raise exception 'No hay caja abierta en esta terminal'; end if;

  v_applied := admin_convert(p_amount, p_currency, p_debt_currency, v_rate);

  insert into admin_payments
    (organization_id, kind, customer_id, cash_session_id, method, currency, amount,
     applied_currency, applied_amount, exchange_rate, reference, notes, received_by)
  values
    (p_organization_id, 'cobranza', p_customer_id, v_session_id, p_method, p_currency, p_amount,
     p_debt_currency, v_applied, case when p_currency <> p_debt_currency then v_rate end,
     p_reference, p_notes, auth.uid())
  returning id into v_id;
  return jsonb_build_object('payment_id', v_id, 'applied_currency', p_debt_currency, 'applied_amount', v_applied);
end;
$$;

-- Retiros / ingresos manuales de efectivo
create or replace function public.admin_register_cash_movement(
  p_organization_id uuid,
  p_terminal_id     uuid,
  p_direction       text,
  p_reason          text,
  p_currency        text,
  p_amount          numeric,
  p_notes           text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_session_id uuid; v_id uuid;
begin
  if not admin_has_role(p_organization_id) then
    raise exception 'Sin acceso a esta organización' using errcode = '42501';
  end if;
  select id into v_session_id from admin_cash_sessions
   where terminal_id = p_terminal_id and organization_id = p_organization_id and status = 'abierta';
  if v_session_id is null then raise exception 'No hay caja abierta en esta terminal'; end if;
  if p_reason = 'otro' and length(trim(coalesce(p_notes, ''))) = 0 then
    raise exception 'El motivo "otro" requiere una nota';
  end if;

  insert into admin_cash_movements
    (organization_id, cash_session_id, direction, reason, currency, amount, notes, created_by)
  values
    (p_organization_id, v_session_id, p_direction, p_reason, p_currency, p_amount, p_notes, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Cierre de caja: esperado por cajón = inicial + efectivo entrado - efectivo salido
create or replace function public.admin_close_cash_session(
  p_cash_session_id uuid,
  p_counted_uyu     numeric,
  p_counted_usd     numeric,
  p_notes           text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_s     admin_cash_sessions%rowtype;
  v_e_uyu numeric(14,2);
  v_e_usd numeric(14,2);
begin
  select * into v_s from admin_cash_sessions where id = p_cash_session_id for update;
  if not found then raise exception 'Caja no encontrada'; end if;
  if not (admin_has_role(v_s.organization_id, array['dueno', 'admin'])
          or (v_s.opened_by = auth.uid() and admin_has_role(v_s.organization_id))) then
    raise exception 'No puede cerrar esta caja' using errcode = '42501';
  end if;
  if v_s.status <> 'abierta' then raise exception 'La caja ya está cerrada'; end if;
  if p_counted_uyu is null or p_counted_uyu < 0 or p_counted_usd is null or p_counted_usd < 0 then
    raise exception 'Importe contado inválido';
  end if;

  with flows as (
    select currency,
           case when kind in ('vuelto', 'reintegro') then -amount else amount end as amount
      from admin_payments
     where cash_session_id = v_s.id and status = 'vigente' and method = 'efectivo'
    union all
    select currency, case when direction = 'ingreso' then amount else -amount end
      from admin_cash_movements where cash_session_id = v_s.id
  )
  select v_s.opening_uyu + coalesce(sum(amount) filter (where currency = 'UYU'), 0),
         v_s.opening_usd + coalesce(sum(amount) filter (where currency = 'USD'), 0)
    into v_e_uyu, v_e_usd
    from flows;

  update admin_cash_sessions
     set status = 'cerrada', closed_by = auth.uid(), closed_at = now(),
         expected_uyu = v_e_uyu, expected_usd = v_e_usd,
         counted_uyu = p_counted_uyu, counted_usd = p_counted_usd,
         difference_uyu = p_counted_uyu - v_e_uyu, difference_usd = p_counted_usd - v_e_usd,
         closing_notes = p_notes
   where id = v_s.id;

  return jsonb_build_object(
    'expected_uyu', v_e_uyu, 'counted_uyu', p_counted_uyu, 'difference_uyu', p_counted_uyu - v_e_uyu,
    'expected_usd', v_e_usd, 'counted_usd', p_counted_usd, 'difference_usd', p_counted_usd - v_e_usd,
    'by_method', (select coalesce(jsonb_object_agg(k, total), '{}'::jsonb) from (
                    select method || '_' || currency as k,
                           sum(case when kind in ('vuelto', 'reintegro') then -amount else amount end) as total
                      from admin_payments
                     where cash_session_id = v_s.id and status = 'vigente'
                     group by method, currency) x));
end;
$$;

-- Anular venta (solo dueño/admin y solo si su caja sigue abierta)
create or replace function public.admin_void_sale(
  p_sale_id uuid,
  p_reason  text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_sale admin_sales%rowtype;
  v_item record;
  v_stock numeric(14,3);
begin
  select * into v_sale from admin_sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if not admin_has_role(v_sale.organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden anular' using errcode = '42501';
  end if;
  if v_sale.status = 'anulada' then raise exception 'La venta ya está anulada'; end if;
  if v_sale.kind <> 'venta' then raise exception 'Solo se anulan ventas'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Motivo obligatorio'; end if;
  if exists (select 1 from admin_payments p
               join admin_cash_sessions cs on cs.id = p.cash_session_id
              where p.sale_id = v_sale.id and cs.status = 'cerrada') then
    raise exception 'La venta tiene cobros en una caja ya cerrada: registrá una devolución';
  end if;

  for v_item in
    select product_id, sum(quantity) as quantity
      from admin_sale_items where sale_id = v_sale.id
     group by product_id order by product_id
  loop
    update admin_products set stock = stock + v_item.quantity
     where id = v_item.product_id
    returning stock into v_stock;
    insert into admin_stock_movements
      (organization_id, product_id, quantity, stock_after, reason, sale_id, created_by)
    values
      (v_sale.organization_id, v_item.product_id, v_item.quantity, v_stock, 'anulacion', v_sale.id, auth.uid());
  end loop;

  update admin_payments set status = 'anulado' where sale_id = v_sale.id and status = 'vigente';
  update admin_sales
     set status = 'anulada', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = v_sale.id;
end;
$$;

-- Ajuste / compra de stock (carga inicial, conteo, recepción de mercadería)
create or replace function public.admin_adjust_stock(
  p_product_id uuid,
  p_quantity   numeric,          -- con signo: +10 entra, -3 sale
  p_reason     text,             -- 'compra' | 'ajuste'
  p_notes      text default null
)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare v_org uuid; v_stock numeric(14,3);
begin
  select organization_id into v_org from admin_products where id = p_product_id;
  if v_org is null then raise exception 'Producto no encontrado'; end if;
  if not admin_has_role(v_org, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin ajustan stock' using errcode = '42501';
  end if;
  if p_reason not in ('compra', 'ajuste') then raise exception 'Motivo inválido'; end if;
  if p_quantity is null or p_quantity = 0 then raise exception 'Cantidad inválida'; end if;

  update admin_products set stock = stock + p_quantity where id = p_product_id
  returning stock into v_stock;
  insert into admin_stock_movements
    (organization_id, product_id, quantity, stock_after, reason, notes, created_by)
  values (v_org, p_product_id, p_quantity, v_stock, p_reason, p_notes, auth.uid());
  return v_stock;
end;
$$;

-- Buscador global (productos, clientes, nº de venta), tolerante a tildes
create or replace function public.admin_global_search(
  p_organization_id uuid,
  p_query           text,
  p_limit           int default 20
)
returns table (kind text, id uuid, label text, detail text, score real)
language sql stable security invoker
set search_path = public
as $$
  with q as (select public.admin_unaccent(lower(trim(p_query))) as t, trim(p_query) as raw)
  select * from (
    select 'producto'::text, p.id, p.name,
           concat_ws(' · ', p.sku, p.barcode, p.currency || ' ' || p.price, 'stock ' || trim_scale(p.stock)),
           case when p.sku = q.raw or p.barcode = q.raw then 1::real
                else extensions.word_similarity(q.t, public.admin_unaccent(lower(p.name))) end
      from admin_products p, q
     where p.organization_id = p_organization_id
       and (public.admin_unaccent(lower(p.name)) like '%' || q.t || '%'
            or p.sku = q.raw or p.barcode = q.raw)
    union all
    select 'cliente', c.id, c.name, concat_ws(' · ', c.doc_type || ' ' || c.doc_number, c.phone),
           case when c.doc_number = q.raw then 1::real
                else extensions.word_similarity(q.t, public.admin_unaccent(lower(c.name))) end
      from admin_customers c, q
     where c.organization_id = p_organization_id
       and (public.admin_unaccent(lower(c.name)) like '%' || q.t || '%' or c.doc_number = q.raw)
    union all
    select 'venta', s.id, 'Venta #' || s.number,
           concat_ws(' · ', to_char(s.created_at, 'DD/MM/YYYY HH24:MI'), s.currency || ' ' || s.total, s.status),
           1::real
      from admin_sales s, q
     where s.organization_id = p_organization_id
       and q.raw ~ '^\d{1,18}$' and s.number = q.raw::bigint
  ) r
  order by 5 desc, 3
  limit p_limit;
$$;

-- =====================================================================
-- 8. SEGURIDAD: RLS + permisos
--    Regla: el cliente LEE con RLS; las tablas transaccionales solo se
--    ESCRIBEN vía las funciones de arriba.
-- =====================================================================

alter table public.admin_organizations   enable row level security;
alter table public.admin_members         enable row level security;
alter table public.admin_exchange_rates  enable row level security;
alter table public.admin_terminals       enable row level security;
alter table public.admin_categories      enable row level security;
alter table public.admin_products        enable row level security;
alter table public.admin_customers       enable row level security;
alter table public.admin_cash_sessions   enable row level security;
alter table public.admin_cash_movements  enable row level security;
alter table public.admin_sales           enable row level security;
alter table public.admin_sale_items      enable row level security;
alter table public.admin_payments        enable row level security;
alter table public.admin_stock_movements enable row level security;
alter table public.admin_audit_log       enable row level security;

-- Nada para anon
revoke all on
  public.admin_organizations, public.admin_members, public.admin_exchange_rates, public.admin_terminals,
  public.admin_categories, public.admin_products, public.admin_customers, public.admin_cash_sessions,
  public.admin_cash_movements, public.admin_sales, public.admin_sale_items, public.admin_payments,
  public.admin_stock_movements, public.admin_audit_log, public.admin_customer_balances, public.admin_ledger
from anon;

-- Tablas transaccionales: solo lectura para authenticated
revoke insert, update, delete, truncate on
  public.admin_exchange_rates, public.admin_cash_sessions, public.admin_cash_movements,
  public.admin_sales, public.admin_sale_items, public.admin_payments,
  public.admin_stock_movements, public.admin_audit_log
from authenticated;

-- Columnas protegidas: stock y correlativo no se tocan desde el cliente
revoke insert, update on public.admin_products, public.admin_organizations from authenticated;
grant insert (organization_id, category_id, sku, barcode, name, unit, currency, price, cost, iva_rate, min_stock, active)
  on public.admin_products to authenticated;
grant update (category_id, sku, barcode, name, unit, currency, price, cost, iva_rate, min_stock, active)
  on public.admin_products to authenticated;
grant update (name, legal_name, tax_id, address, phone, email, logo_url,
              allow_negative_stock, receipt_footer)
  on public.admin_organizations to authenticated;
revoke delete on public.admin_products, public.admin_customers, public.admin_organizations from authenticated;

-- Organizaciones
create policy admin_org_select on public.admin_organizations for select to authenticated
  using (public.admin_has_role(id));
create policy admin_org_update on public.admin_organizations for update to authenticated
  using (public.admin_has_role(id, array['dueno']))
  with check (public.admin_has_role(id, array['dueno']));

-- Miembros (solo el dueño gestiona el equipo)
create policy admin_members_select on public.admin_members for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_members_insert on public.admin_members for insert to authenticated
  with check (public.admin_has_role(organization_id, array['dueno']));
create policy admin_members_update on public.admin_members for update to authenticated
  using (public.admin_has_role(organization_id, array['dueno']))
  with check (public.admin_has_role(organization_id, array['dueno']));
create policy admin_members_delete on public.admin_members for delete to authenticated
  using (public.admin_has_role(organization_id, array['dueno']));

-- Cotizaciones: todos leen, se cargan por RPC
create policy admin_exchange_rates_select on public.admin_exchange_rates for select to authenticated
  using (public.admin_has_role(organization_id));

-- Terminales y categorías
create policy admin_terminals_select on public.admin_terminals for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_terminals_write on public.admin_terminals for all to authenticated
  using (public.admin_has_role(organization_id, array['dueno', 'admin']))
  with check (public.admin_has_role(organization_id, array['dueno', 'admin']));

create policy admin_categories_select on public.admin_categories for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_categories_write on public.admin_categories for all to authenticated
  using (public.admin_has_role(organization_id, array['dueno', 'admin']))
  with check (public.admin_has_role(organization_id, array['dueno', 'admin']));

-- Productos (dueño/admin editan; stock solo por RPC)
create policy admin_products_select on public.admin_products for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_products_insert on public.admin_products for insert to authenticated
  with check (public.admin_has_role(organization_id, array['dueno', 'admin']));
create policy admin_products_update on public.admin_products for update to authenticated
  using (public.admin_has_role(organization_id, array['dueno', 'admin']))
  with check (public.admin_has_role(organization_id, array['dueno', 'admin']));

-- Clientes (cualquier miembro los da de alta en el mostrador)
create policy admin_customers_select on public.admin_customers for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_customers_insert on public.admin_customers for insert to authenticated
  with check (public.admin_has_role(organization_id));
create policy admin_customers_update on public.admin_customers for update to authenticated
  using (public.admin_has_role(organization_id))
  with check (public.admin_has_role(organization_id));

-- Cajas: dueño/admin ven todas; vendedor solo las suyas
create policy admin_cash_sessions_select on public.admin_cash_sessions for select to authenticated
  using (public.admin_has_role(organization_id, array['dueno', 'admin'])
         or (opened_by = auth.uid() and public.admin_has_role(organization_id)));
create policy admin_cash_movements_select on public.admin_cash_movements for select to authenticated
  using (exists (select 1 from public.admin_cash_sessions cs where cs.id = cash_session_id));

-- Ventas, ítems, pagos, stock: lectura para todo miembro (histórico del mostrador)
create policy admin_sales_select on public.admin_sales for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_sale_items_select on public.admin_sale_items for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_payments_select on public.admin_payments for select to authenticated
  using (public.admin_has_role(organization_id));
create policy admin_stock_movements_select on public.admin_stock_movements for select to authenticated
  using (public.admin_has_role(organization_id));

-- Auditoría: solo dueño/admin
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using (public.admin_has_role(organization_id, array['dueno', 'admin']));

-- Funciones: solo usuarios autenticados
revoke execute on function
  public.admin_set_exchange_rate(uuid, numeric),
  public.admin_open_cash_session(uuid, uuid, numeric, numeric),
  public.admin_create_sale(uuid, uuid, text, text, jsonb, jsonb, uuid, text),
  public.admin_register_collection(uuid, uuid, uuid, text, text, text, numeric, text, text),
  public.admin_register_cash_movement(uuid, uuid, text, text, text, numeric, text),
  public.admin_close_cash_session(uuid, numeric, numeric, text),
  public.admin_void_sale(uuid, text),
  public.admin_adjust_stock(uuid, numeric, text, text),
  public.admin_global_search(uuid, text, int),
  public.admin_current_rate(uuid)
from public, anon;
grant execute on function
  public.admin_set_exchange_rate(uuid, numeric),
  public.admin_open_cash_session(uuid, uuid, numeric, numeric),
  public.admin_create_sale(uuid, uuid, text, text, jsonb, jsonb, uuid, text),
  public.admin_register_collection(uuid, uuid, uuid, text, text, text, numeric, text, text),
  public.admin_register_cash_movement(uuid, uuid, text, text, text, numeric, text),
  public.admin_close_cash_session(uuid, numeric, numeric, text),
  public.admin_void_sale(uuid, text),
  public.admin_adjust_stock(uuid, numeric, text, text),
  public.admin_global_search(uuid, text, int),
  public.admin_current_rate(uuid)
to authenticated;

-- =====================================================================
-- 9. REALTIME (multi-PC). Las vistas no emiten eventos: el front escucha
--    estas tablas y, al recibir un cambio, vuelve a consultar admin_ledger.
-- =====================================================================

alter publication supabase_realtime add table
  public.admin_sales, public.admin_payments, public.admin_cash_movements,
  public.admin_cash_sessions, public.admin_products, public.admin_exchange_rates;

-- =====================================================================
-- 10. ARRANQUE (ejecutar a mano DESPUÉS, cambiando los valores)
-- =====================================================================
-- insert into public.admin_organizations (name, legal_name, tax_id)
--   values ('Los Ceibos', 'Los Ceibos ...', 'RUT...') returning id;
--
-- insert into public.admin_members (organization_id, user_id, role, display_name)
--   values ('<org_id>', '<auth.users.id de tu primo>', 'dueno', '<nombre>');
--
-- insert into public.admin_terminals (organization_id, name)
--   values ('<org_id>', 'Caja 1'), ('<org_id>', 'Caja 2');
--
-- insert into public.admin_exchange_rates (organization_id, rate)
--   values ('<org_id>', 40.00);   -- después se carga a diario desde la app)
