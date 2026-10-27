import { moneyFractionDigits, roundMoneyCents } from "./money";

/**
 * Plata sin floats.
 * Importes en centavos, cantidades en milésimos, cotización en diezmilésimos
 * (40,1 → 401000). Cada conversión multiplica/divide enteros y redondea
 * half-away-from-zero una sola vez. El resultado de una moneda queda en
 * pesos enteros o dólares con un decimal.
 */

function abs(n) {
  return n < 0n ? -n : n;
}

/** round(a * b / denom), half away from zero. */
export function mulDivRound(a, b, denom) {
  if (denom === 0n) return null;
  const neg = (a < 0n) !== (b < 0n) !== (denom < 0n);
  const numer = abs(a) * abs(b);
  const d = abs(denom);
  const q = numer / d;
  const r = numer % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return neg ? -rounded : rounded;
}

/** "40,1" / "40.1000" / 40.1 → 401000n. Escala = decimales exactos. */
export function parseScaled(input, scale) {
  if (input == null) return null;
  let s = String(input).trim().replace(",", ".");
  if (!s) return null;
  let neg = false;
  if (s[0] === "-") {
    neg = true;
    s = s.slice(1);
  } else if (s[0] === "+") {
    s = s.slice(1);
  }
  if (s.endsWith(".")) s = s.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [intPart, frac = ""] = s.split(".");
  const base = 10n ** BigInt(scale);
  let scaled = BigInt(intPart) * base + BigInt(frac.slice(0, scale).padEnd(scale, "0") || "0");
  const rest = frac.slice(scale);
  if (rest.length && rest[0] >= "5") scaled += 1n;
  return neg ? -scaled : scaled;
}

export function parseMoneyToCents(input, currency) {
  const v = parseScaled(input, 2);
  if (v == null || v < 0n) return null;
  return currency ? roundMoneyCents(v, currency) : v;
}

export function parseQtyThousandths(input, { allowNegative = false } = {}) {
  const v = parseScaled(input, 3);
  if (v == null) return null;
  if (!allowNegative && v < 0n) return null;
  return v;
}

export function rateToTenThousandths(input) {
  const v = parseScaled(input, 4);
  if (v == null || v <= 0n) return null;
  return v;
}

export function scaledToDecimal(scaled, scale) {
  const neg = scaled < 0n;
  const a = neg ? -scaled : scaled;
  const base = 10n ** BigInt(scale);
  const frac = (a % base).toString().padStart(scale, "0");
  return `${neg ? "-" : ""}${a / base}.${frac}`;
}

/** Texto de input / payload: "1223" en pesos, "30.5" en dólares. */
export function centsToInput(cents, currency = "UYU") {
  const rounded = roundMoneyCents(cents, currency);
  const neg = rounded < 0n;
  const a = neg ? -rounded : rounded;
  const intPart = (a / 100n).toString();
  const digits = moneyFractionDigits(currency);
  if (digits === 0) return `${neg ? "-" : ""}${intPart}`;
  const frac = ((a % 100n) / 10n).toString();
  return `${neg ? "-" : ""}${intPart}.${frac}`;
}

export function qtyToInput(thousandths) {
  return scaledToDecimal(thousandths, 3)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

/** Misma regla que admin_convert. Devuelve centavos ya en la escala de `to`. */
export function convertCents(amountCents, from, to, rateTt) {
  if (amountCents == null || (from !== "UYU" && from !== "USD")) return null;
  if (to !== "UYU" && to !== "USD") return null;
  if (from === to) return roundMoneyCents(amountCents, to);
  if (rateTt == null || rateTt <= 0n) return null;
  const raw =
    from === "USD" && to === "UYU"
      ? mulDivRound(amountCents, rateTt, 10000n)
      : from === "UYU" && to === "USD"
        ? mulDivRound(amountCents, 10000n, rateTt)
        : null;
  return raw == null ? null : roundMoneyCents(raw, to);
}

export function lineTotalCents(unitPriceCents, qtyThousandths) {
  return mulDivRound(unitPriceCents, qtyThousandths, 1000n);
}

export function otherCurrency(currency) {
  return currency === "UYU" ? "USD" : "UYU";
}

/**
 * Vista previa en centavos de la moneda de la venta.
 * payments: { method, currency, amountCents, reference? } amountCents null = línea inválida.
 */
export function quoteSale({ lines, payments, saleCurrency, rateTt, changeCurrency }) {
  let totalCents = 0n;
  for (const line of lines) {
    totalCents += roundMoneyCents(
      lineTotalCents(line.unitPriceCents, line.qtyThousandths),
      saleCurrency,
    );
  }

  let paidCents = 0n;
  let cashCents = 0n;
  let convertible = true;
  for (const pay of payments) {
    if (pay.amountCents == null) {
      convertible = false;
      continue;
    }
    if (pay.amountCents <= 0n) continue;
    const applied = convertCents(pay.amountCents, pay.currency, saleCurrency, rateTt);
    if (applied == null) {
      convertible = false;
      continue;
    }
    paidCents += applied;
    if (pay.method === "efectivo") cashCents += applied;
  }

  const excessCents = paidCents - totalCents;
  const hasChange = excessCents > 0n && cashCents >= excessCents;
  let changeAmountCents = 0n;
  let changeAppliedCents = 0n;
  if (hasChange) {
    if (changeCurrency === saleCurrency) {
      changeAmountCents = excessCents;
    } else if (rateTt == null || rateTt <= 0n) {
      changeAmountCents = 0n;
      convertible = false;
    } else if (changeCurrency === "USD" && saleCurrency === "UYU") {
      changeAmountCents = mulDivRound(excessCents, 10000n, rateTt);
    } else if (changeCurrency === "UYU" && saleCurrency === "USD") {
      changeAmountCents = mulDivRound(excessCents, rateTt, 10000n);
    }
    if (changeAmountCents > 0n) {
      changeAmountCents = roundMoneyCents(changeAmountCents, changeCurrency);
    }
    if (changeAmountCents > 0n) {
      const applied = convertCents(changeAmountCents, changeCurrency, saleCurrency, rateTt);
      if (applied == null) convertible = false;
      else changeAppliedCents = applied;
    }
  }

  const netCents = paidCents - changeAppliedCents;
  const faltaCents = totalCents > netCents ? totalCents - netCents : 0n;
  const sobraCents = netCents > totalCents ? netCents - totalCents : 0n;
  const faltaOtherCents =
    faltaCents > 0n
      ? convertCents(faltaCents, saleCurrency, otherCurrency(saleCurrency), rateTt)
      : 0n;

  return {
    totalCents,
    paidCents,
    cashCents,
    excessCents,
    hasChange,
    changeAmountCents,
    changeAppliedCents,
    netCents,
    faltaCents,
    sobraCents,
    faltaOtherCents,
    convertible,
  };
}

export function canConfirmSale({
  condition,
  quote,
  itemCount,
  canOperate,
  hasCustomer,
  linesOk,
}) {
  if (!canOperate || itemCount <= 0 || !linesOk || !quote.convertible) return false;
  if (condition === "contado") return quote.netCents === quote.totalCents;
  if (condition === "credito") return Boolean(hasCustomer) && quote.netCents <= quote.totalCents;
  return false;
}

export function buildSaleItems(lines) {
  return lines.map((line) => ({
    product_id: line.productId,
    quantity: scaledToDecimal(line.qtyThousandths, 3),
    unit_price: scaledToDecimal(line.unitPriceCents, 2),
  }));
}

export function buildPayments(payments, change) {
  const out = [];
  for (const pay of payments) {
    if (pay.amountCents == null || pay.amountCents <= 0n) continue;
    const row = {
      method: pay.method,
      currency: pay.currency,
      amount: scaledToDecimal(pay.amountCents, 2),
    };
    const ref = pay.reference?.trim();
    if (ref) row.reference = ref;
    out.push(row);
  }
  if (change && change.amountCents > 0n) {
    out.push({
      method: "efectivo",
      currency: change.currency,
      amount: scaledToDecimal(change.amountCents, 2),
      change: true,
    });
  }
  return out;
}
