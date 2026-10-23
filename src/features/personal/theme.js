/**
 * Tokens de UI alineados al tema global (sin hex sueltos).
 * Usar en `sx` como paths de palette (`bgcolor: C.bg`).
 */
export const C = {
  bg: "background.default",
  text: "text.primary",
  muted: "text.secondary",
  accent: "primary.main",
  line: "divider",
  danger: "error.main",
};

export const fieldSx = {
  "& .MuiInputBase-root": {
    color: C.text,
    borderRadius: 0,
    bgcolor: "transparent",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: C.line,
    borderRadius: 0,
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: C.muted,
  },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: C.accent,
  },
  "& .MuiInputLabel-root": { color: C.muted },
  "& .MuiInputLabel-root.Mui-focused": { color: C.accent },
  "& .MuiFormHelperText-root": { color: C.muted },
  "& .MuiSelect-icon": { color: C.muted },
};

export const dialogPaperSx = {
  bgcolor: C.bg,
  color: C.text,
  borderRadius: 0,
  border: 1,
  borderColor: C.line,
  boxShadow: "none",
};

/** Menú del Select (portal): fondo oscuro y texto legible */
export const selectMenuProps = {
  PaperProps: {
    sx: {
      bgcolor: C.bg,
      color: C.text,
      borderRadius: 0,
      border: 1,
      borderColor: C.line,
      boxShadow: "none",
      "& .MuiMenuItem-root": {
        color: C.text,
        borderRadius: 0,
        "&:hover": { bgcolor: C.line },
        "&.Mui-selected": {
          bgcolor: "rgba(36, 149, 150, 0.25)",
          "&:hover": { bgcolor: "rgba(36, 149, 150, 0.35)" },
        },
      },
    },
  },
};
