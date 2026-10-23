import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { C, dialogPaperSx } from "./theme";

/** Una ficha corta por cada botón «i». */
const TOPICS = {
  acceso: {
    title: "¿Cómo entra un obrero a la app?",
    body: [
      "Los obreros no tienen email. Entran con dos datos: el código (QR de la tarjeta) y un PIN de 4 dígitos.",
      "La primera vez escanean el QR en el celular. El teléfono guarda el código y, de ahí en más, solo escriben el PIN.",
      "Dar de alta obreros y generar PIN nuevos solo lo pueden hacer los CEO y SuperAdmin.",
    ],
  },
  codigo: {
    title: "Código y QR",
    body: [
      "Es el identificador del obrero, por ejemplo W-03047. El QR de la tarjeta es ese mismo código.",
      "Va separado del PIN: quien fotografíe la tarjeta tiene el código, pero sin el PIN no puede entrar.",
      "Hay que volver a escanear el QR si cambia de celular, borra los datos del navegador, o en iPhone si pasa varios días sin usar la app.",
      "Para eso usá Reimprimir QR. El PIN no cambia.",
    ],
  },
  pin: {
    title: "PIN",
    body: [
      "Son 4 dígitos que genera el sistema al dar de alta. Solo quien administra los ve en esta lista.",
      "No alcanza con el PIN solo: hace falta el código guardado en el celular (o el QR).",
      "Pedile al obrero que no lo comparta. Entregá la tarjeta en mano.",
      "Si se olvida o queda bloqueado (10 intentos fallidos: 15 min, 30, 1 h… hasta 24 h), usá Nuevo PIN: genera uno nuevo, desbloquea al momento y el anterior deja de servir.",
    ],
  },
};

/** Panel de ayuda contextual según el botón «i» que se abrió. */
export default function AccesoObrerosInfo({ open, onClose, topic = "acceso" }) {
  const info = TOPICS[topic] ?? TOPICS.acceso;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle
        sx={{
          borderBottom: 1, borderColor: C.line,
          fontWeight: 700,
          fontSize: "1.1rem",
        }}
      >
        {info.title}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {info.body.map((p) => (
          <Typography
            key={p}
            sx={{
              color: C.muted,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              mb: 1,
            }}
          >
            {p}
          </Typography>
        ))}
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 2, py: 1.5 }}>
        <Button
          onClick={onClose}
          sx={{
            color: C.text,
            borderRadius: 0,
            border: 1, borderColor: C.line,
            textTransform: "none",
          }}
        >
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
