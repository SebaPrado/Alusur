import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

const MisObrasContext = createContext(null);

/** Caché a nivel de módulo: una sola consulta por usuario, incluso con StrictMode. */
const cache = {
  userId: null,
  promise: null,
  /** @type {Array|null} null = no cargado; [] = cargado vacío */
  data: null,
  error: null,
};

async function fetchMisObras(userId) {
  if (cache.userId === userId && cache.data !== null) {
    return { data: cache.data, error: cache.error };
  }
  if (cache.userId === userId && cache.promise) {
    return cache.promise;
  }

  cache.userId = userId;
  cache.promise = (async () => {
    const { data, error } = await supabase
      .from("v_mis_obras")
      .select("*")
      .order("nombre");
    if (error) {
      cache.data = [];
      cache.error = error.message;
      cache.promise = null;
      return { data: [], error: error.message };
    }
    const rows = data ?? [];
    cache.data = rows;
    cache.error = null;
    cache.promise = null;
    return { data: rows, error: null };
  })();

  return cache.promise;
}

function invalidateMisObrasCache() {
  cache.userId = null;
  cache.promise = null;
  cache.data = null;
  cache.error = null;
}

/**
 * Una sola consulta a v_mis_obras por carga autenticada,
 * compartida entre HomeRedirect, barra, menú y listado.
 */
export function MisObrasProvider({ children }) {
  const { status: authStatus, session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [obras, setObras] = useState(null); // null hasta cargar para ESTE usuario
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastUser = useRef(null);

  const load = useCallback(async (uid, { force = false } = {}) => {
    if (force) invalidateMisObrasCache();
    setLoading(true);
    setError(null);
    const result = await fetchMisObras(uid);
    // Ignorar resultado si el usuario ya cambió
    if (cache.userId === uid || force) {
      setObras(result.data);
      setError(result.error);
    }
    setLoading(false);
    return result.data;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setObras([]);
      return [];
    }
    setObras(null);
    return load(userId, { force: true });
  }, [userId, load]);

  useEffect(() => {
    if (authStatus !== "ready") return;

    if (!userId) {
      invalidateMisObrasCache();
      lastUser.current = null;
      setObras(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Cambio de usuario → no usar datos viejos (evita “sin obras” con [] stale)
    if (lastUser.current !== userId) {
      lastUser.current = userId;
      setObras(null);
      setError(null);
    }

    if (cache.userId === userId && cache.data !== null) {
      setObras(cache.data);
      setError(cache.error);
      return;
    }

    load(userId);
  }, [authStatus, userId, load]);

  const ready = authStatus === "ready" && (!userId || obras !== null);

  const value = useMemo(
    () => ({
      obras: obras ?? [],
      ready,
      loading: loading || (authStatus === "ready" && !!userId && obras === null),
      error,
      refresh,
    }),
    [obras, ready, loading, authStatus, userId, error, refresh],
  );

  return (
    <MisObrasContext.Provider value={value}>{children}</MisObrasContext.Provider>
  );
}

export function useMisObras() {
  const ctx = useContext(MisObrasContext);
  if (!ctx) throw new Error("useMisObras debe usarse dentro de MisObrasProvider");
  return ctx;
}
