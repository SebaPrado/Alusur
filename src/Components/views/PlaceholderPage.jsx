import React from "react";
import { Typography, Box } from "@mui/material";

/**
 * Pantalla hueco legada (pasos 2–6).
 * Las rutas de obra usan ObraPlaceholder; se conserva este archivo.
 */
export default function PlaceholderPage({ title }) {
  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary">En construcción</Typography>
    </Box>
  );
}
