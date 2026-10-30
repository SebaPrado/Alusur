export const AUTH_LINK_EXPIRED =
  "El enlace venció o ya se usó. Pedí uno nuevo.";

export const RESET_EMAIL_NOTICE =
  "Si ese mail está registrado, te llegó un enlace para elegir una contraseña nueva.";

export const PASSWORD_UPDATED = "Contraseña actualizada";

export const RECOVERY_STORAGE_KEY = "alusur.passwordRecovery";

const ERROR_KEYS = ["error", "error_code", "error_description"];

function paramsOf(value) {
  if (typeof value !== "string" || value.length === 0) return new URLSearchParams();
  const raw = value[0] === "?" || value[0] === "#" ? value.slice(1) : value;
  return new URLSearchParams(raw);
}

function hasAuthError(params) {
  return ERROR_KEYS.some((key) => {
    const value = params.get(key);
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Mensaje para el login si la URL (query o hash) trae un error de Auth.
 * Cualquier `error`, `error_code` o `error_description` cuenta: no distinguimos
 * el motivo para no filtrar si el enlace existió.
 * @param {string} [search]
 * @param {string} [hash]
 * @returns {string | null}
 */
export function authLinkErrorMessage(search = "", hash = "") {
  if (hasAuthError(paramsOf(search)) || hasAuthError(paramsOf(hash))) {
    return AUTH_LINK_EXPIRED;
  }
  return null;
}

/**
 * El hash o la query traen `type=recovery` y no un error de enlace.
 * @param {string} [search]
 * @param {string} [hash]
 */
export function urlIndicatesPasswordRecovery(search = "", hash = "") {
  if (authLinkErrorMessage(search, hash)) return false;
  return (
    paramsOf(search).get("type") === "recovery" ||
    paramsOf(hash).get("type") === "recovery"
  );
}

/**
 * @param {string} password
 * @param {string} confirm
 * @returns {string | null}
 */
export function validateNewPassword(password, confirm) {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña tiene que tener al menos 8 caracteres";
  }
  if (password !== confirm) {
    return "Las contraseñas no coinciden";
  }
  return null;
}
