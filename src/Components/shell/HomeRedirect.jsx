import React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

/** Redirige `/` según el rol de la obra activa. */
export default function HomeRedirect() {
  const { status, profile, obraActiva, needsObraPick, isCeo, availableObras } =
    useAuth();

  if (status === "loading") {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (needsObraPick) {
    return <Navigate to="/elegir-obra" replace />;
  }

  if (!obraActiva) {
    if (isCeo) return <Navigate to="/obras" replace />;
    if (availableObras.length === 0) {
      return <Navigate to="/sin-obra" replace />;
    }
    return <Navigate to="/elegir-obra" replace />;
  }

  if (profile?.is_worker || obraActiva.role === "obrero") {
    return <Navigate to="/campo" replace />;
  }

  switch (obraActiva.role) {
    case "admin":
      return <Navigate to="/incidencias" replace />;
    case "superadmin":
      return <Navigate to="/equipo" replace />;
    case "owner":
      return <Navigate to="/avance" replace />;
    case "ceo":
      return <Navigate to="/obras" replace />;
    default:
      return <Navigate to="/sin-obra" replace />;
  }
}
