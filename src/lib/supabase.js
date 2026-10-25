import { createClient } from "@supabase/supabase-js";
import { readTerminalId } from "../features/administracion/storage";

const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY");
}

/** Inyecta x-terminal-id desde localStorage sin recrear el client. */
function fetchWithTerminal(input, init = {}) {
  const headers = new Headers(init.headers ?? {});
  const terminalId = readTerminalId();
  if (terminalId) {
    headers.set("x-terminal-id", terminalId);
  }
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: fetchWithTerminal,
  },
});
