-- =====================================================================
-- admin_04_cash_session_ledger.sql
-- Apertura y cierre de caja entran en admin_ledger.
-- El saldo de cada cajón pasa a ser la suma de deltas: la apertura
-- aporta el fondo y el cierre no mueve el saldo.
-- Ejecutar DESPUÉS de admin_01_schema.sql.
-- =====================================================================
create or replace view public.admin_ledger
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
      || ' Â· U$S ' || trim(to_char(cs.opening_usd, 'FM999999990.00')),
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
      || ') Â· U$S ' || trim(to_char(cs.counted_usd, 'FM999999990.00'))
      || ' (esperado ' || trim(to_char(cs.expected_usd, 'FM999999990.00'))
      || ', dif. ' || trim(to_char(cs.difference_usd, 'FM999999990.00')) || ')'
      || case
           when length(trim(coalesce(cs.closing_notes, ''))) > 0
           then ' Â· ' || cs.closing_notes
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

