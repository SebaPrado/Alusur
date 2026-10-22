import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const OBRA_KEY = "alusur.obra_id";

const AuthContext = createContext(null);

function readStoredObraId() {
  try {
    return localStorage.getItem(OBRA_KEY);
  } catch {
    return null;
  }
}

function writeStoredObraId(id) {
  try {
    if (id) localStorage.setItem(OBRA_KEY, id);
    else localStorage.removeItem(OBRA_KEY);
  } catch {
    /* modo privado */
  }
}

/**
 * @typedef {Object} Membership
 * @property {string} obra_id
 * @property {string} user_id
 * @property {string} empresa_id
 * @property {'superadmin'|'admin'|'obrero'|'owner'} role
 * @property {boolean} active
 * @property {{ id: string, nombre: string, ubicacion: string|null, activa: boolean }|null} obra
 * @property {{ id: string, nombre: string }|null} empresa
 */

/**
 * @typedef {Object} ObraActiva
 * @property {string} id
 * @property {string} nombre
 * @property {string|null} ubicacion
 * @property {boolean} activa
 * @property {'superadmin'|'admin'|'obrero'|'owner'|'ceo'|null} role
 * @property {string|null} empresa_id
 * @property {{ id: string, nombre: string }|null} empresa
 * @property {boolean} isMember
 */

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  /** @type {[string[], Function]} */
  const [ceoObras, setCeoObras] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [obraId, setObraId] = useState(() => readStoredObraId());
  const [loadError, setLoadError] = useState(null);

  const isCeo = profile?.platform_role === "ceo";

  const loadUserData = useCallback(async (userId) => {
    setLoadError(null);
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, platform_role, is_worker")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("profiles:", profileErr.message);
      setLoadError(profileErr.message);
    }

    // empresa_id no tiene FK directa a empresas (pasa por obra_empresas),
    // así que cargamos empresas en una segunda consulta.
    const { data: memberRows, error: memberErr } = await supabase
      .from("obra_members")
      .select(
        `
        obra_id,
        user_id,
        empresa_id,
        role,
        active,
        obra:obras ( id, nombre, ubicacion, activa )
      `,
      )
      .eq("user_id", userId)
      .eq("active", true);

    if (memberErr) {
      console.error("obra_members:", memberErr.message);
      setLoadError((prev) => prev ?? memberErr.message);
    }

    const empresaIds = [
      ...new Set((memberRows ?? []).map((m) => m.empresa_id).filter(Boolean)),
    ];
    let empresasById = {};
    if (empresaIds.length > 0) {
      const { data: empresas, error: empErr } = await supabase
        .from("empresas")
        .select("id, nombre")
        .in("id", empresaIds);
      if (empErr) console.error("empresas:", empErr.message);
      for (const e of empresas ?? []) empresasById[e.id] = e;
    }

    const members = (memberRows ?? []).map((m) => ({
      ...m,
      obra: Array.isArray(m.obra) ? m.obra[0] ?? null : m.obra,
      empresa: empresasById[m.empresa_id] ?? null,
    }));

    let obrasCeo = [];
    if (profileRow?.platform_role === "ceo") {
      const { data: allObras, error: obrasErr } = await supabase
        .from("obras")
        .select("id, nombre, ubicacion, activa")
        .eq("activa", true)
        .order("nombre");
      if (obrasErr) console.error("obras (ceo):", obrasErr.message);
      obrasCeo = allObras ?? [];
    }

    setProfile(profileRow);
    setMemberships(members);
    setCeoObras(obrasCeo);

    // Resolver obra activa
    const stored = readStoredObraId();
    const memberObraIds = new Set(members.map((m) => m.obra_id));
    const ceoObraIds = new Set(obrasCeo.map((o) => o.id));
    const isCeoNow = profileRow?.platform_role === "ceo";

    let nextObraId = null;
    if (members.length === 1) {
      nextObraId = members[0].obra_id;
    } else if (stored && (memberObraIds.has(stored) || (isCeoNow && ceoObraIds.has(stored)))) {
      nextObraId = stored;
    } else if (stored && isCeoNow && !memberObraIds.has(stored) && ceoObraIds.has(stored)) {
      nextObraId = stored;
    } else if (members.length === 0 && isCeoNow && obrasCeo.length === 1) {
      nextObraId = obrasCeo[0].id;
    } else if (stored && memberObraIds.has(stored)) {
      nextObraId = stored;
    }
    // Si hay varias y no hay stored válido → nextObraId queda null (ElegirObra)

    setObraId(nextObraId);
    writeStoredObraId(nextObraId);

    return { profile: profileRow, memberships: members, obraId: nextObraId };
  }, []);

  const loadPermissions = useCallback(async (role, ceo) => {
    if (ceo) {
      setPermissions(["*"]);
      return;
    }
    if (!role) {
      setPermissions([]);
      return;
    }
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission")
      .eq("role", role);
    if (error) {
      console.error("role_permissions:", error.message);
      setPermissions([]);
      return;
    }
    setPermissions((data ?? []).map((r) => r.permission));
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (!s?.user) {
      setProfile(null);
      setMemberships([]);
      setCeoObras([]);
      setPermissions([]);
      setObraId(null);
      setStatus("ready");
      return;
    }
    const loaded = await loadUserData(s.user.id);
    const member = (loaded.memberships ?? []).find((m) => m.obra_id === loaded.obraId);
    const ceo = loaded.profile?.platform_role === "ceo";
    await loadPermissions(member?.role ?? null, ceo);
    setStatus("ready");
  }, [loadUserData, loadPermissions]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const loaded = await loadUserData(s.user.id);
        if (!mounted) return;
        const member = (loaded.memberships ?? []).find((m) => m.obra_id === loaded.obraId);
        const ceo = loaded.profile?.platform_role === "ceo";
        await loadPermissions(member?.role ?? null, ceo);
      }
      if (mounted) setStatus("ready");
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        if (event === "SIGNED_OUT" || !s?.user) {
          setProfile(null);
          setMemberships([]);
          setCeoObras([]);
          setPermissions([]);
          setObraId(null);
          setLoadError(null);
          writeStoredObraId(null);
          setStatus("ready");
          return;
        }
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION"
        ) {
          setStatus("loading");
          const loaded = await loadUserData(s.user.id);
          const member = (loaded.memberships ?? []).find((m) => m.obra_id === loaded.obraId);
          const ceo = loaded.profile?.platform_role === "ceo";
          await loadPermissions(member?.role ?? null, ceo);
          setStatus("ready");
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, loadPermissions]);

  // Recargar permisos cuando cambia la obra activa
  useEffect(() => {
    if (status !== "ready" || !session?.user) return;
    const member = memberships.find((m) => m.obra_id === obraId);
    loadPermissions(member?.role ?? null, isCeo);
  }, [obraId, memberships, isCeo, status, session, loadPermissions]);

  const setObraActiva = useCallback((id) => {
    setObraId(id);
    writeStoredObraId(id);
  }, []);

  const signOut = useCallback(async () => {
    writeStoredObraId(null);
    setObraId(null);
    await supabase.auth.signOut();
  }, []);

  /** @type {ObraActiva|null} */
  const obraActiva = useMemo(() => {
    if (!obraId) return null;
    const member = memberships.find((m) => m.obra_id === obraId);
    if (member?.obra) {
      return {
        id: member.obra.id,
        nombre: member.obra.nombre,
        ubicacion: member.obra.ubicacion,
        activa: member.obra.activa,
        role: member.role,
        empresa_id: member.empresa_id,
        empresa: member.empresa,
        isMember: true,
      };
    }
    if (isCeo) {
      const obra = ceoObras.find((o) => o.id === obraId);
      if (obra) {
        return {
          id: obra.id,
          nombre: obra.nombre,
          ubicacion: obra.ubicacion,
          activa: obra.activa,
          role: "ceo",
          empresa_id: null,
          empresa: null,
          isMember: false,
        };
      }
    }
    return null;
  }, [obraId, memberships, ceoObras, isCeo]);

  const can = useCallback(
    (permission) => {
      if (isCeo) return true;
      return permissions.includes(permission);
    },
    [isCeo, permissions],
  );

  /** Obras disponibles para el selector (membresías + obras CEO no membresía) */
  const availableObras = useMemo(() => {
    const byId = new Map();
    for (const m of memberships) {
      if (!m.obra) continue;
      byId.set(m.obra_id, {
        id: m.obra.id,
        nombre: m.obra.nombre,
        ubicacion: m.obra.ubicacion,
        role: m.role,
        isMember: true,
      });
    }
    if (isCeo) {
      for (const o of ceoObras) {
        if (!byId.has(o.id)) {
          byId.set(o.id, {
            id: o.id,
            nombre: o.nombre,
            ubicacion: o.ubicacion,
            role: "ceo",
            isMember: false,
          });
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [memberships, ceoObras, isCeo]);

  const needsObraPick = useMemo(() => {
    if (!session) return false;
    if (obraActiva) return false;
    return availableObras.length > 1;
  }, [session, obraActiva, availableObras]);

  const value = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      memberships,
      availableObras,
      obraActiva,
      setObraActiva,
      needsObraPick,
      can,
      isCeo,
      loadError,
      signOut,
      refresh,
    }),
    [
      status,
      session,
      profile,
      memberships,
      availableObras,
      obraActiva,
      setObraActiva,
      needsObraPick,
      can,
      isCeo,
      loadError,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
