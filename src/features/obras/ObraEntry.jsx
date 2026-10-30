import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { resolveObraHome } from "../../app/resolveHome";

/** Index de `/obra/:obraId` → Progreso. */
export default function ObraEntry() {
  const { obraId } = useParams();
  const { status } = useAuth();
  const { obra, ready, known } = useObra();

  if (status === "loading" || !ready) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!known) {
    return <Navigate to="/construccion/obras" replace />;
  }

  if (!obra) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">Obra no encontrada.</Typography>
      </Box>
    );
  }

  const dest = resolveObraHome();
  return <Navigate to={`/obra/${obraId}/${dest}`} replace />;
}
