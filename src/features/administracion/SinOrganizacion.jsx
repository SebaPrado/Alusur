import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@mui/material";

export default function SinOrganizacion() {
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
          Sin organización
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Tu usuario no está asignado a ninguna organización de administración.
          Pedile al dueño que te agregue.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Volver al inicio
        </Button>
      </Paper>
    </Box>
  );
}
