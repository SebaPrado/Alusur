-- Pesos sin decimales, dólares con un decimal.
-- Reemplaza conversión, ventas, cobranza, movimientos de caja y cierre.
-- Ejecutar una vez en Supabase → SQL Editor.

-- Conversión entre monedas. p_rate = pesos por 1 dólar.
-- El resultado queda en la escala de la moneda destino: UYU entero, USD un decimal.
create or replace function public.admin_convert(
  p_amount numeric, p_from text, p_to text, p_rate numeric
)
returns numeric
language plpgsql immutable
set search_path = ''
as $$
declare
  v_scale int;
begin
  if p_from is null or p_to is null then
    raise exception 'Conversión no soportada: % → %', p_from, p_to;
  end if;
  v_scale := case when p_to = 'USD' then 1 else 0 end;
  if p_from = p_to then return round(p_amount, v_scale); end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'No hay cotización del dólar cargada';
  end if;
  if p_from = 'USD' and p_to = 'UYU' then return round(p_amount * p_rate, v_scale); end if;
  if p_from = 'UYU' and p_to = 'USD' then return round(p_amount / p_rate, v_scale); end if;
  raise exception 'Conversión no soportada: % → %', p_from, p_to;
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
    values (p_organization_id, p_terminal_id, auth.uid(),
            round(coalesce(p_opening_uyu, 0), 0), round(coalesce(p_opening_usd, 0), 1))
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
  v_amount     numeric(14,2);
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
    v_price := round(v_price, case when p_currency = 'USD' then 1 else 0 end);
    v_line  := round(v_price * v_item.quantity, case when p_currency = 'USD' then 1 else 0 end);
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
    v_amount := round(v_pay.amount, case when v_pay.currency = 'USD' then 1 else 0 end);
    if v_amount <= 0 then
      raise exception 'Importe de pago inválido';
    end if;
    if v_pay.is_change and v_pay.method <> 'efectivo' then
      raise exception 'El vuelto solo puede ser en efectivo';
    end if;
    if v_pay.currency <> p_currency then v_converted := true; end if;

    v_applied := admin_convert(v_amount, v_pay.currency, p_currency, v_rate);
    v_paid := v_paid + case when v_pay.is_change then -v_applied else v_applied end;

    v_pays := v_pays || jsonb_build_object(
      'kind', case when v_pay.is_change then 'vuelto' else 'venta' end,
      'method', v_pay.method, 'currency', v_pay.currency, 'amount', v_amount,
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
  p_amount := round(p_amount, case when p_currency = 'USD' then 1 else 0 end);
  if p_amount <= 0 then raise exception 'Importe inválido'; end if;

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
  p_amount := round(p_amount, case when p_currency = 'USD' then 1 else 0 end);
  if p_amount is null or p_amount <= 0 then raise exception 'Importe inválido'; end if;

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
  p_counted_uyu := round(p_counted_uyu, 0);
  p_counted_usd := round(p_counted_usd, 1);

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
  v_e_uyu := round(v_e_uyu, 0);
  v_e_usd := round(v_e_usd, 1);

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
