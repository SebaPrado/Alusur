import React from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useObrasDeLaOrg, useOrganizacion } from "../../org/OrganizacionProvider";
import { areasVisibles, puedeCrearObras } from "../../org/organizacion";
import { resolveHome } from "../../app/resolveHome";

/** Redirige `/construccion` según la organización activa y sus obras. */
export default function HomeRedirect() {
  const { status, profile } = useAuth();
  const { ready: orgReady, plataforma, orgActiva } = useOrganizacion();
  const { obras, ready, loading } = useObrasDeLaOrg();
  const esObrero = Boolean(profile?.is_worker);

  if (status === "loading" || !orgReady || loading || !ready) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const areas = areasVisibles({ org: orgActiva, esObrero });
  if (!areas.includes("construccion")) {
    return (
      <Navigate
        to={areas.includes("administracion") ? "/administracion" : "/"}
        replace
      />
    );
  }

  return (
    <Navigate
      to={resolveHome({
        veListado: puedeCrearObras({ plataforma, org: orgActiva }),
        obras,
      })}
      replace
    />
  );
}
