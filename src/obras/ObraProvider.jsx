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
import { useMisObras } from "./MisObrasProvider";
import { controlTotalEnObra } from "./accesoObra";
import { writeStoredObraId } from "./storage";

const ObraContext = createContext(null);

/**
 * Contexto de la obra actual: siempre desde `:obraId` en la URL.
 * Carga permisos según mi_rol de v_mis_obras.
 */
export function ObraProvider({ children }) {
  const { obraId } = useParams();
  const { obras, ready } = useMisObras();
  const [permissions, setPermissions] = useState([]);

  const obra = useMemo(
    () => (obraId ? obras.find((o) => o.id === obraId) ?? null : null),
    [obras, obraId],
  );

  const mi_rol = obra?.mi_rol ?? null;

  useEffect(() => {
    if (obraId) writeStoredObraId(obraId);
  }, [obraId]);

  const controlTotal = controlTotalEnObra(mi_rol);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (controlTotal) {
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
  }, [mi_rol, controlTotal]);

  const can = useCallback(
    (permission) => {
      if (controlTotal) return true;
      return permissions.includes(permission);
    },
    [controlTotal, permissions],
  );

  const value = useMemo(
    () => ({
      obraId: obraId ?? null,
      obra,
      mi_rol,
      can,
      ready,
      known: Boolean(obra),
    }),
    [obraId, obra, mi_rol, can, ready],
  );

  return <ObraContext.Provider value={value}>{children}</ObraContext.Provider>;
}

export function useObra() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObra debe usarse dentro de ObraProvider");
  return ctx;
}
