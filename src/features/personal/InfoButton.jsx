import React from "react";
import { IconButton } from "@mui/material";
import { C } from "./theme";

/** Botón «i» circular para abrir ayuda contextual. */
export default function InfoButton({ onClick, label = "Más información", size = 18 }) {
  return (
    <IconButton
      type="button"
      aria-label={label}
      onClick={onClick}
      size="small"
      sx={{
        width: size,
        height: size,
        p: 0,
        ml: 0.5,
        border: 1, borderColor: C.muted,
        borderRadius: "50%",
        color: C.muted,
        fontSize: size * 0.55,
        fontWeight: 700,
        fontStyle: "italic",
        lineHeight: 1,
        fontFamily: "inherit",
        opacity: 0.85,
        "&:hover": {
          borderColor: C.accent,
          color: C.accent,
          bgcolor: "transparent",
          opacity: 1,
        },
      }}
    >
      i
    </IconButton>
  );
}
