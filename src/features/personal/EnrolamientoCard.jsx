import React, { useEffect } from "react";
import { Box, Button, Dialog, DialogContent, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { C, dialogPaperSx } from "./theme";

/**
 * Tarjeta de enrolamiento: QR = solo worker_code. PIN solo si se pasa (alta / nuevo PIN).
 * Al cerrar, el padre debe limpiar el estado del PIN.
 */
export default function EnrolamientoCard({
  open,
  onClose,
  fullName,
  workerCode,
  pin = null,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const style = document.createElement("style");
    style.setAttribute("data-enrolamiento-print", "1");
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #enrolamiento-print, #enrolamiento-print * { visibility: visible !important; }
        #enrolamiento-print {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
          color: black !important;
          padding: 24px !important;
        }
        #enrolamiento-print .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [open]);

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
          id="enrolamiento-print"
          sx={{
            p: 3,
            textAlign: "center",
            borderBottom: 1, borderColor: C.line,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 2, color: C.text }}>
            {fullName}
          </Typography>
          {workerCode ? (
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <Box sx={{ bgcolor: "#fff", p: 1.5 }}>
                <QRCodeSVG value={workerCode} size={160} level="M" />
              </Box>
            </Box>
          ) : null}
          <Typography sx={{ color: C.muted, fontFamily: "monospace", mb: 1 }}>
            {workerCode || "—"}
          </Typography>
          {pin != null && pin !== "" ? (
            <Typography sx={{ color: C.text, fontSize: "1.25rem", fontWeight: 600, letterSpacing: 4 }}>
              PIN: {pin}
            </Typography>
          ) : (
            <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
              Solo código (sin PIN)
            </Typography>
          )}
          <Box className="no-print" sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
            <Button
              onClick={() => window.print()}
              sx={{
                color: C.accent,
                borderRadius: 0,
                border: 1, borderColor: C.accent,
                textTransform: "none",
              }}
            >
              Imprimir
            </Button>
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
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
