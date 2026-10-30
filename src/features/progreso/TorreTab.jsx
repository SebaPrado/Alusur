import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { supabase } from "../../lib/supabase";
import { ejemploCodigoModulo, mismoCodigo, normalizarCodigo } from "../../lib/codigos";
import { useObra } from "../../obras/ObraProvider";
import { TIPOS } from "../fachada/buildSlots";
import Torre3D from "../fachada/Torre3D";
import { SECTION_BAR_HEIGHT, tabBtnSx } from "../obra/PageHeader";
import { useSideInset } from "../obra/SectionTabs";
import { fieldSx } from "../personal/theme";
import { formatLlegada, ESTADOS_CON_LLEGADA } from "../logistica/estados";
import { ORDEN_VISUAL, VISUAL } from "./model";
import { ProgresoGate, useProgreso } from "./useProgresoData.jsx";
import { EstadoMarca, ubicacion } from "./ui";
import RecorridoPanel, { hayRecorrido } from "./RecorridoDrawer";

const PANEL_KEY = "alusur.panel_progreso";
const PANEL_MIN = 280;
const PANEL_DEFAULT = 400;
const SPLIT_HANDLE = 6;

function leerAnchoPanel() {
  try {
    const n = Number(localStorage.getItem(PANEL_KEY));
    if (Number.isFinite(n) && n >= PANEL_MIN) return n;
  } catch {
    /* modo privado */
  }
  return PANEL_DEFAULT;
}

/** Bajo la fila de pestañas que flota sobre el 3D. */
const OVERLAY_TOP = SECTION_BAR_HEIGHT + 8;

export default function TorreTab() {
  return (
    <ProgresoGate>
      <TorreVista />
    </ProgresoGate>
  );
}

function textoOtraObra(error) {
  const raw = String(error?.message ?? "");
  const inicio = raw.toLowerCase().indexOf("esta pieza es de otra obra");
  if (inicio < 0) return null;
  return raw.slice(inicio).split("\n")[0].trim();
}

function TorreVista() {
  const { obraId, obra } = useObra();
  const { filas, config, abrirRecorrido, recorridoId, torreModo, setTorreModo } = useProgreso();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const setSideInset = useSideInset();
  const rowRef = useRef(null);
  const dragRef = useRef(false);
  const [panelWidth, setPanelWidth] = useState(leerAnchoPanel);
  const [params, setParams] = useSearchParams();
  const [estadoFiltro, setEstadoFiltro] = useState(null);
  const [q, setQ] = useState("");
  const [aviso, setAviso] = useState(null);
  const [enfocar, setEnfocar] = useState(0);
  const enfocado = useRef(false);

  const moduloQ = params.get("modulo");
  const posQ = params.get("pos");
  const pisoQ = params.get("piso");
  const pisoFiltro = pisoQ != null && pisoQ !== "" ? Number(pisoQ) : null;

  const fila = useMemo(() => {
    if (moduloQ) {
      const codigo = normalizarCodigo(moduloQ);
      return filas.find((f) => f.modulo && mismoCodigo(f.modulo.codigo, codigo)) ?? null;
    }
    if (posQ) {
      const [piso, cara, eje] = posQ.split("|");
      return (
        filas.find(
          (f) => f.piso === Number(piso) && f.caraCodigo === cara && f.eje === Number(eje),
        ) ?? null
      );
    }
    return null;
  }, [filas, moduloQ, posQ]);

  useEffect(() => {
    if (enfocado.current || !fila) return;
    if (!moduloQ && !posQ) return;
    enfocado.current = true;
    setEnfocar(1);
  }, [fila, moduloQ, posQ]);

  const slots = useMemo(
    () =>
      filas.map((f) => {
        const meta = VISUAL[f.visual] ?? VISUAL.sin_modulo;
        return {
          piso: f.piso,
          caraCodigo: f.caraCodigo,
          caraOrden: f.caraOrden,
          eje: f.eje,
          tipo: f.tipo,
          codigo: f.codigo ?? null,
          color: meta.color,
          estado: meta.label,
          estadoVisual: f.visual in VISUAL ? f.visual : "sin_modulo",
        };
      }),
    [filas],
  );

  const seleccion = useMemo(
    () => (fila ? { piso: fila.piso, caraCodigo: fila.caraCodigo, eje: fila.eje } : null),
    [fila],
  );

  function escribirSeleccion(slot) {
    const next = new URLSearchParams(params);
    if (!slot) {
      if (!next.get("modulo") && !next.get("pos")) return;
      next.delete("modulo");
      next.delete("pos");
      setParams(next, { replace: true });
      return;
    }
    const hit = filas.find(
      (f) => f.piso === slot.piso && f.caraCodigo === slot.caraCodigo && f.eje === slot.eje,
    );
    if (hit?.modulo) {
      if (next.get("modulo") === hit.modulo.codigo && !next.get("pos")) return;
      next.set("modulo", hit.modulo.codigo);
      next.delete("pos");
    } else {
      const pos = `${slot.piso}|${slot.caraCodigo}|${slot.eje}`;
      if (next.get("pos") === pos && !next.get("modulo")) return;
      next.delete("modulo");
      next.set("pos", pos);
    }
    setParams(next, { replace: true });
  }

  function quitarPiso() {
    const next = new URLSearchParams(params);
    next.delete("piso");
    setParams(next, { replace: true });
  }

  async function buscar(e) {
    e.preventDefault();
    const codigo = normalizarCodigo(q);
    setQ(codigo);
    if (!codigo) {
      setAviso(null);
      return;
    }
    const { data, error } = await supabase.rpc("buscar_codigo", {
      p_obra: obraId,
      p_codigo: codigo,
    });
    if (error) {
      const otra = textoOtraObra(error);
      if (otra) {
        setAviso({ texto: otra, otraObra: true });
        return;
      }
      const mensaje = String(error.message ?? "");
      if (/dígito de control|formato de código|mal escrito/i.test(mensaje)) {
        setAviso({ texto: mensaje, otraObra: false });
        return;
      }
      setAviso({ texto: `No existe el módulo ${codigo}`, otraObra: false });
      return;
    }
    if (!data || data.tipo !== "modulo") {
      setAviso({ texto: `No existe el módulo ${codigo}`, otraObra: false });
      return;
    }
    const hit = filas.find((f) => f.modulo?.id === data.id);
    if (!hit) {
      setAviso({ texto: `No existe el módulo ${codigo}`, otraObra: false });
      return;
    }
    setAviso(null);
    const codigoPieza = data.codigo || hit.modulo.codigo;
    setQ(codigoPieza);
    const next = new URLSearchParams(params);
    next.set("modulo", codigoPieza);
    next.delete("pos");
    setParams(next, { replace: true });
    setEnfocar((n) => n + 1);
  }

  const muestraRecorrido = hayRecorrido(filas, recorridoId);

  useEffect(() => {
    if (!wide) {
      setSideInset(0);
      return;
    }
    setSideInset(panelWidth + SPLIT_HANDLE);
  }, [wide, panelWidth, setSideInset]);

  useEffect(() => () => setSideInset(0), [setSideInset]);

  function guardarAncho(ancho) {
    try {
      localStorage.setItem(PANEL_KEY, String(ancho));
    } catch {
      /* modo privado */
    }
  }

  function onSplitPointerDown(e) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = true;
  }

  function onSplitPointerMove(e) {
    if (!dragRef.current || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const max = Math.max(PANEL_MIN, Math.round(rect.width * 0.72));
    const next = Math.round(rect.right - e.clientX);
    setPanelWidth(Math.min(max, Math.max(PANEL_MIN, next)));
  }

  function onSplitPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = false;
    setPanelWidth((w) => {
      guardarAncho(w);
      return w;
    });
  }

  function onSplitKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const rect = rowRef.current?.getBoundingClientRect();
    const max = rect ? Math.max(PANEL_MIN, Math.round(rect.width * 0.72)) : 720;
    const delta = e.key === "ArrowLeft" ? 16 : -16;
    setPanelWidth((w) => {
      const next = Math.min(max, Math.max(PANEL_MIN, w + delta));
      guardarAncho(next);
      return next;
    });
  }

  const conModulo = filas.filter((f) => f.visual !== "sin_modulo");
  const hechos = conModulo.filter((f) => f.visual === "instalado" || f.visual === "terminado").length;
  const pct = conModulo.length ? Math.round((hechos / conModulo.length) * 100) : 0;
  const counts = Object.fromEntries(ORDEN_VISUAL.map((k) => [k, filas.filter((f) => f.visual === k).length]));
  const total = filas.length || 1;

  return (
    <Box
      ref={rowRef}
      sx={{
        flex: 1,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        overflow: { xs: "auto", md: "hidden" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          flex: { md: 1 },
          minHeight: { xs: 420, md: 0 },
          height: { md: "100%" },
        }}
      >
        <Torre3D
          config={config}
          slots={slots}
          mode={torreModo === "material" ? "material" : "estado"}
          onSelect={escribirSeleccion}
          pisoFiltro={Number.isFinite(pisoFiltro) ? pisoFiltro : null}
          estadoFiltro={estadoFiltro}
          seleccion={seleccion}
          enfocar={enfocar}
          controlsTop={OVERLAY_TOP}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={torreModo}
          onChange={(_, v) => v && setTorreModo(v)}
          aria-label="Vista del modelo"
          sx={{
            position: "absolute",
            top: OVERLAY_TOP,
            left: 16,
            zIndex: 2,
            bgcolor: "rgba(14,17,23,.7)",
            "& .MuiToggleButton-root": {
              minHeight: tabBtnSx.minHeight,
              py: tabBtnSx.py,
              px: 1.25,
              fontSize: "0.8125rem",
              fontWeight: 600,
            },
          }}
        >
          <ToggleButton value="material">Material</ToggleButton>
          <ToggleButton value="estado">Estado</ToggleButton>
        </ToggleButtonGroup>
        {Number.isFinite(pisoFiltro) && (
          <Box
            sx={{
              position: "absolute",
              top: OVERLAY_TOP + 40,
              left: 16,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.5,
              bgcolor: "rgba(14,17,23,.7)",
              border: 1,
              borderColor: "divider",
              color: "text.primary",
              fontSize: 13,
            }}
          >
            Piso {pisoFiltro}
            <Box
              component="button"
              type="button"
              aria-label="Quitar filtro de piso"
              onClick={quitarPiso}
              sx={{
                border: 0,
                bgcolor: "transparent",
                color: "text.secondary",
                cursor: "pointer",
                font: "inherit",
                p: 0,
              }}
            >
              ✕
            </Box>
          </Box>
        )}
      </Box>

      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar ancho del panel"
        aria-valuemin={PANEL_MIN}
        aria-valuenow={panelWidth}
        tabIndex={0}
        onPointerDown={onSplitPointerDown}
        onPointerMove={onSplitPointerMove}
        onPointerUp={onSplitPointerUp}
        onPointerCancel={onSplitPointerUp}
        onKeyDown={onSplitKeyDown}
        sx={{
          display: { xs: "none", md: "flex" },
          width: SPLIT_HANDLE,
          flexShrink: 0,
          cursor: "col-resize",
          touchAction: "none",
          alignItems: "stretch",
          justifyContent: "center",
          "&::before": {
            content: '""',
            width: "1px",
            height: "100%",
            bgcolor: "divider",
          },
          "&:hover::before, &:focus-visible::before": {
            bgcolor: "primary.main",
            width: "2px",
          },
        }}
      />

      <Box
        sx={{
          width: { xs: "100%", md: panelWidth },
          flexShrink: 0,
          overflow: "auto",
          bgcolor: "background.default",
          position: "relative",
          zIndex: { md: 3 },
          minHeight: { md: 0 },
          height: { md: "100%" },
          p: muestraRecorrido ? 0 : 2,
          display: "flex",
          flexDirection: "column",
          gap: muestraRecorrido ? 0 : 2,
        }}
      >
        {muestraRecorrido ? (
          <RecorridoPanel />
        ) : (
          <>
        <Box component="form" onSubmit={buscar}>
          <Box
            component="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar módulo (${ejemploCodigoModulo(obra?.prefijo)})`}
            aria-label="Buscar módulo"
            sx={{
              ...fieldSx["& .MuiInputBase-root"],
              width: "100%",
              boxSizing: "border-box",
              bgcolor: "transparent",
              color: "text.primary",
              border: 1,
              borderColor: "divider",
              px: 1.25,
              py: 1,
              font: "inherit",
              fontSize: 14,
              "&:focus": { outline: "1px solid", outlineColor: "primary.main" },
            }}
          />
          {aviso && (
            <Typography
              role={aviso.otraObra ? "alert" : "status"}
              sx={(theme) => ({
                color: aviso.otraObra ? "error.main" : "warning.main",
                fontSize: 13,
                fontWeight: aviso.otraObra ? 700 : 400,
                mt: 0.75,
                ...(aviso.otraObra
                  ? {
                      px: 1,
                      py: 0.75,
                      borderLeft: "3px solid",
                      borderColor: "error.main",
                      bgcolor: alpha(theme.palette.error.main, 0.16),
                    }
                  : null),
              })}
            >
              {aviso.texto}
            </Typography>
          )}
          {moduloQ && !fila && !aviso && (
            <Typography role="status" sx={{ color: "warning.main", fontSize: 13, mt: 0.75 }}>
              No existe el módulo {normalizarCodigo(moduloQ)}
            </Typography>
          )}
        </Box>

        <Box sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
          <Typography sx={{ color: "text.secondary", fontSize: 12, letterSpacing: "0.04em" }}>
            Avance de instalación
          </Typography>
          <Typography sx={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, mt: 0.5 }}>
            {pct} %
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.5 }}>
            {hechos.toLocaleString("es-UY")} de {conModulo.length.toLocaleString("es-UY")} módulos
            instalados o terminados
          </Typography>
          <Box sx={{ display: "flex", height: 8, mt: 1.5, bgcolor: "divider" }}>
            {ORDEN_VISUAL.map((k) => (
              <Box key={k} sx={{ width: `${(counts[k] / total) * 100}%`, bgcolor: VISUAL[k].color }} />
            ))}
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", mt: 1 }}>
            {ORDEN_VISUAL.map((k) => {
              const on = estadoFiltro === k;
              return (
                <Box
                  key={k}
                  component="button"
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEstadoFiltro((prev) => (prev === k ? null : k))}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    borderLeft: on ? "2px solid" : "2px solid transparent",
                    borderColor: "primary.main",
                    bgcolor: "transparent",
                    color: "text.primary",
                    font: "inherit",
                    fontSize: 13,
                    py: 0.4,
                    px: 0.5,
                    cursor: "pointer",
                  }}
                >
                  <Box sx={{ width: 10, height: 10, bgcolor: VISUAL[k].color, flex: "0 0 auto" }} />
                  <Box sx={{ flex: 1 }}>{VISUAL[k].label}</Box>
                  <Box sx={{ color: "text.secondary" }}>{counts[k].toLocaleString("es-UY")}</Box>
                  <Box sx={{ width: 42, textAlign: "right", color: "text.secondary" }}>
                    {Math.round((counts[k] / total) * 100)} %
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Typography sx={{ color: "text.secondary", fontSize: 12, mt: 1 }}>
            Tocá un estado para resaltar solo esos módulos.
          </Typography>
        </Box>

        <Detalle fila={fila} config={config} onRecorrido={abrirRecorrido} />
          </>
        )}
      </Box>
    </Box>
  );
}

function Detalle({ fila, config, onRecorrido }) {
  if (!fila) {
    return (
      <Box sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
        <Typography sx={{ color: "text.secondary", fontSize: 12 }}>Módulo seleccionado</Typography>
        <Typography sx={{ mt: 1, color: "text.secondary" }}>
          Tocá un módulo de la torre para ver en qué estado está.
        </Typography>
      </Box>
    );
  }

  const tipo = TIPOS[fila.tipo]?.label ?? fila.tipo;
  const donde = ubicacion(fila, config);

  if (!fila.modulo) {
    return (
      <Box sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
        <Typography sx={{ color: "text.secondary", fontSize: 12 }}>Módulo seleccionado</Typography>
        <Typography sx={{ mt: 1 }}>
          {donde} · {tipo} · Sin módulo asignado
        </Typography>
      </Box>
    );
  }

  const cont = fila.contenedor?.codigo || fila.modulo.contenedor_codigo || "—";
  const llega =
    fila.llegada && ESTADOS_CON_LLEGADA.has(fila.modulo.contenedor_estado)
      ? ` · llega ${formatLlegada(fila.llegada)}`
      : "";
  const instalado = fila.visual === "instalado" || fila.visual === "terminado";
  const faltaComplemento = fila.requiereComplemento && !fila.tieneComplemento;

  return (
    <Box sx={{ border: 1, borderColor: "divider", p: 1.5 }}>
      <Typography sx={{ color: "text.secondary", fontSize: 12 }}>Módulo seleccionado</Typography>
      <Typography sx={{ fontFamily: "inherit", fontWeight: 700, fontSize: 20, mt: 0.5 }}>
        {fila.modulo.codigo}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <EstadoMarca visual={fila.visual} />
      </Box>
      <Ficha label="Tipo" value={tipo} />
      <Ficha label="Ubicación" value={donde} />
      {faltaComplemento && (
        <Typography sx={{ mt: 0.75, fontSize: 14, color: "warning.main" }}>
          Falta la ventana corrediza
        </Typography>
      )}
      <Ficha label="Planta" value={fila.planta} />
      <Ficha label="Contenedor" value={`${cont}${llega}`} />
      {instalado && <Ficha label="Equipo" value={fila.equipo?.nombre || "—"} />}
      <Button
        onClick={() => onRecorrido(fila.modulo.id)}
        sx={{ mt: 1, px: 0, minWidth: 0, color: "primary.main" }}
      >
        Ver recorrido completo →
      </Button>
    </Box>
  );
}

function Ficha({ label, value }) {
  return (
    <Box sx={{ display: "flex", gap: 1, mt: 0.75, fontSize: 14 }}>
      <Box sx={{ color: "text.secondary", width: 96, flexShrink: 0 }}>{label}</Box>
      <Box>{value}</Box>
    </Box>
  );
}
