/**
 * Códigos de pieza, únicos en todo el sistema.
 * Contenedor: PREFIJO-C-0001. Módulo: PREFIJO-C-0001-07-X.
 * La entrada acepta el prefijo de obra o no, con o sin guiones.
 * El dígito de control es Luhn mod 36 sobre el código sin ese dígito.
 */

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const MODULO_CON = /^([A-Z][A-Z0-9]{2})-C-(\d{4})-(\d{2})-([0-9A-Z])$/;
const MODULO_SIN = /^C-(\d{4})-(\d{2})-([0-9A-Z])$/;
const CONT_CON = /^([A-Z][A-Z0-9]{2})-C-(\d{4})$/;
const CONT_SIN = /^C-(\d{4})$/;

const MODULO_COMPACTO_CON = /^([A-Z][A-Z0-9]{2})C(\d{4})(\d{2})([0-9A-Z])$/;
const MODULO_COMPACTO_SIN = /^C(\d{4})(\d{2})([0-9A-Z])$/;
const CONT_COMPACTO_CON = /^([A-Z][A-Z0-9]{2})C(\d{4})$/;
const CONT_COMPACTO_SIN = /^C(\d{4})$/;

function limpiarEntrada(texto) {
  return String(texto ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

function partesConGuiones(texto) {
  let m = texto.match(MODULO_CON);
  if (m) return { prefijo: m[1], contenedor: m[2], posicion: m[3], control: m[4] };
  m = texto.match(MODULO_SIN);
  if (m) return { prefijo: null, contenedor: m[1], posicion: m[2], control: m[3] };
  m = texto.match(CONT_CON);
  if (m) return { prefijo: m[1], contenedor: m[2], posicion: null, control: null };
  m = texto.match(CONT_SIN);
  if (m) return { prefijo: null, contenedor: m[1], posicion: null, control: null };
  return null;
}

function partesCompacto(texto) {
  const compacto = texto.replace(/-/g, "");
  let m = compacto.match(MODULO_COMPACTO_CON);
  if (m) return { prefijo: m[1], contenedor: m[2], posicion: m[3], control: m[4] };
  m = compacto.match(MODULO_COMPACTO_SIN);
  if (m) return { prefijo: null, contenedor: m[1], posicion: m[2], control: m[3] };
  m = compacto.match(CONT_COMPACTO_CON);
  if (m) return { prefijo: m[1], contenedor: m[2], posicion: null, control: null };
  m = compacto.match(CONT_COMPACTO_SIN);
  if (m) return { prefijo: null, contenedor: m[1], posicion: null, control: null };
  return null;
}

/** Luhn mod 36. Mismo cálculo que la base: el guion del dígito no entra. */
export function digitoControl(base) {
  const s = String(base ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  let factor = 2;
  let total = 0;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    const code = ALFABETO.indexOf(s[i]);
    if (code < 0) return null;
    let addend = factor * code;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    total += addend;
  }
  return ALFABETO[(36 - (total % 36)) % 36];
}

export function partesCodigo(codigo) {
  const limpio = limpiarEntrada(codigo);
  if (!limpio) return null;
  return partesConGuiones(limpio) ?? partesCompacto(limpio);
}

export function formatearCodigo(partes) {
  if (!partes?.contenedor) return "";
  const cabeza = `${partes.prefijo ? `${partes.prefijo}-` : ""}C-${partes.contenedor}`;
  if (partes.posicion == null) return cabeza;
  return `${cabeza}-${partes.posicion}-${partes.control}`;
}

/** Mayúsculas, sin espacios. Si viene pegado (CIPC0001074), reinserta los guiones. */
export function normalizarCodigo(texto) {
  const partes = partesCodigo(texto);
  if (!partes) return limpiarEntrada(texto);
  return formatearCodigo(partes);
}

export function esCodigoContenedor(texto) {
  const partes = partesCodigo(texto);
  return Boolean(partes && partes.posicion == null && partes.control == null);
}

export function esCodigoModulo(texto) {
  const partes = partesCodigo(texto);
  if (!partes || partes.posicion == null || partes.control == null) return false;
  const base = `${partes.prefijo ? `${partes.prefijo}-` : ""}C-${partes.contenedor}-${partes.posicion}`;
  return partes.control === digitoControl(base);
}

/** Misma pieza aunque a una le falte el prefijo (obra activa). */
export function mismoCodigo(a, b) {
  const pa = partesCodigo(a);
  const pb = partesCodigo(b);
  if (!pa || !pb) return false;
  if (pa.contenedor !== pb.contenedor || pa.posicion !== pb.posicion || pa.control !== pb.control) {
    return false;
  }
  if (pa.prefijo && pb.prefijo) return pa.prefijo === pb.prefijo;
  return true;
}

export function limpiarPrefijoObra(texto) {
  return String(texto ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
}

/** Vacío es válido: la base genera el prefijo. Si hay texto, una letra y dos letras o números. */
export function prefijoObraValido(texto) {
  const t = String(texto ?? "").trim().toUpperCase();
  if (!t) return true;
  return /^[A-Z][A-Z0-9]{2}$/.test(t);
}

/** Placeholder del buscador. El ejemplo usa el prefijo de la obra activa. */
export function ejemploCodigoModulo(prefijo) {
  const p = limpiarPrefijoObra(prefijo);
  return p.length === 3 ? `${p}-C-0142-07-K` : "C-0142-07-K";
}
