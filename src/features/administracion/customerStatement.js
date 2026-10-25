/**
 * Historial de cuenta corriente: ventas usan currency/total;
 * pagos usan applied_currency/applied_amount (nunca amount físico).
 */

function moneySide(currency, amount, side) {
  const uyu = { debeUyu: null, haberUyu: null };
  const usd = { debeUsd: null, haberUsd: null };
  if (currency === "UYU") {
    if (side === "debe") uyu.debeUyu = amount;
    else uyu.haberUyu = amount;
  } else if (currency === "USD") {
    if (side === "debe") usd.debeUsd = amount;
    else usd.haberUsd = amount;
  }
  return { ...uyu, ...usd };
}

/** @returns {{ at: string, concept: string, voided: boolean, debeUyu: number|null, haberUyu: number|null, debeUsd: number|null, haberUsd: number|null, key: string }[]} */
export function buildCustomerStatement(sales, payments) {
  const rows = [];

  for (const s of sales ?? []) {
    if (s.kind !== "venta") continue;
    const voided = s.status === "anulada";
    const sides = moneySide(s.currency, s.total, "debe");
    rows.push({
      key: `sale-${s.id}`,
      at: s.created_at,
      concept: `Venta Nº ${s.number}`,
      voided,
      ...sides,
    });
  }

  for (const p of payments ?? []) {
    const voided = p.status === "anulado";
    let concept;
    let side;
    if (p.kind === "venta") {
      concept = "Pago de venta";
      side = "haber";
    } else if (p.kind === "cobranza") {
      concept = "Cobranza";
      side = "haber";
    } else if (p.kind === "vuelto") {
      concept = "Vuelto";
      side = "debe";
    } else if (p.kind === "reintegro") {
      concept = "Reintegro";
      side = "debe";
    } else {
      continue;
    }
    const sides = moneySide(p.applied_currency, p.applied_amount, side);
    rows.push({
      key: `pay-${p.id}`,
      at: p.created_at,
      concept,
      voided,
      ...sides,
    });
  }

  rows.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return a.key.localeCompare(b.key);
  });
  return rows;
}

export function customerDocErrorMessage(error) {
  if (!error) return null;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "");
  const details = String(error.details ?? "");
  if (
    code === "23505" &&
    (msg.includes("admin_customers_doc_uq") ||
      details.includes("admin_customers_doc_uq"))
  ) {
    return "Ya existe un cliente con ese documento";
  }
  return null;
}
