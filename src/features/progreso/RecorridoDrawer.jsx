import { useNavigate } from "react-router-dom";
import { Box, Button, Drawer, Typography } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { TIPOS } from "../fachada/buildSlots";
import { ESTADOS_CON_LLEGADA, formatLlegada } from "../logistica/estados";
import { esCorreccion, formatFechaHoraUY, VISUAL } from "./model";
import { useProgreso } from "./useProgresoData.jsx";
import { EstadoMarca, ubicacion } from "./ui";

const TITULO = {
  en_produccion: "En producción",
  en_camino: "Salió de fábrica",
  en_puerto: "Llegó a puerto",
  en_deposito: "Llegó a depósito",
  en_obra: "Llegó a obra",
  descargado: "Descargado",
  instalado: "Instalado",
  terminado: "Terminado",
};

export default function RecorridoDrawer() {
  const { obraId } = useObra();
  const { filas, config, recorridoId, cerrarRecorrido } = useProgreso();
  const navigate = useNavigate();
  const fila = filas.find((f) => f.modulo?.id === recorridoId) ?? null;
  const abierto = Boolean(recorridoId && fila);

  function irTorre() {
    if (!fila?.modulo) return;
    cerrarRecorrido();
    navigate({
      pathname: `/obra/${obraId}/progreso/torre`,
      search: `?modulo=${encodeURIComponent(fila.modulo.codigo)}`,
    });
  }

  function irPiso() {
    if (!fila) return;
    cerrarRecorrido();
    navigate({
      pathname: `/obra/${obraId}/progreso/pisos`,
      search: `?piso=${fila.piso}`,
    });
  }

  const eventos = fila
    ? [...fila.eventosContenedor.map((e) => ({ ...e, entidad: "contenedor" })), ...fila.eventosModulo.map((e) => ({ ...e, entidad: "modulo" }))].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at) || String(a.id).localeCompare(String(b.id)),
      )
    : [];

  return (
    <Drawer
      anchor="right"
      open={abierto}
      onClose={cerrarRecorrido}
      PaperProps={{
        sx: {
          width: 480,
          maxWidth: "100%",
          bgcolor: "background.default",
          color: "text.primary",
          borderRadius: 0,
          boxShadow: "none",
          borderLeft: 1,
          borderColor: "divider",
          backgroundImage: "none",
        },
      }}
    >
      {fila && (
        <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2, height: "100%", overflow: "auto" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography sx={{ color: "text.secondary", fontSize: 12 }}>Recorrido del módulo</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 22 }}>{fila.modulo.codigo}</Typography>
            </Box>
            <Button aria-label="Cerrar" onClick={cerrarRecorrido}>
              ✕
            </Button>
          </Box>
          <EstadoMarca visual={fila.visual} />
          <Box sx={{ borderLeft: `3px solid ${VISUAL[fila.visual].color}`, pl: 1.5 }}>
            <Typography sx={{ color: "text.secondary", fontSize: 12 }}>Dónde está ahora</Typography>
            <Typography>{dondeEsta(fila, config)}</Typography>
          </Box>
          <Box>
            <Dato k="Tipo" v={TIPOS[fila.tipo]?.label ?? fila.tipo} />
            <Dato k="Referencia" v={fila.modulo.referencia || "—"} />
            <Dato k="Posición" v={ubicacion(fila, config)} />
            <Dato k="Planta" v={fila.planta} />
            <Dato
              k="Contenedor"
              v={lineaContenedor(fila)}
            />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {eventos.map((ev) => {
              const correccion = esCorreccion(ev.entidad, ev.from_state, ev.to_state);
              const titulo = TITULO[ev.to_state] ?? ev.to_state;
              return (
                <Box key={ev.id} sx={{ color: correccion ? "text.secondary" : "text.primary" }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, color: "inherit" }}>
                    {correccion ? "Corrección · " : ""}
                    {titulo}
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
                    {formatFechaHoraUY(ev.created_at)} · {ev.actor || "—"}
                    {ev.nota ? ` · ${ev.nota}` : ""}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" onClick={irTorre}>
              Ver en 3D
            </Button>
            <Button onClick={irPiso}>Ver piso {fila.piso}</Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

function dondeEsta(fila, config) {
  const cont = fila.contenedor?.codigo || fila.modulo.contenedor_codigo || "—";
  const lugar = ubicacion(fila, config);
  if (fila.visual === "produccion") return `En producción · Contenedor ${cont}`;
  if (fila.visual === "camino") return `En camino · Contenedor ${cont}`;
  if (fila.visual === "obra") return "En obra, sin instalar";
  if (fila.visual === "instalado") return `Instalado · ${lugar}`;
  if (fila.visual === "terminado") return `Terminado · ${lugar}`;
  return lugar;
}

function lineaContenedor(fila) {
  const cont = fila.contenedor?.codigo || fila.modulo.contenedor_codigo || "—";
  if (fila.llegada && ESTADOS_CON_LLEGADA.has(fila.modulo.contenedor_estado)) {
    return `${cont} · llega ${formatLlegada(fila.llegada)}`;
  }
  return cont;
}

function Dato({ k, v }) {
  return (
    <Box sx={{ display: "flex", gap: 1, py: 0.4, fontSize: 14 }}>
      <Box sx={{ width: 110, color: "text.secondary", flexShrink: 0 }}>{k}</Box>
      <Box>{v}</Box>
    </Box>
  );
}
