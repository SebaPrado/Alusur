function groupThousands(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Pesos enteros. Dólares con un decimal (décimos). */
export function moneyFractionDigits(currency) {
  return currency === "USD" ? 1 : 0;
}

function moneyUnit(currency) {
  return currency === "USD" ? 10n : 100n;
}

/** Centavos → múltiplo de $ 1 o de U$S 0,1. Half away from zero. */
export function roundMoneyCents(cents, currency) {
  if (cents == null) return null;
  const n = typeof cents === "bigint" ? cents : BigInt(cents);
  const unit = moneyUnit(currency);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const q = a / unit;
  const r = a % unit;
  const rounded = (r * 2n >= unit ? q + 1n : q) * unit;
  return neg ? -rounded : rounded;
}

function majorUnitsToCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const neg = n < 0;
  const [intPart, frac] = Math.abs(n).toFixed(4).split(".");
  let cents = BigInt(intPart) * 100n + BigInt(frac.slice(0, 2));
  if (frac[2] >= "5") cents += 1n;
  return neg ? -cents : cents;
}

/** Centavos enteros → "$ 1.223" / "U$S 30,5". */
export function formatCents(cents, currency) {
  if (cents == null) return currency === "USD" ? "U$S —" : "$ —";
  const n = roundMoneyCents(cents, currency);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const digits = moneyFractionDigits(currency);
  let body = `${neg ? "-" : ""}${groupThousands((a / 100n).toString())}`;
  if (digits > 0) {
    body += `,${(a % 100n).toString().padStart(2, "0").slice(0, digits)}`;
  }
  return currency === "USD" ? `U$S ${body}` : `$ ${body}`;
}

/** Cotización (diezmilésimos) → "$ 40,10". */
export function formatRateLabel(rateTt) {
  const a = rateTt < 0n ? -rateTt : rateTt;
  const intStr = groupThousands((a / 10000n).toString());
  let frac = (a % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `$ ${intStr},${frac}`;
}

/** "Falta: U$S 30,5 (= $ 1.223)". Sin equivalente si no hay cotización. */
export function faltaLabel(faltaCents, saleCurrency, otherCents, otherCurrency) {
  const main = `Falta: ${formatCents(faltaCents, saleCurrency)}`;
  if (otherCents == null) return main;
  return `${main} (= ${formatCents(otherCents, otherCurrency)})`;
}

/** Importe en unidades mayores → "$ 1.234" / "U$S 1.234,5". */
export function formatMoney(amount, currency) {
  const cents = majorUnitsToCents(amount);
  if (cents == null) return currency === "USD" ? "U$S —" : "$ —";
  return formatCents(cents, currency);
}

/** dd/mm/aaaa hh:mm:ss */
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Cotización vieja si el día local de valid_from ≠ hoy. */
export function isRateStale(validFrom) {
  if (!validFrom) return true;
  const d = new Date(validFrom);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  return (
    d.getFullYear() !== now.getFullYear() ||
    d.getMonth() !== now.getMonth() ||
    d.getDate() !== now.getDate()
  );
}

export function signedMoney(amount, currency) {
  const n = Number(amount) || 0;
  if (n === 0) return formatMoney(0, currency);
  const abs = formatMoney(Math.abs(n), currency);
  return n > 0 ? `+${abs}` : `−${abs}`;
}
