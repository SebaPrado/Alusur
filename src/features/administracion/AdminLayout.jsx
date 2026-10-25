import React from "react";
import { Box, CircularProgress } from "@mui/material";
import { Outlet } from "react-router-dom";
import { AdminOrgProvider, useAdminOrg } from "./AdminOrgProvider";
import { AdminToastProvider } from "./toast";
import ElegirOrganizacion from "./ElegirOrganizacion";
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
  const { ready, memberships, organizationId, error } = useAdminOrg();

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

  if (memberships.length === 0) {
    return <SinOrganizacion />;
  }

  if (!organizationId) {
    return <ElegirOrganizacion />;
  }

  return <Outlet />;
}
