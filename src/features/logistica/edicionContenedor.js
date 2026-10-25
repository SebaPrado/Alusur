import { normalizarCodigo } from "../../lib/codigos";

/**
 * La base decide. En `libre` lo puede borrar quien tenga permiso.
 * El CEO, en pruebas, también borra un contenedor en tránsito o en obra
 * (`con_motivo` / `bloqueado`). Si ya hay rastro, la base lo rechaza.
 */
export function puedeEliminar(nivel, ceo = false) {
  if (nivel === "libre") return true;
  if (ceo && (nivel === "con_motivo" || nivel === "bloqueado")) return true;
  return false;
}

/** Estados a los que la tabla `transiciones` deja pasar desde el actual. */
export function estadosAlcanzables(estado, transiciones) {
  const vistos = new Set();
  const salida = [];
  for (const t of transiciones ?? []) {
    if (t.from_state !== estado || !t.to_state || vistos.has(t.to_state)) continue;
    vistos.add(t.to_state);
    salida.push(t.to_state);
  }
  return salida;
}

/** Hay que escribir el código completo, con prefijo. */
export function confirmacionCoincide(escrito, codigo) {
  const a = normalizarCodigo(escrito);
  const b = normalizarCodigo(codigo);
  return Boolean(a) && a === b;
}
