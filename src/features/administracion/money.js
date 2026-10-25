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
