import React from "react";
import { Navigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { PageActionsProvider } from "./PageActions";
import PageHeader, { usePagePadX } from "./PageHeader";
import SinAcceso from "./SinAcceso";

/** Incidencias: todos menos Owner. Quien tiene control total en la obra puede entrar. */
export default function IncidenciasPage() {
  const { mi_rol, ready, known } = useObra();
  const padX = usePagePadX();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  if (!controlTotalEnObra(mi_rol) && mi_rol === "owner") {
    return <SinAcceso />;
  }

  return (
    <PageActionsProvider>
      <PageHeader title="Incidencias" titleIconSrc="/advertencia.png" />
      <Box sx={{ px: padX, py: padX, maxWidth: 1200 }}>
        <Typography color="text.secondary">En construcción</Typography>
      </Box>
    </PageActionsProvider>
  );
}
