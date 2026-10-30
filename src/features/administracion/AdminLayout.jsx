import React from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { AdminOrgProvider, useAdminOrg } from "./AdminOrgProvider";
import { AdminToastProvider } from "./toast";
import SinOrganizacion from "./SinOrganizacion";

/** Providers comunes del área administración. */
export default function AdminProviders() {
  return (
    <AdminToastProvider>
      <AdminOrgProvider>
        <Outlet />
      </AdminOrgProvider>
    </AdminToastProvider>
  );
}

/**
 * Único gate del área: exige membresía y organización elegida.
 * No exige terminal ni caja (MIRAR ≠ OPERAR).
 */
export function AdminOrgRequired() {
  const { profile } = useAuth();
  const { ready, organizationId, areas, role, error } = useAdminOrg();

  if (!ready) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Box sx={{ p: 4 }}>Error al cargar organizaciones: {error}</Box>;
  }

  if (profile?.is_worker || role === "obra") {
    return (
      <Navigate
        to={areas.includes("construccion") ? "/construccion" : "/"}
        replace
      />
    );
  }

  if (!organizationId) {
    return <SinOrganizacion />;
  }

  if (!areas.includes("administracion")) {
    return (
      <Navigate
        to={areas.includes("construccion") ? "/construccion" : "/"}
        replace
      />
    );
  }

  return <Outlet />;
}
