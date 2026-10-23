import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { resolveObraHome } from "../../app/resolveHome";

/** Index de `/obra/:obraId` → hoy o resumen según rol. */
export default function ObraEntry() {
  const { obraId } = useParams();
  const { status, isCeo } = useAuth();
  const { obra, mi_rol, ready, known } = useObra();

  if (status === "loading" || !ready) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!known && !isCeo) {
    return <Navigate to="/obras" replace />;
  }

  if (!obra && isCeo) {
    // CEO puede abrir una obra aún no listada en caché recién creada
    return <Navigate to={`/obra/${obraId}/hoy`} replace />;
  }

  if (!obra) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Obra no encontrada.</Typography>
      </Box>
    );
  }

  const dest = resolveObraHome({ mi_rol });
  return <Navigate to={`/obra/${obraId}/${dest}`} replace />;
}
