import React from "react";
import { Navigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { PageActionsProvider } from "./PageActions";
import PageHeader, { pagePadX } from "./PageHeader";
import SinAcceso from "./SinAcceso";

export default function ResumenPage() {
  const { isCeo } = useAuth();
  const { mi_rol, ready, known } = useObra();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  // Solo Owner (CEO puede entrar por URL)
  if (!isCeo && mi_rol !== "owner") {
    return <SinAcceso />;
  }

  return (
    <PageActionsProvider>
      <PageHeader title="Resumen" />
      <Box sx={{ px: pagePadX, py: pagePadX, maxWidth: 1200 }}>
        <Typography color="text.secondary">En construcción</Typography>
      </Box>
    </PageActionsProvider>
  );
}
