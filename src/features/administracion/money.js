function groupThousands(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Centavos enteros → "$ 1.223,05" / "U$S 30,50". Sin pasar por float. */
export function formatCents(cents, currency) {
  if (cents == null) return currency === "USD" ? "U$S —" : "$ —";
  const n = typeof cents === "bigint" ? cents : BigInt(cents);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const body = `${neg ? "-" : ""}${groupThousands((a / 100n).toString())},${(a % 100n).toString().padStart(2, "0")}`;
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

/** "Falta: U$S 30,50 (= $ 1.223,05)". Sin equivalente si no hay cotización. */
export function faltaLabel(faltaCents, saleCurrency, otherCents, otherCurrency) {
  const main = `Falta: ${formatCents(faltaCents, saleCurrency)}`;
  if (otherCents == null) return main;
  return `${main} (= ${formatCents(otherCents, otherCurrency)})`;
}

/** Formato uruguayo: $ 1.234,56 / U$S 1.234,56 */
export function formatMoney(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return currency === "USD" ? "U$S —" : "$ —";
  const formatted = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return currency === "USD" ? `U$S ${formatted}` : `$ ${formatted}`;
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
