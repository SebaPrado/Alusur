export const ADMIN_ORG_KEY = "alusur.admin_org_id";
export const ADMIN_TERMINAL_KEY = "alusur.admin_terminal_id";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* modo privado */
  }
}

export function readOrgId() {
  return safeGet(ADMIN_ORG_KEY);
}

export function writeOrgId(id) {
  safeSet(ADMIN_ORG_KEY, id || null);
}

export function clearOrgId() {
  safeSet(ADMIN_ORG_KEY, null);
}

export function readTerminalId() {
  return safeGet(ADMIN_TERMINAL_KEY);
}

export function writeTerminalId(id) {
  safeSet(ADMIN_TERMINAL_KEY, id || null);
}

export function clearTerminalId() {
  safeSet(ADMIN_TERMINAL_KEY, null);
}
