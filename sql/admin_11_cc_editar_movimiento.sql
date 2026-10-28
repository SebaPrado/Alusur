-- =====================================================================
-- admin_11_cc_editar_movimiento.sql
-- Permite corregir un movimiento de cuenta corriente (sin borrarlo).
-- No se puede editar si ya está anulado. lado y tipo no cambian.
-- Ejecutar en byfdrcdiqwlbaldewikg: pegar TODO → Run.
-- =====================================================================
begin;

create or replace function public.admin_cc_editar(
  p_movimiento_id uuid,
  p_moneda        text,
  p_importe       numeric,
  p_fecha         date default current_date,
  p_vencimiento   date default null,
  p_numero        text default null,
  p_concepto      text default null,
  p_medio         text default null,
  p_obra_id       uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_m       admin_cc_movimientos%rowtype;
  v_empresa uuid;
begin
  select * into v_m from admin_cc_movimientos where id = p_movimiento_id for update;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if not admin_has_role(v_m.organization_id, array['dueno', 'admin']) then
    raise exception 'Solo dueño o admin pueden editar' using errcode = '42501';
  end if;
  if v_m.anulado then raise exception 'No se puede editar un movimiento anulado'; end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe tiene que ser mayor que cero';
  end if;
  if p_moneda is null or p_moneda not in ('UYU', 'USD') then
    raise exception 'Moneda inválida';
  end if;
  if v_m.tipo = 'pago' and p_medio is null then
    raise exception 'Indicá el medio de pago';
  end if;
  if p_medio is not null and p_medio not in ('transferencia', 'efectivo', 'cheque', 'otro') then
    raise exception 'Medio de pago inválido';
  end if;

  if p_obra_id is not null then
    select empresa_id into v_empresa from admin_organizations where id = v_m.organization_id;
    if v_empresa is null or not exists (
      select 1 from obra_empresas where obra_id = p_obra_id and empresa_id = v_empresa
    ) then
      raise exception 'Esa obra no pertenece a esta empresa';
    end if;
  end if;

  update admin_cc_movimientos
     set moneda      = p_moneda,
         importe     = round(p_importe, 2),
         fecha       = coalesce(p_fecha, current_date),
         vencimiento = case when v_m.tipo = 'factura' then p_vencimiento end,
         numero      = nullif(btrim(p_numero), ''),
         concepto    = nullif(btrim(p_concepto), ''),
         medio       = case when v_m.tipo = 'pago' then p_medio end,
         obra_id     = p_obra_id
   where id = p_movimiento_id;
end $$;

revoke all on function public.admin_cc_editar(uuid, text, numeric, date, date, text, text, text, uuid)
  from public, anon;
grant execute on function public.admin_cc_editar(uuid, text, numeric, date, date, text, text, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
