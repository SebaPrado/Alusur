export const OBRA_KEY = "alusur.obra_id";
export const NAV_COLLAPSED_KEY = "alusur.nav_collapsed";

export function writeStoredObraId(id) {
  try {
    if (id) localStorage.setItem(OBRA_KEY, id);
    else localStorage.removeItem(OBRA_KEY);
  } catch {
    /* modo privado */
  }
}

export function clearStoredObraId() {
  try {
    localStorage.removeItem(OBRA_KEY);
  } catch {
    /* modo privado */
  }
}

/** Preferencia de menú lateral plegado. Sin valor → abierto. */
export function readNavCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeNavCollapsed(collapsed) {
  try {
    localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* modo privado */
  }
}

