/** Formato es-UY para cuentas corrientes: US$ 1.234,56 / $ 1.234,56 */

function groupThousands(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Importe en unidades mayores → "US$ 1.234,56" / "$ 1.234,56". */
export function formatCcMoney(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return currency === "USD" ? "US$ —" : "$ —";
  const neg = n < 0;
  const abs = Math.abs(n);
  const [intPart, frac = "00"] = abs.toFixed(2).split(".");
  const body = `${neg ? "−" : ""}${groupThousands(intPart)},${frac}`;
  return currency === "USD" ? `US$ ${body}` : `$ ${body}`;
}

/** Fecha YYYY-MM-DD (Postgres date) → dd/mm/aaaa sin correr zona horaria. */
export function formatCcDate(isoDate) {
  if (!isoDate) return "";
  const s = String(isoDate).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Mismo signo que admin_cc_signo: positivo = nos deben más. */
export function adminCcSigno(lado, tipo) {
  if (lado === "venta" && tipo === "factura") return 1;
  if (lado === "venta") return -1;
  if (lado === "compra" && tipo === "factura") return -1;
  return 1;
}

export function etiquetaContraparte(esProveedor, esCliente) {
  if (esProveedor && esCliente) return "Proveedor y cliente";
  if (esProveedor) return "Proveedor";
  if (esCliente) return "Cliente";
  return "";
}

/** Frase corta de un saldo en una moneda. */
export function fraseSaldoMoneda(saldo, currency) {
  const n = Number(saldo) || 0;
  if (n === 0) return null;
  if (n > 0) return `Te debe ${formatCcMoney(n, currency)}`;
  return `Le debés ${formatCcMoney(Math.abs(n), currency)}`;
}

/**
 * Frase de saldos UYU + USD (sin sumar monedas).
 * Ambas 0 → "Están a mano".
 * Misma dirección → "Te debe US$ X y $ Y" / "Le debés …".
 */
export function fraseSaldos(saldoUyu, saldoUsd) {
  const nUyu = Number(saldoUyu) || 0;
  const nUsd = Number(saldoUsd) || 0;
  if (nUyu === 0 && nUsd === 0) return "Están a mano";

  const dir = (n) => (n > 0 ? "te" : n < 0 ? "le" : null);
  const dUyu = dir(nUyu);
  const dUsd = dir(nUsd);

  if (dUyu && dUsd && dUyu === dUsd) {
    const amounts = [
      formatCcMoney(Math.abs(nUsd), "USD"),
      formatCcMoney(Math.abs(nUyu), "UYU"),
    ];
    if (dUyu === "te") return `Te debe ${amounts.join(" y ")}`;
    return `Le debés ${amounts.join(" y ")}`;
  }

  const bits = [];
  const usd = fraseSaldoMoneda(nUsd, "USD");
  const uyu = fraseSaldoMoneda(nUyu, "UYU");
  if (usd) bits.push(usd);
  if (uyu) bits.push(uyu);
  return bits.join(" · ");
}

/** Frase corta para saldo_acumulado en tabla. */
export function fraseSaldoCorto(saldo, currency) {
  const n = Number(saldo) || 0;
  if (n === 0) return "A mano";
  if (n > 0) return `Te debe ${formatCcMoney(n, currency)}`;
  return `Le debés ${formatCcMoney(Math.abs(n), currency)}`;
}

export function tipoEnPalabras(tipo, medio) {
  if (tipo === "factura") return "Factura";
  if (tipo === "nota_credito") return "Nota de crédito";
  if (tipo === "pago") {
    const medios = {
      transferencia: "transferencia",
      efectivo: "efectivo",
      cheque: "cheque",
      otro: "otro",
    };
    const m = medios[medio];
    return m ? `Pago por ${m}` : "Pago";
  }
  return tipo ?? "";
}

/** Concepto de fila: tipo + número + concepto. */
export function conceptoMovimiento(mv) {
  const parts = [tipoEnPalabras(mv.tipo, mv.medio)];
  if (mv.numero) parts.push(mv.numero);
  const base = parts.join(" ");
  if (mv.concepto) return `${base} · ${mv.concepto}`;
  return base;
}

/**
 * Vista previa del efecto: saldo actual de esa moneda + importe × signo.
 * Si se pasa oldMov (edición), se deshace primero el efecto anterior en esa moneda.
 */
export function fraseVistaPrevia(
  saldoActual,
  lado,
  tipo,
  importe,
  currency,
  oldMov = null,
) {
  const n = Number(importe);
  if (!Number.isFinite(n) || n <= 0) return null;
  const signo = adminCcSigno(lado, tipo);
  let base = Number(saldoActual) || 0;
  if (oldMov && !oldMov.anulado && oldMov.moneda === currency) {
    base -= signo * (Number(oldMov.importe) || 0);
  }
  const next = base + signo * n;
  if (next === 0) return "Después de esto van a estar a mano";
  if (next > 0) {
    return `Después de esto te va a deber ${formatCcMoney(next, currency)}`;
  }
  return `Después de esto le vas a deber ${formatCcMoney(Math.abs(next), currency)}`;
}

export function absMax(a, b) {
  return Math.max(Math.abs(Number(a) || 0), Math.abs(Number(b) || 0));
}
