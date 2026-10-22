import { supabase } from "./supabase";

const WORKER_CODE_KEY = "alusur.worker_code";

// Enrolamiento: el QR solo contiene el worker_code (ej. "W-48213").
export function saveWorkerCode(code) {
  try { localStorage.setItem(WORKER_CODE_KEY, code.trim().toUpperCase()); } catch { /* modo privado */ }
}

export function getWorkerCode() {
  try { return localStorage.getItem(WORKER_CODE_KEY); } catch { return null; }
}

export function forgetDevice() {
  try { localStorage.removeItem(WORKER_CODE_KEY); } catch { /* noop */ }
  return supabase.auth.signOut();
}

// Login con PIN. Devuelve { ok: true } o { ok: false, reason: 'invalid'|'locked', lockedUntil }
export async function workerLogin(pin) {
  const worker_code = getWorkerCode();
  if (!worker_code) return { ok: false, reason: "not_enrolled" };

  const { data, error } = await supabase.functions.invoke("worker-login", {
    body: { worker_code, pin },
  });

  if (error) {
    // functions.invoke devuelve el status en error.context
    const status = error.context?.status;
    if (status === 429) {
      const body = await error.context.json().catch(() => ({}));
      return { ok: false, reason: "locked", lockedUntil: body.locked_until };
    }
    return { ok: false, reason: "invalid" };
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: "email",
  });
  if (otpError) return { ok: false, reason: "invalid" };

  return { ok: true };
}
