/**
 * Decide a dónde va el usuario al entrar a Construcción (`/construccion`).
 * Quien puede crear obras ve el listado, aunque tenga una sola.
 * @param {{ veListado: boolean, obras: Array<{ id: string, mi_rol?: string }> }} args
 * @returns {string} path
 */
export function resolveHome({ veListado, obras }) {
  if (veListado) return "/construccion/obras";
  const list = (obras ?? []).filter((o) => o?.id && o.mi_rol);
  if (list.length === 0) return "/construccion/sin-obras";
  if (list.length === 1) {
    return `/construccion/obra/${list[0].id}/progreso/torre`;
  }
  return "/construccion/obras";
}

/**
 * Destino al entrar a `/obra/:obraId` (index).
 * Progreso es la primera sección del menú.
 */
export function resolveObraHome() {
  return "progreso/torre";
}
