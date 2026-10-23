import React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useMisObras } from "../../obras/MisObrasProvider";
import { resolveHome } from "../../app/resolveHome";

/** Redirige `/` según rol y obras de `v_mis_obras`. */
export default function HomeRedirect() {
  const { status, isCeo } = useAuth();
  const { obras, ready, loading } = useMisObras();

  if (status === "loading" || loading || !ready) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return <Navigate to={resolveHome({ isCeo, obras })} replace />;
}
