/**
 * Ruta interna a la que volver después de iniciar sesión.
 * Rechaza URLs externas y las pantallas de acceso.
 * @param {string | { pathname?: string, search?: string, hash?: string } | null | undefined} from
 * @param {string} fallback
 */
export function safeInternalPath(from, fallback = "/") {
  const path = typeof from === "string" ? from : from?.pathname;
  if (typeof path !== "string" || !isSafeAppPath(path)) return fallback;
  const search =
    typeof from === "object" && from && typeof from.search === "string"
      ? from.search
      : "";
  const hash =
    typeof from === "object" && from && typeof from.hash === "string"
      ? from.hash
      : "";
  if (search && !search.startsWith("?")) return fallback;
  if (hash && !hash.startsWith("#")) return fallback;
  return `${path}${search}${hash}`;
}

function isSafeAppPath(path) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }
  if (path === "/login" || path.startsWith("/login/") || path.startsWith("/login?")) {
    return false;
  }
  if (path === "/pin" || path.startsWith("/pin/") || path.startsWith("/pin?")) {
    return false;
  }
  return true;
}

/**
 * Si el usuario ya venía hacia esa sección, conserva la ruta concreta.
 * Si eligió la otra, entra por la portada de la sección.
 * @param {string} areaPath
 * @param {string | { pathname?: string, search?: string, hash?: string } | null | undefined} pendingFrom
 */
export function entryTarget(areaPath, pendingFrom) {
  const pending = safeInternalPath(pendingFrom, "");
  if (!pending) return areaPath;
  const pathOnly = pending.split(/[?#]/)[0];
  if (pathOnly === areaPath || pathOnly.startsWith(`${areaPath}/`)) return pending;
  return areaPath;
}

/** @param {string | { pathname?: string } | null | undefined} from */
export function sectionLabel(from) {
  const path = typeof from === "string" ? from : from?.pathname;
  if (typeof path !== "string") return null;
  if (path === "/construccion" || path.startsWith("/construccion/")) {
    return "Construcción";
  }
  if (path === "/administracion" || path.startsWith("/administracion/")) {
    return "Administración";
  }
  return null;
}
