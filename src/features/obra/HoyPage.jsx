import React from "react";
import { Navigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { PageActionsProvider } from "./PageActions";
import PageHeader, { usePagePadX } from "./PageHeader";
import SinAcceso from "./SinAcceso";

export default function HoyPage() {
  const { mi_rol, ready, known } = useObra();
  const padX = usePagePadX();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  // Owner usa Resumen; el menú lo oculta, la URL a mano muestra Sin acceso
  if (!controlTotalEnObra(mi_rol) && mi_rol === "owner") {
    return <SinAcceso />;
  }

  return (
    <PageActionsProvider>
      <PageHeader title="Hoy" titleIconSrc="/calendario.png" />
      <Box sx={{ px: padX, py: padX, maxWidth: 1200 }}>
        <Typography color="text.secondary">En construcción</Typography>
      </Box>
    </PageActionsProvider>
  );
}
