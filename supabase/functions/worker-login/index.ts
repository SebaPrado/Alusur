// worker-login — login de obreros con código + PIN de 4 dígitos.
//
// Flujo:
//   1. Cliente envía { worker_code, pin }  (worker_code lo guarda el móvil tras el enrolamiento)
//   2. verify_worker_pin() valida el hash y aplica bloqueo (5 fallos → 15 min)
//   3. Generamos un magic link para el email sintético del obrero y devolvemos
//      solo el token_hash (nunca se envía ningún email)
//   4. Cliente: supabase.auth.verifyOtp({ token_hash, type: 'email' }) → sesión normal
//
// Desplegar SIN verificación de JWT (el obrero aún no tiene sesión):
//   npx supabase functions deploy worker-login --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { worker_code?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const workerCode = (body.worker_code ?? "").trim().toUpperCase();
  const pin = (body.pin ?? "").trim();
  if (!/^W-\d{5}$/.test(workerCode) || !/^\d{4}$/.test(pin)) {
    return json({ error: "invalid_credentials" }, 401);
  }

  const { data: result, error } = await admin.rpc("verify_worker_pin", {
    p_worker_code: workerCode,
    p_pin: pin,
  });
  if (error) {
    console.error("verify_worker_pin", error);
    return json({ error: "server_error" }, 500);
  }

  if (result.status === "locked") {
    return json({ error: "locked", locked_until: result.locked_until }, 429);
  }
  if (result.status !== "ok") {
    // respuesta genérica: no revelamos si el código existe o el PIN es incorrecto
    return json({ error: "invalid_credentials" }, 401);
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(result.user_id);
  if (userErr || !userData.user?.email) {
    console.error("getUserById", userErr);
    return json({ error: "server_error" }, 500);
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr || !link.properties?.hashed_token) {
    console.error("generateLink", linkErr);
    return json({ error: "server_error" }, 500);
  }

  return json({ token_hash: link.properties.hashed_token });
});
