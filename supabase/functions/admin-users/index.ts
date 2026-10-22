// admin-users — alta de usuarios y reseteo de PIN.
// Lo llama un CEO o SuperAdmin logueado (con su JWT).
//
// Acciones:
//   { action: "create_worker", obra_id, empresa_id, full_name, pin }
//       → crea obrero (email sintético + PIN), lo añade a la obra como 'obrero'
//       → devuelve { user_id, worker_code }   (worker_code va en el QR de enrolamiento)
//
//   { action: "create_user", obra_id, empresa_id, role, full_name, email, password? }
//       → usuario con email (admin, superadmin, owner). Si el email ya existe,
//         solo lo añade a la obra. Sin password → envía invitación por email.
//
//   { action: "reset_pin", obra_id, user_id, pin }
//       → nuevo PIN para un obrero de esa obra (desbloquea también)
//
// La JERARQUÍA de roles NO se valida aquí: se llama a assign_role() con el JWT
// del que llama, y es la base de datos quien decide. Esta función solo hace lo
// que requiere service_role (crear usuarios en auth, hashear PIN).

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Body = {
  action: "create_worker" | "create_user" | "reset_pin";
  obra_id: string;
  empresa_id?: string;
  role?: "superadmin" | "admin" | "obrero" | "owner";
  full_name?: string;
  email?: string;
  password?: string;
  pin?: string;
  user_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // Cliente que actúa COMO el usuario que llama → RLS y RPCs aplican sus permisos
  const caller = createClient(URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: me } = await caller.auth.getUser();
  if (!me.user) return json({ error: "unauthorized" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!body.obra_id) return json({ error: "obra_id requerido" }, 400);

  // Chequeo temprano para no crear usuarios huérfanos si no tiene permiso
  const { data: canManage } = await caller.rpc("has_perm", {
    p_obra: body.obra_id,
    p_perm: "members.manage",
  });
  if (!canManage) return json({ error: "forbidden" }, 403);

  try {
    switch (body.action) {
      case "create_worker":
        return await createWorker(caller, body);
      case "create_user":
        return await createUser(caller, body);
      case "reset_pin":
        return await resetPin(caller, body);
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 400);
  }
});

async function createWorker(caller: SupabaseClient, b: Body) {
  if (!b.full_name?.trim()) throw new Error("full_name requerido");
  if (!b.empresa_id) throw new Error("empresa_id requerido");
  if (!/^\d{4}$/.test(b.pin ?? "")) throw new Error("El PIN debe tener 4 dígitos");

  const email = `w_${crypto.randomUUID()}@workers.alusur.internal`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(), // nunca se usa
    email_confirm: true,
    user_metadata: { full_name: b.full_name.trim() },
    app_metadata: { is_worker: true },
  });
  if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
  const userId = created.user.id;

  // Asignar rol COMO el que llama (la BD valida jerarquía)
  const { error: roleErr } = await caller.rpc("assign_role", {
    p_obra: b.obra_id,
    p_user: userId,
    p_empresa: b.empresa_id,
    p_role: "obrero",
  });
  if (roleErr) {
    await admin.auth.admin.deleteUser(userId); // rollback
    throw new Error(roleErr.message);
  }

  const { data: workerCode, error: pinErr } = await admin.rpc("set_worker_pin", {
    p_user: userId,
    p_pin: b.pin,
  });
  if (pinErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(pinErr.message);
  }

  return json({ user_id: userId, worker_code: workerCode });
}

async function createUser(caller: SupabaseClient, b: Body) {
  if (!b.email?.trim()) throw new Error("email requerido");
  if (!b.empresa_id) throw new Error("empresa_id requerido");
  if (!b.role) throw new Error("role requerido");
  if (b.role === "obrero") throw new Error("Para obreros usa create_worker");

  const email = b.email.trim().toLowerCase();
  let createdNow = false;

  // ¿Ya existe? (p.ej. alguien de ALUMAN que ya está en otra obra)
  const { data: existingId } = await admin.rpc("user_id_by_email", { p_email: email });
  let userId: string | null = existingId;

  if (!userId) {
    if (b.password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: b.password,
        email_confirm: true,
        user_metadata: { full_name: b.full_name?.trim() ?? "" },
      });
      if (error || !data.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: b.full_name?.trim() ?? "" },
      });
      if (error || !data.user) throw new Error(error?.message ?? "No se pudo invitar al usuario");
      userId = data.user.id;
    }
    createdNow = true;
  }

  const { error: roleErr } = await caller.rpc("assign_role", {
    p_obra: b.obra_id,
    p_user: userId,
    p_empresa: b.empresa_id,
    p_role: b.role,
  });
  if (roleErr) {
    if (createdNow) await admin.auth.admin.deleteUser(userId!);
    throw new Error(roleErr.message);
  }

  return json({ user_id: userId, existed: !createdNow });
}

async function resetPin(caller: SupabaseClient, b: Body) {
  if (!b.user_id) throw new Error("user_id requerido");
  if (!/^\d{4}$/.test(b.pin ?? "")) throw new Error("El PIN debe tener 4 dígitos");

  // Solo obreros activos de ESA obra (lo leemos con los permisos del que llama)
  const { data: member } = await caller
    .from("obra_members")
    .select("role, active")
    .eq("obra_id", b.obra_id)
    .eq("user_id", b.user_id)
    .maybeSingle();
  if (!member || !member.active || member.role !== "obrero") {
    throw new Error("Solo se puede resetear el PIN de obreros activos de esta obra");
  }

  const { data: workerCode, error } = await admin.rpc("set_worker_pin", {
    p_user: b.user_id,
    p_pin: b.pin,
  });
  if (error) throw new Error(error.message);
  return json({ worker_code: workerCode });
}
