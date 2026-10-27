import { supabase } from "../../lib/supabase";

export const LEDGER_EVENT_LABEL = {
  apertura_caja: "Apertura caja",
  cierre_caja: "Cierre caja",
};

export function ledgerEventLabel(type) {
  return LEDGER_EVENT_LABEL[type] ?? type ?? "";
}

export function ledgerMediosLabel(value) {
  if (!value) return "";
  return String(value).replaceAll("transferencia", "transf");
}

const LEDGER_SELECT = `
  created_at, event_type, ref_id, number, customer_id, customer_name,
  user_id, user_name, terminal_id, terminal_name, cash_session_id,
  condition, status, currency, amount, exchange_rate, detail,
  payment_methods, cash_delta_uyu, cash_delta_usd,
  cash_balance_uyu, cash_balance_usd
`;

/**
 * @param {{
 *   organizationId: string,
 *   from?: Date|null,
 *   to?: Date|null,
 *   eventTypes?: string[]|null,
 *   userIds?: string[]|null,
 *   terminalIds?: string[]|null,
 * }} filters
 */
function applyAny(query, column, values) {
  const list = (values ?? []).filter(Boolean);
  if (list.length === 1) return query.eq(column, list[0]);
  if (list.length > 1) return query.in(column, list);
  return query;
}

export function buildLedgerQuery(filters) {
  let q = supabase
    .from("admin_ledger")
    .select(LEDGER_SELECT)
    .eq("organization_id", filters.organizationId)
    .order("created_at", { ascending: false })
    .order("ref_id", { ascending: false });

  if (filters.from) q = q.gte("created_at", filters.from.toISOString());
  if (filters.to) q = q.lte("created_at", filters.to.toISOString());
  q = applyAny(q, "event_type", filters.eventTypes);
  q = applyAny(q, "user_id", filters.userIds);
  q = applyAny(q, "terminal_id", filters.terminalIds);
  return q;
}

export function dateRangeForPreset(preset, rangeFrom, rangeTo) {
  const now = new Date();
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  switch (preset) {
    case "todo":
      return { from: null, to: null };
    case "ayer": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case "mes": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "rango": {
      if (!rangeFrom || !rangeTo) {
        return { from: startOfDay(now), to: endOfDay(now) };
      }
      return {
        from: startOfDay(new Date(rangeFrom)),
        to: endOfDay(new Date(rangeTo)),
      };
    }
    case "hoy":
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}
