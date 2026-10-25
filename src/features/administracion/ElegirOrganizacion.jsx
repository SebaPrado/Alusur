import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { useAdminOrg } from "./AdminOrgProvider";

export default function ElegirOrganizacion() {
  const { memberships, setOrganization } = useAdminOrg();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          Elegí la organización
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Tenés acceso a más de una. Seleccioná con cuál trabajar.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {memberships.map((m) => (
            <Button
              key={m.organizationId}
              variant="outlined"
              size="large"
              onClick={() => setOrganization(m.organizationId)}
              sx={{ justifyContent: "space-between", borderRadius: 0 }}
            >
              <span>{m.organizationName}</span>
              <Typography component="span" variant="caption" color="text.secondary">
                {m.role}
              </Typography>
            </Button>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
