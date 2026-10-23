import React from "react";
import { Typography } from "@mui/material";
import { C } from "../personal/theme";

export default function RecepcionesPage() {
  return (
    <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
      Las recepciones se registran desde la app del obrero. Disponible próximamente.
    </Typography>
  );
}
