const PERMISSION_FALLBACK = "No tenés permiso para esta acción";

function looksEnglish(msg) {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("new row violates") ||
    m.includes("jwt") ||
    (/\b(denied|forbidden|unauthorized|violates|policy)\b/i.test(msg) &&
      !/[áéíóúñ¿¡]/i.test(msg))
  );
}

/**
 * Mensaje para toast: texto del RPC tal cual;
 * si 42501 o mensaje en inglés → fallback en español.
 */
export function rpcErrorMessage(error) {
  if (!error) return "Error desconocido";
  const code = String(error.code ?? error.errcode ?? "");
  const msg = String(error.message ?? "").trim();
  if (code === "42501" || looksEnglish(msg)) {
    return PERMISSION_FALLBACK;
  }
  return msg || PERMISSION_FALLBACK;
}
