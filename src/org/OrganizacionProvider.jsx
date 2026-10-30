import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { useMisObras } from "../obras/MisObrasProvider";
import { readOrgId, writeOrgId } from "../features/administracion/storage";
import {
  ORG_ACTIVA_KEY,
  elegirOrgActiva,
  normalizarContexto,
  obrasDeOrganizacion,
} from "./organizacion";

const OrganizacionContext = createContext(null);

function readStoredOrgId() {
  try {
    return localStorage.getItem(ORG_ACTIVA_KEY) || readOrgId();
  } catch {
    return readOrgId();
  }
}

function writeStoredOrgId(id) {
  try {
    if (id) localStorage.setItem(ORG_ACTIVA_KEY, id);
    else localStorage.removeItem(ORG_ACTIVA_KEY);
  } catch {
    /* modo privado */
  }
  writeOrgId(id || null);
}

export function clearStoredOrgId() {
  writeStoredOrgId(null);
}

export function OrganizacionProvider({ children }) {
  const { user, status } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [plataforma, setPlataforma] = useState(false);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [orgId, setOrgId] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("mi_contexto");
    if (err) {
      setError(err.message);
      setPlataforma(false);
      setOrganizaciones([]);
      setOrgId(null);
      return;
    }
    const ctx = normalizarContexto(data);
    setError(null);
    setPlataforma(ctx.plataforma);
    setOrganizaciones(ctx.organizaciones);
    const activa = elegirOrgActiva(ctx.organizaciones, readStoredOrgId());
    setOrgId(activa?.id ?? null);
    if (activa?.id) writeStoredOrgId(activa.id);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    await load();
    setReady(true);
  }, [user, load]);

  useEffect(() => {
    if (status === "loading") return undefined;
    if (!user?.id) {
      setPlataforma(false);
      setOrganizaciones([]);
      setOrgId(null);
      setError(null);
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      await load();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, status, load]);

  const setOrgActiva = useCallback((id) => {
    setOrgId(id || null);
    writeStoredOrgId(id || null);
  }, []);

  const orgActiva = organizaciones.find((o) => o.id === orgId) ?? null;

  const value = useMemo(
    () => ({
      ready: status !== "loading" && ready,
      error,
      plataforma,
      organizaciones,
      orgActiva,
      setOrgActiva,
      refresh,
    }),
    [status, ready, error, plataforma, organizaciones, orgActiva, setOrgActiva, refresh],
  );

  return (
    <OrganizacionContext.Provider value={value}>{children}</OrganizacionContext.Provider>
  );
}

export function useOrganizacion() {
  const ctx = useContext(OrganizacionContext);
  if (!ctx) throw new Error("useOrganizacion debe usarse dentro de OrganizacionProvider");
  return ctx;
}

/** Obras de v_mis_obras que pertenecen a la organización activa. */
export function useObrasDeLaOrg() {
  const mis = useMisObras();
  const { orgActiva } = useOrganizacion();
  const obras = obrasDeOrganizacion(mis.obras, orgActiva?.id);
  return { ...mis, obras, obrasTodas: mis.obras };
}
