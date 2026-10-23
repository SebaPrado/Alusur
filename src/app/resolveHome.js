/**
 * Decide a dónde va el usuario al entrar (`/`).
 * @param {{ isCeo: boolean, obras: Array<{ id: string, mi_rol?: string }> }} args
 * @returns {string} path
 */
export function resolveHome({ isCeo, obras }) {
  if (isCeo) return "/obras";
  const list = (obras ?? []).filter((o) => o?.id && o.mi_rol);
  if (list.length === 0) return "/sin-obras";
  if (list.length === 1) {
    const { id, mi_rol } = list[0];
    return mi_rol === "owner" ? `/obra/${id}/resumen` : `/obra/${id}/hoy`;
  }
  return "/obras";
}

/**
 * Destino al entrar a `/obra/:obraId` (index).
 * @param {{ mi_rol?: string|null }} args
 */
export function resolveObraHome({ mi_rol }) {
  return mi_rol === "owner" ? "resumen" : "hoy";
}
