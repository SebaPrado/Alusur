/** Clave de la última organización elegida. */
export const ORG_ACTIVA_KEY = "alusur.org_activa_id";

/**
 * @param {unknown} data respuesta de mi_contexto()
 */
export function normalizarContexto(data) {
  const raw = data && typeof data === "object" ? data : {};
  const organizaciones = Array.isArray(raw.organizaciones) ? raw.organizaciones : [];
  return {
    plataforma: Boolean(raw.plataforma),
    organizaciones: organizaciones.map((o) => ({
      id: o?.id ?? null,
      nombre: o?.nombre ?? "",
      rol: o?.rol ?? null,
      areas: Array.isArray(o?.areas) ? o.areas : [],
    })),
  };
}

/**
 * La guardada, si sigue en la lista. Si no, la primera.
 * @param {Array<{ id: string }>|null|undefined} organizaciones
 * @param {string|null|undefined} storedId
 */
export function elegirOrgActiva(organizaciones, storedId) {
  const list = Array.isArray(organizaciones) ? organizaciones.filter((o) => o?.id) : [];
  if (list.length === 0) return null;
  if (storedId) {
    const found = list.find((o) => o.id === storedId);
    if (found) return found;
  }
  return list[0];
}

/**
 * Puede crear obras en la organización activa.
 * @param {{ plataforma?: boolean, org?: { rol?: string, areas?: string[] }|null }} args
 */
export function puedeCrearObras({ plataforma, org }) {
  if (!org) return false;
  const autorizado = Boolean(plataforma) || org.rol === "dueno";
  return autorizado && (org.areas ?? []).includes("construccion");
}

/**
 * Puede gestionar el equipo de Administración de la organización activa.
 * @param {{ plataforma?: boolean, org?: { rol?: string }|null }} args
 */
export function puedeGestionarEquipoAdmin({ plataforma, org }) {
  return Boolean(plataforma) || org?.rol === "dueno";
}

/**
 * Dueño, admin, o la plataforma: operan Administración (cotización, productos, cajas).
 * @param {{ plataforma?: boolean, org?: { rol?: string }|null }} args
 */
export function esManagerAdmin({ plataforma, org }) {
  const rol = org?.rol;
  return Boolean(plataforma) || rol === "dueno" || rol === "admin";
}

/**
 * Áreas que la pantalla de inicio puede ofrecer.
 * Un obrero (o alguien que solo está en obras) no entra a Administración.
 * @param {{ org?: { rol?: string, areas?: string[] }|null, esObrero?: boolean }} args
 * @returns {Array<"construccion"|"administracion">}
 */
export function areasVisibles({ org, esObrero }) {
  const areas = org?.areas ?? [];
  if (esObrero || org?.rol === "obra") {
    return areas.includes("construccion") ? ["construccion"] : [];
  }
  return ["construccion", "administracion"].filter((a) => areas.includes(a));
}

/**
 * @param {{ organizaciones?: unknown[]|null, esObrero?: boolean }} args
 */
export function mostrarSelectorOrganizacion({ organizaciones, esObrero }) {
  if (esObrero) return false;
  return (organizaciones?.length ?? 0) > 1;
}

/**
 * A dónde ir al elegir una organización, o al entrar si hay una sola área.
 * @param {{ org?: { rol?: string, areas?: string[] }|null, esObrero?: boolean }} args
 */
export function destinoAlCambiarOrg({ org, esObrero }) {
  if (esObrero || org?.rol === "obra") return "/construccion";
  const areas = areasVisibles({ org, esObrero: false });
  if (areas.length === 1) {
    return areas[0] === "administracion" ? "/administracion" : "/construccion";
  }
  return "/";
}

/**
 * @param {Array<{ organization_id?: string }>|null|undefined} obras
 * @param {string|null|undefined} organizationId
 */
export function obrasDeOrganizacion(obras, organizationId) {
  if (!organizationId) return [];
  return (obras ?? []).filter((o) => o?.organization_id === organizationId);
}
