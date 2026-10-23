import React from "react";
import { Box, Button, Dialog, DialogContent, Typography } from "@mui/material";
import { C, dialogPaperSx } from "./theme";

/**
 * Contraseña temporal de un solo uso. Al cerrar, el padre limpia el estado.
 */
export default function CredencialTemporalCard({
  open,
  onClose,
  fullName,
  email,
  password,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: 3,
            textAlign: "center",
            borderBottom: 1, borderColor: C.line,
          }}
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 1, color: C.text }}
          >
            {fullName}
          </Typography>
          <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 2 }}>
            {email}
          </Typography>
          <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 1 }}>
            Contraseña temporal (mostrada una sola vez)
          </Typography>
          <Typography
            sx={{
              color: C.text,
              fontSize: "1.25rem",
              fontWeight: 600,
              fontFamily: "monospace",
              letterSpacing: 1,
              wordBreak: "break-all",
            }}
          >
            {password}
          </Typography>
          <Typography sx={{ color: C.muted, fontSize: "0.8rem", mt: 2 }}>
            En el primer ingreso le va a pedir elegir una contraseña nueva.
          </Typography>
        </Box>
        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            onClick={onClose}
            sx={{
              color: C.bg,
              bgcolor: C.accent,
              borderRadius: 0,
              textTransform: "none",
              px: 2,
              "&:hover": { bgcolor: C.accent, opacity: 0.9 },
            }}
          >
            Listo
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
