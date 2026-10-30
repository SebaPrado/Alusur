-- =====================================================================
-- admin_12_delete_customer.sql
-- El cliente no tiene DELETE sobre admin_customers. Esta función borra
-- el cliente si no tiene ventas ni cobranzas. Si ya tiene movimientos,
-- lo deja inactivo para conservar el historial.
-- Ejecutar DESPUÉS de admin_01_schema.sql.
-- =====================================================================

create or replace function public.admin_delete_customer(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_active boolean;
begin
  select organization_id, active
    into v_org, v_active
    from admin_customers
   where id = p_customer_id;

  if v_org is null then
    raise exception 'Cliente no encontrado';
  end if;
  if not admin_has_role(v_org, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden eliminar clientes'
      using errcode = '42501';
  end if;

  if exists (select 1 from admin_sales where customer_id = p_customer_id)
     or exists (select 1 from admin_payments where customer_id = p_customer_id)
  then
    if not v_active then
      raise exception 'No se puede eliminar: el cliente tiene movimientos';
    end if;
    update admin_customers set active = false where id = p_customer_id;
    return 'inactivo';
  end if;

  delete from admin_customers where id = p_customer_id;
  return 'eliminado';
end;
$$;

revoke all on function public.admin_delete_customer(uuid) from public, anon;
grant execute on function public.admin_delete_customer(uuid) to authenticated;
