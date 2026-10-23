import React from "react";
import { Box, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

export default function SinObra() {
  const { profile } = useAuth();

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 4 },
      }}
    >
      <Typography component="h1" sx={{ fontWeight: 700, fontSize: "1.25rem", mb: 1.5 }}>
        Sin obras asignadas
      </Typography>
      <Typography color="text.secondary">
        Hola {profile?.full_name || ""}. Todavía no tenés obras asignadas.
        Pedile a un SuperAdmin o al CEO que te den de alta.
      </Typography>
    </Box>
  );
}
