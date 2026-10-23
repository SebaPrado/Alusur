import React, { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { TIPOS, validateConfig } from "./buildSlots";

const UI = {
  ground: "#0E1117",
  card: "#1E2736",
  ink: "#F2F4F7",
  muted: "#A9B3C1",
  line: "#2E3A4E",
  accent: "#249596",
};

const slotKey = (s) => `${s.piso}|${s.caraOrden}|${s.eje}`;

export default function Fachada2D({ config, slots, onSelect }) {
  const [seleccionKey, setSeleccionKey] = useState(null);
  const errores = validateConfig(config);
  const aviso = errores[0] ?? (config.caras?.length !== 1 ? "La fachada simple necesita 1 cara." : null);

  const cara = config.caras?.[0];
  const pisos = useMemo(() => {
    if (!Number.isInteger(config.piso_desde) || !Number.isInteger(config.piso_hasta)) return [];
    const out = [];
    for (let p = config.piso_hasta; p >= config.piso_desde; p--) out.push(p);
    return out;
  }, [config.piso_desde, config.piso_hasta]);

  const porPiso = useMemo(() => {
    const map = new Map();
    slots.forEach((s) => {
      if (!map.has(s.piso)) map.set(s.piso, []);
      map.get(s.piso).push(s);
    });
    map.forEach((arr) => arr.sort((a, b) => a.eje - b.eje));
    return map;
  }, [slots]);

  const elegir = (slot) => {
    setSeleccionKey(slot ? slotKey(slot) : null);
    onSelect?.(slot ?? null);
  };

  if (aviso) {
    return (
      <Box
        sx={{
          height: "100%",
          minHeight: 320,
          bgcolor: UI.ground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Box
          sx={{
            maxWidth: 420,
            p: 2,
            bgcolor: UI.card,
            borderLeft: `4px solid ${UI.accent}`,
            color: UI.ink,
            fontSize: 14,
          }}
        >
          <Box sx={{ fontWeight: 800, mb: 0.5 }}>No se puede dibujar la fachada</Box>
          <Box sx={{ color: UI.muted }}>{aviso}</Box>
        </Box>
      </Box>
    );
  }

  const nEjes = cara.modulos_por_piso;
  const cols = `40px repeat(${nEjes}, minmax(28px, 36px))`;

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 320,
        bgcolor: UI.ground,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Sin alignItems:center: si no, el contenido alto se recorta y no se puede scrollear completo. */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 3,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          scrollbarColor: `${UI.line} transparent`,
        }}
      >
        <Box
          sx={{
            display: "inline-block",
            boxSizing: "border-box",
            p: 3,
            bgcolor: "rgba(30,39,54,.35)",
            border: `1px solid ${UI.line}`,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: "2px",
              mb: "2px",
              position: "sticky",
              top: -24,
              zIndex: 1,
              bgcolor: UI.ground,
              py: 0.5,
              mx: -0.5,
              px: 0.5,
            }}
          >
            <Box />
            {Array.from({ length: nEjes }, (_, k) => (
              <Box
                key={k}
                sx={{
                  textAlign: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: UI.muted,
                  py: 0.5,
                }}
              >
                {k + 1}
              </Box>
            ))}
          </Box>

          {pisos.map((piso) => {
            const fila = porPiso.get(piso) ?? [];
            return (
              <Box
                key={piso}
                sx={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: "2px",
                  mb: "2px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    pr: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: UI.muted,
                  }}
                >
                  {piso}
                </Box>
                {Array.from({ length: nEjes }, (_, k) => {
                  const slot = fila[k];
                  if (!slot) {
                    return (
                      <Box
                        key={k}
                        sx={{ height: 34, bgcolor: UI.card, border: `1px solid ${UI.line}` }}
                      />
                    );
                  }
                  const ventana = slot.tipo === "ventana";
                  const sel = seleccionKey === slotKey(slot);
                  return (
                    <Box
                      component="button"
                      type="button"
                      key={k}
                      title={`Piso ${slot.piso} · Eje ${slot.eje} · ${TIPOS[slot.tipo]?.label ?? slot.tipo}`}
                      onClick={() => elegir(slot)}
                      sx={{
                        height: 34,
                        p: 0,
                        border: sel ? `2px solid ${UI.ink}` : ventana ? "none" : `1px solid ${UI.line}`,
                        bgcolor: TIPOS[slot.tipo]?.color ?? UI.card,
                        color: ventana ? UI.ground : UI.muted,
                        font: "inherit",
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: "pointer",
                        backgroundImage: ventana
                          ? "none"
                          : "repeating-linear-gradient(135deg,rgba(242,244,247,.06) 0 4px,transparent 4px 8px)",
                        "&:hover": { outline: `1px solid ${UI.accent}`, outlineOffset: -1 },
                      }}
                    >
                      {TIPOS[slot.tipo]?.corto ?? "?"}
                    </Box>
                  );
                })}
              </Box>
            );
          })}

          {Number.isInteger(config.piso_desde) && config.piso_desde > 0 && (
            <Box
              title={`Pisos 0 a ${config.piso_desde - 1}: debajo de la sección activa`}
              sx={{
                mt: "2px",
                display: "grid",
                gridTemplateColumns: `40px 1fr`,
                gap: "2px",
                minHeight: Math.min(120, Math.max(36, config.piso_desde * 6)),
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  pr: 1,
                  fontSize: 10,
                  fontWeight: 700,
                  color: UI.muted,
                  opacity: 0.7,
                }}
              >
                0–{config.piso_desde - 1}
              </Box>
              <Box
                sx={{
                  opacity: 0.4,
                  bgcolor: UI.card,
                  border: `1px dashed ${UI.line}`,
                  backgroundImage:
                    "repeating-linear-gradient(135deg,rgba(242,244,247,.05) 0 5px,transparent 5px 10px)",
                }}
              />
            </Box>
          )}
        </Box>
      </Box>

      <Typography
        variant="caption"
        sx={{ px: 2, py: 1, color: UI.muted, borderTop: `1px solid ${UI.line}`, flexShrink: 0 }}
      >
        Plano 2D · {cara.nombre || cara.codigo} · piso {config.piso_hasta} arriba · ejes de izquierda a
        derecha
      </Typography>
    </Box>
  );
}
