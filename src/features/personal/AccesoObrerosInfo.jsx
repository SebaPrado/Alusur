import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { FiMoreVertical } from "react-icons/fi";
import { C, dialogPaperSx } from "./theme";

/** Mismo control de tres puntos de la fila del trabajador. */
function MenuDots() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        mx: 0.5,
        verticalAlign: "-4px",
        color: C.text,
        border: 1,
        borderColor: C.line,
      }}
    >
      <FiMoreVertical size={13} />
    </Box>
  );
}

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
      "Son 4 dígitos que genera el sistema al dar de alta. Solo vos y otros administradores los ven.",
      <>
        Al dar de alta, primero necesitás el{" "}
        <Box component="span" sx={{ color: C.text, fontWeight: 600 }}>
          código de 6 dígitos
        </Box>
        .
      </>,
      "Luego, con el PIN, el trabajador ingresa a diario.",
      <>
        Si se olvida el PIN o queda bloqueado (10 intentos fallidos: 15 min, 30, 1 h… hasta 24 h),
        usá Nuevo PIN: genera uno nuevo. La opción está en
        <MenuDots />.
      </>,
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
          fontSize: "1.05rem",
          lineHeight: 1.3,
          px: 2.5,
          py: 1.25,
        }}
      >
        {info.title}
      </DialogTitle>
      <DialogContent
        sx={{
          px: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
        }}
      >
        {info.body.map((p, i) => (
          <Typography
            key={i}
            sx={{
              color: C.muted,
              fontSize: "0.875rem",
              lineHeight: 1.45,
              m: 0,
            }}
          >
            {p}
          </Typography>
        ))}
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 2, py: 1 }}>
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
