import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { clearStoredObraId } from "../obras/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
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

    setProfile(profileRow);
    return { profile: profileRow };
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    if (!s?.user) {
      setProfile(null);
      setStatus("ready");
      return;
    }
    await loadUserData(s.user.id);
    setStatus("ready");
  }, [loadUserData]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        await loadUserData(s.user.id);
      }
      if (mounted) setStatus("ready");
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT" || !s?.user) {
        setProfile(null);
        setLoadError(null);
        clearStoredObraId();
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
        await loadUserData(s.user.id);
        setStatus("ready");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    clearStoredObraId();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      isCeo,
      loadError,
      signOut,
      refresh,
    }),
    [status, session, profile, isCeo, loadError, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
