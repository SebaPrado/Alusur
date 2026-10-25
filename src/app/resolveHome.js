/**
 * Decide a dónde va el usuario al entrar a Construcción (`/construccion`).
 * @param {{ isCeo: boolean, obras: Array<{ id: string, mi_rol?: string }> }} args
 * @returns {string} path
 */
export function resolveHome({ isCeo, obras }) {
  if (isCeo) return "/construccion/obras";
  const list = (obras ?? []).filter((o) => o?.id && o.mi_rol);
  if (list.length === 0) return "/construccion/sin-obras";
  if (list.length === 1) {
    const { id, mi_rol } = list[0];
    return mi_rol === "owner"
      ? `/construccion/obra/${id}/resumen`
      : `/construccion/obra/${id}/hoy`;
  }
  return "/construccion/obras";
}

/**
 * Destino al entrar a `/obra/:obraId` (index).
 * @param {{ mi_rol?: string|null }} args
 */
export function resolveObraHome({ mi_rol }) {
  return mi_rol === "owner" ? "resumen" : "hoy";
}
