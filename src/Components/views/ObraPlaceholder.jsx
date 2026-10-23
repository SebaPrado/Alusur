import React from "react";
import { Box, Typography } from "@mui/material";
import { pagePadX } from "../../features/obra/PageHeader";

/**
 * Placeholder mínimo dentro de una obra.
 * @param {{ title?: string, bare?: boolean, fill?: boolean }} props
 *   bare: solo el texto (cuando el layout padre ya tiene título/pestañas).
 *   fill: ocupa todo el alto del contenedor (Torre 3D).
 */
export default function ObraPlaceholder({ title, bare = false, fill = false }) {
  if (bare) {
    if (fill) {
      return (
        <Box
          sx={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
          }}
        >
          <Typography color="text.secondary">En construcción</Typography>
        </Box>
      );
    }
    return <Typography color="text.secondary">En construcción</Typography>;
  }

  return (
    <Box sx={{ p: pagePadX }}>
      <Typography
        component="h1"
        sx={{ fontWeight: 700, fontSize: "1.125rem", mb: 1 }}
      >
        {title}
      </Typography>
      <Typography color="text.secondary">En construcción</Typography>
    </Box>
  );
}
