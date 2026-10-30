import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import {
  AUTH_LINK_EXPIRED,
  authLinkErrorMessage,
  urlIndicatesPasswordRecovery,
} from "./passwordRecovery";
import { useAuth } from "./AuthProvider";

/**
 * Antes de pintar la home: manda el recupero a `/nueva-contrasena`
 * y un enlace vencido al login, y limpia la URL.
 */
export default function AuthUrlGate() {
  const location = useLocation();
  const { status, session, recoveryPending, abandonRecovery } = useAuth();
  const linkError = authLinkErrorMessage(location.search, location.hash);
  const recoveryUrl = urlIndicatesPasswordRecovery(
    location.search,
    location.hash,
  );
  const recoveryWithoutSession =
    status === "ready" && recoveryPending && !session;

  useEffect(() => {
    if (!recoveryWithoutSession) return;
    abandonRecovery();
  }, [recoveryWithoutSession, abandonRecovery]);

  const expiredOnLogin =
    location.pathname === "/login" &&
    typeof location.state?.authLinkError === "string" &&
    location.state.authLinkError.length > 0;

  if (
    linkError &&
    (location.pathname !== "/login" || location.search || location.hash)
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ authLinkError: linkError }}
      />
    );
  }

  if (recoveryWithoutSession && (linkError || recoveryUrl)) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ authLinkError: AUTH_LINK_EXPIRED }}
      />
    );
  }

  if (expiredOnLogin) {
    return <Outlet />;
  }

  if (
    recoveryPending &&
    !recoveryWithoutSession &&
    location.pathname !== "/nueva-contrasena"
  ) {
    if (status !== "ready") {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress />
        </Box>
      );
    }
    return <Navigate to="/nueva-contrasena" replace />;
  }

  return <Outlet />;
}
