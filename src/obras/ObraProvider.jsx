import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useMisObras } from "./MisObrasProvider";
import { writeStoredObraId } from "./storage";

const ObraContext = createContext(null);

/**
 * Contexto de la obra actual: siempre desde `:obraId` en la URL.
 * Carga permisos según mi_rol de v_mis_obras.
 */
export function ObraProvider({ children }) {
  const { obraId } = useParams();
  const { isCeo } = useAuth();
  const { obras, ready } = useMisObras();
  const [permissions, setPermissions] = useState([]);

  const obra = useMemo(
    () => (obraId ? obras.find((o) => o.id === obraId) ?? null : null),
    [obras, obraId],
  );

  const mi_rol = obra?.mi_rol ?? (isCeo && obraId ? "ceo" : null);

  useEffect(() => {
    if (obraId) writeStoredObraId(obraId);
  }, [obraId]);

  // CEO de plataforma: isCeo (profiles) o mi_rol desde v_mis_obras.
  // Ambos deben dar acceso total; si solo mi_rol llega a 'ceo', no dejar permisos vacíos.
  const ceoAccess = Boolean(isCeo || mi_rol === "ceo");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (ceoAccess) {
        if (!cancelled) setPermissions(["*"]);
        return;
      }
      if (!mi_rol) {
        if (!cancelled) setPermissions([]);
        return;
      }
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", mi_rol);
      if (cancelled) return;
      if (error) {
        console.error("role_permissions:", error.message);
        setPermissions([]);
        return;
      }
      setPermissions((data ?? []).map((r) => r.permission));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mi_rol, ceoAccess]);

  const can = useCallback(
    (permission) => {
      if (ceoAccess) return true;
      return permissions.includes(permission);
    },
    [ceoAccess, permissions],
  );

  const value = useMemo(
    () => ({
      obraId: obraId ?? null,
      obra,
      mi_rol,
      can,
      ready,
      known: Boolean(obra) || (isCeo && Boolean(obraId)),
    }),
    [obraId, obra, mi_rol, can, ready, isCeo],
  );

  return <ObraContext.Provider value={value}>{children}</ObraContext.Provider>;
}

export function useObra() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObra debe usarse dentro de ObraProvider");
  return ctx;
}
