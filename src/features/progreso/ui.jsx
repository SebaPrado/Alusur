import { Box } from "@mui/material";
import { VISUAL } from "./model";

export function EstadoMarca({ visual }) {
  const meta = VISUAL[visual] ?? VISUAL.sin_modulo;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <Box
        component="span"
        sx={{ width: 10, height: 10, bgcolor: meta.color, flex: "0 0 auto" }}
      />
      {meta.label}
    </Box>
  );
}

export const tablaSx = {
  "& th, & td": {
    borderColor: "divider",
    whiteSpace: "nowrap",
    fontSize: "0.8125rem",
    py: 0.75,
  },
  "& th": { color: "text.secondary", fontWeight: 600 },
};

export function CajaTabla({ children }) {
  return (
    <Box sx={{ overflowX: "auto", border: 1, borderColor: "divider" }}>{children}</Box>
  );
}

export function nombreCara(config, codigo) {
  return config?.caras?.find((c) => c.codigo === codigo)?.nombre || codigo;
}

export function ubicacion(fila, config, conPiso = true) {
  const cara = nombreCara(config, fila.caraCodigo);
  const codigo = fila.codigo ? ` · ${fila.codigo}` : "";
  const lugar = `${cara} · Eje ${fila.eje}${codigo}`;
  return conPiso ? `Piso ${fila.piso} · ${lugar}` : lugar;
}
