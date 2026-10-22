import React from "react";
import { Alert, Button, Paper, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

export default function SinObra() {
  const { profile, signOut } = useAuth();

  return (
    <Paper sx={{ p: 3, maxWidth: 520 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Sin obra asignada
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Hola {profile?.full_name || ""}. No perteneces a ninguna obra activa.
        Pide a un SuperAdmin o al CEO que te den de alta.
      </Alert>
      <Button variant="outlined" onClick={() => signOut()}>
        Cerrar sesión
      </Button>
    </Paper>
  );
}
