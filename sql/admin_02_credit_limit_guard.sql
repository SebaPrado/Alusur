-- =====================================================================
-- admin_02_credit_limit_guard.sql
-- Protege credit_limit / credit_limit_currency: solo dueño o admin
-- pueden fijarlos o cambiarlos. Los vendedores siguen pudiendo alta y
-- edición de datos de contacto en el mostrador.
-- Ejecutar DESPUÉS de admin_01_schema.sql. No modifica tablas ni RPCs.
-- =====================================================================

-- Allowlist de columnas (mismo estilo que admin_products)
revoke insert, update on public.admin_customers from authenticated;

grant insert (
  organization_id, name, doc_type, doc_number, phone, email, address, notes,
  credit_limit, credit_limit_currency, active
) on public.admin_customers to authenticated;

grant update (
  name, doc_type, doc_number, phone, email, address, notes,
  credit_limit, credit_limit_currency, active
) on public.admin_customers to authenticated;

create or replace function public.admin_customers_credit_limit_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (new.credit_limit is not null
        or coalesce(new.credit_limit_currency, 'USD') is distinct from 'USD')
       and not admin_has_role(new.organization_id, array['dueno', 'admin']) then
      raise exception 'Solo dueño o admin pueden fijar el límite de crédito'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if (new.credit_limit is distinct from old.credit_limit
        or new.credit_limit_currency is distinct from old.credit_limit_currency)
       and not admin_has_role(new.organization_id, array['dueno', 'admin']) then
      raise exception 'Solo dueño o admin pueden cambiar el límite de crédito'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_customers_credit_limit_guard on public.admin_customers;
create trigger admin_customers_credit_limit_guard
  before insert or update on public.admin_customers
  for each row execute function public.admin_customers_credit_limit_guard();
