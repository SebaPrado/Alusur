import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Snackbar } from "@mui/material";
import { supabase } from "../lib/supabase";
import { clearStoredObraId } from "../obras/storage";
import {
  PASSWORD_UPDATED,
  RECOVERY_STORAGE_KEY,
  urlIndicatesPasswordRecovery,
} from "./passwordRecovery";

function readRecoveryPending() {
  if (typeof window === "undefined") return false;
  try {
    if (urlIndicatesPasswordRecovery(window.location.search, window.location.hash)) {
      return true;
    }
    return sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [recoveryPending, setRecoveryPending] = useState(readRecoveryPending);
  const [passwordNotice, setPasswordNotice] = useState("");

  const loadUserData = useCallback(async (userId) => {
    setLoadError(null);
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, is_worker")
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
    try {
      if (recoveryPending) sessionStorage.setItem(RECOVERY_STORAGE_KEY, "1");
      else sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    } catch {
      /* modo privado */
    }
  }, [recoveryPending]);

  const abandonRecovery = useCallback(() => {
    setRecoveryPending(false);
  }, []);

  const notifyPasswordUpdated = useCallback(() => {
    setRecoveryPending(false);
    setPasswordNotice(PASSWORD_UPDATED);
  }, []);

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
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryPending(true);
      }
      if (event === "SIGNED_OUT") {
        setRecoveryPending(false);
        setProfile(null);
        setLoadError(null);
        clearStoredObraId();
        setStatus("ready");
        return;
      }
      if (!s?.user) {
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
        event === "INITIAL_SESSION" ||
        event === "PASSWORD_RECOVERY"
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
      loadError,
      recoveryPending,
      abandonRecovery,
      notifyPasswordUpdated,
      signOut,
      refresh,
    }),
    [
      status,
      session,
      profile,
      loadError,
      recoveryPending,
      abandonRecovery,
      notifyPasswordUpdated,
      signOut,
      refresh,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(passwordNotice)}
        autoHideDuration={5000}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          setPasswordNotice("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setPasswordNotice("")}
          sx={{ borderRadius: 0 }}
        >
          {passwordNotice}
        </Alert>
      </Snackbar>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
