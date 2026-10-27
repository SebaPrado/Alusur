import { buildLedgerQuery, ledgerEventLabel } from "./ledgerQuery";
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

/** Excel (es-UY) separa columnas con ";" y usa "," como decimal. */
const SEP = ";";

function esc(v) {
  const s = v == null ? "" : String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function cellsOf(r) {
  return [
    formatDateTime(r.created_at),
    ledgerEventLabel(r.event_type),
    r.number ?? "",
    r.customer_name ?? "",
    r.detail ?? "",
    r.currency ?? "",
    r.amount == null ? "" : formatMoney(r.amount, r.currency),
    r.payment_methods ?? "",
    r.cash_delta_uyu == null ? "" : signedMoney(r.cash_delta_uyu, "UYU"),
    r.cash_delta_usd == null ? "" : signedMoney(r.cash_delta_usd, "USD"),
    formatMoney(r.cash_balance_uyu, "UYU"),
    formatMoney(r.cash_balance_usd, "USD"),
    r.user_name ?? "",
    r.terminal_name ?? "",
    r.status ?? "",
  ];
}

function rowToCsv(r) {
  return cellsOf(r).map(esc).join(SEP);
}

/** CSV que Excel abre en columnas (BOM + sep=;). */
export function buildLedgerCsv(rows) {
  const lines = [HEADERS.map(esc).join(SEP)];
  for (const r of rows) lines.push(rowToCsv(r));
  return `\uFEFFsep=${SEP}\r\n${lines.join("\r\n")}`;
}

/** Descarga CSV de TODO lo filtrado (lotes de 1000 en el servidor). */
export async function exportLedgerCsv(filters) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await buildLedgerQuery(filters).range(
      offset,
      offset + BATCH - 1,
    );
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < BATCH) break;
    offset += BATCH;
  }
  const blob = new Blob([buildLedgerCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = filters.from
    ? filters.from.toISOString().slice(0, 10)
    : "historial";
  a.download = `movimientos_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
