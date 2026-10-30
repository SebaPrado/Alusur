import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

export default function RequireAuth({ children }) {
  const { status, session, recoveryPending } = useAuth();
  const location = useLocation();

  if (status === "loading") {
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

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  const mustChange =
    session.user?.app_metadata?.must_change_password === true;
  const onNewPassword = location.pathname === "/nueva-contrasena";
  const onChangePassword =
    location.pathname === "/elegir-contrasena" || onNewPassword;

  if (recoveryPending && !onNewPassword) {
    return <Navigate to="/nueva-contrasena" replace />;
  }

  if (mustChange && !onChangePassword) {
    return <Navigate to="/elegir-contrasena" replace />;
  }

  return children ?? <Outlet />;
}
