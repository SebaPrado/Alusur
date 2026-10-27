-- =====================================================================
-- admin_03_delete_product.sql
-- El cliente no tiene DELETE sobre admin_products. Esta función borra
-- el producto si no tiene ventas (y sus movimientos de stock de carga
-- o ajuste). Si ya se vendió, lo deja inactivo para conservar el
-- historial.
-- Ejecutar DESPUÉS de admin_01_schema.sql.
-- =====================================================================

create or replace function public.admin_delete_product(p_product_id uuid)
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
    from admin_products
   where id = p_product_id;

  if v_org is null then
    raise exception 'Producto no encontrado';
  end if;
  if not admin_has_role(v_org, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden eliminar productos'
      using errcode = '42501';
  end if;

  if exists (select 1 from admin_sale_items where product_id = p_product_id) then
    if not v_active then
      raise exception 'No se puede eliminar: el producto tiene ventas';
    end if;
    update admin_products set active = false where id = p_product_id;
    return 'inactivo';
  end if;

  delete from admin_stock_movements where product_id = p_product_id;
  delete from admin_products where id = p_product_id;
  return 'eliminado';
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public, anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;
