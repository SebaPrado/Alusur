import { buildLedgerQuery } from "./ledgerQuery";
import { formatDateTime, formatMoney, signedMoney } from "./money";

const BATCH = 1000;

const HEADERS = [
  "fecha_hora",
  "tipo",
  "numero",
  "cliente",
  "detalle",
  "moneda",
  "importe",
  "medios",
  "efectivo_uyu",
  "efectivo_usd",
  "saldo_cajon_uyu",
  "saldo_cajon_usd",
  "usuario",
  "terminal",
  "estado",
];

function esc(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(r) {
  return [
    formatDateTime(r.created_at),
    r.event_type,
    r.number ?? "",
    r.customer_name ?? "",
    r.detail ?? "",
    r.currency,
    formatMoney(r.amount, r.currency),
    r.payment_methods ?? "",
    signedMoney(r.cash_delta_uyu, "UYU"),
    signedMoney(r.cash_delta_usd, "USD"),
    formatMoney(r.cash_balance_uyu, "UYU"),
    formatMoney(r.cash_balance_usd, "USD"),
    r.user_name ?? "",
    r.terminal_name ?? "",
    r.status ?? "",
  ]
    .map(esc)
    .join(",");
}

/** Descarga CSV de TODO lo filtrado (lotes de 1000 en el servidor). */
export async function exportLedgerCsv(filters) {
  const lines = [HEADERS.join(",")];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildLedgerQuery(filters).range(
      offset,
      offset + BATCH - 1,
    );
    if (error) throw error;
    const chunk = data ?? [];
    for (const r of chunk) lines.push(rowToCsv(r));
    if (chunk.length < BATCH) break;
    offset += BATCH;
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planilla_${filters.from.toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
