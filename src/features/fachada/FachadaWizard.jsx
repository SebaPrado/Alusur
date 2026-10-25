import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Torre3D from "./Torre3D";
import Fachada2D from "./Fachada2D";
import Lamina3D from "./Lamina3D";
import { supabase } from "../../lib/supabase";
import { limpiarPrefijoObra, prefijoObraValido } from "../../lib/codigos";
import { useAuth } from "../../auth/AuthProvider";
import { useMisObras } from "../../obras/MisObrasProvider";
import { BAR_HEIGHT } from "../../Components/shell/TopBar";
import {
  DEFAULT_CONFIG,
  ENTORNOS,
  MODOS,
  TIPOS,
  VISTAS_SIMPLE,
  aplicarModo,
  buildSlots,
  configParaGuardar,
  validateConfig,
} from "./buildSlots";

const VIEWPORT_H = `calc(100vh - ${BAR_HEIGHT}px)`;

/** Paths de palette del tema global (cromado de la app). */
const C = {
  ground: "background.default",
  card: "background.paper",
  ink: "text.primary",
  muted: "text.secondary",
  line: "divider",
  accent: "primary.main",
  groundSolid: "primary.contrastText",
};

const PASOS_TORRE = ["Obra", "Modo", "Pisos", "Caras", "Secuencias", "Entorno", "Resumen"];
const PASOS_SIMPLE = ["Obra", "Modo", "Pisos", "Cara", "Secuencia", "Resumen"];
const LADOS = ["Lado norte de la planta", "Lado este", "Lado sur", "Lado oeste"];
const IDX_MODO = 1;

const fmt = (n) => n.toLocaleString("es-UY");
const aEntero = (v) => (v === "" ? NaN : Number(v));
const valorNumero = (n) => (Number.isNaN(n) ? "" : n);

function intercambiar(arr, k, d) {
  const out = [...arr];
  [out[k], out[k + d]] = [out[k + d], out[k]];
  return out;
}

function StepCuadrado({ active, completed, icon }) {
  const lleno = completed || active;
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        border: "2px solid",
        borderColor: lleno ? C.accent : C.line,
        bgcolor: active ? C.accent : C.ground,
        color: active ? C.groundSolid : completed ? C.accent : C.muted,
      }}
    >
      {icon}
    </Box>
  );
}

function chipTipoSx(tipo) {
  const ventana = tipo === "ventana";
  return {
    bgcolor: TIPOS[tipo].color,
    color: ventana ? C.groundSolid : C.ink,
    fontWeight: 700,
    "& .MuiChip-deleteIcon": { color: ventana ? "rgba(14,17,23,.6)" : C.muted },
    "& .MuiChip-deleteIcon:hover": { color: ventana ? C.groundSolid : C.ink },
  };
}

function FilaEjes({ cara }) {
  const n = Number.isInteger(cara.modulos_por_piso) ? Math.max(0, cara.modulos_por_piso) : 0;
  if (n === 0 || cara.secuencia.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin vista previa: faltan módulos o secuencia.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
      {Array.from({ length: n }, (_, k) => {
        const tipo = cara.secuencia[k % cara.secuencia.length];
        const ventana = tipo === "ventana";
        return (
          <Box
            key={k}
            title={`Eje ${k + 1} · ${TIPOS[tipo].label}`}
            sx={{
              width: 30,
              height: 38,
              p: "3px 4px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontSize: 10,
              fontWeight: 700,
              bgcolor: TIPOS[tipo].color,
              color: ventana ? C.groundSolid : C.muted,
              border: ventana ? "none" : 1,
              borderColor: ventana ? undefined : C.line,
              backgroundImage: ventana
                ? "none"
                : "repeating-linear-gradient(135deg,rgba(242,244,247,.06) 0 4px,transparent 4px 8px)",
            }}
          >
            <span>{k + 1}</span>
            <span>{TIPOS[tipo].corto}</span>
          </Box>
        );
      })}
    </Box>
  );
}

export default function FachadaWizard() {
  const navigate = useNavigate();
  const { isCeo, refresh, status: authStatus } = useAuth();
  const { refresh: refreshObras } = useMisObras();
  const [config, setConfig] = useState(() => structuredClone(DEFAULT_CONFIG));
  const [prefijo, setPrefijo] = useState("");
  const [paso, setPaso] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(null);

  // Si el estado quedó de un HMR viejo sin `entorno`, lo completa con "nada".
  useEffect(() => {
    setConfig((c) => {
      let dirty = false;
      const caras = c.caras.map((cara) => {
        if (Object.hasOwn(ENTORNOS, cara.entorno ?? "")) return cara;
        dirty = true;
        return { ...cara, entorno: "nada" };
      });
      return dirty ? { ...c, caras } : c;
    });
  }, []);

  const simple = config.modo === "simple";
  const PASOS = simple ? PASOS_SIMPLE : PASOS_TORRE;

  const slots = useMemo(() => buildSlots(config), [config]);
  const errores = useMemo(() => validateConfig(config), [config]);
  const prefijoInvalido = !prefijoObraValido(prefijo);

  const resumen = useMemo(() => {
    const porTipo = { ventana: 0, panel: 0 };
    const porCara = config.caras.map(() => ({ total: 0, ventana: 0, panel: 0 }));
    slots.forEach((s) => {
      porTipo[s.tipo] += 1;
      const pc = porCara[s.caraOrden - 1];
      if (pc) {
        pc.total += 1;
        pc[s.tipo] += 1;
      }
    });
    return { porTipo, porCara };
  }, [slots, config.caras]);

  const cambiar = (cambios) => {
    setGuardado(false);
    setErrorGuardar(null);
    setConfig((c) => ({ ...c, ...cambios }));
  };

  const cambiarModo = (modo) => {
    if (!modo || modo === config.modo) return;
    setGuardado(false);
    setErrorGuardar(null);
    setSeleccion(null);
    setPaso(IDX_MODO);
    setConfig((c) => aplicarModo(c, modo));
  };

  const actualizarCara = (i, cambios) => {
    setGuardado(false);
    setErrorGuardar(null);
    setConfig((c) => ({
      ...c,
      caras: c.caras.map((cara, j) => (j === i ? { ...cara, ...cambios } : cara)),
    }));
  };

  const cambiarSecuencia = (i, fn) => {
    setGuardado(false);
    setErrorGuardar(null);
    setConfig((c) => ({
      ...c,
      caras: c.caras.map((cara, j) => (j === i ? { ...cara, secuencia: fn(cara.secuencia) } : cara)),
    }));
  };

  const copiarATodas = (i) => {
    setGuardado(false);
    setErrorGuardar(null);
    setConfig((c) => ({
      ...c,
      caras: c.caras.map((cara) => ({ ...cara, secuencia: [...c.caras[i].secuencia] })),
    }));
  };

  const guardar = async () => {
    if (errores.length > 0 || prefijoInvalido || guardando) return;
    if (!isCeo) {
      setErrorGuardar("Solo un CEO puede crear una obra nueva.");
      return;
    }
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const nombre = config.nombre.trim();
      const ubicacion = String(config.ubicacion ?? "").trim() || null;
      const { data: obraId, error: errObra } = await supabase.rpc("create_obra", {
        p_nombre: nombre,
        p_ubicacion: ubicacion,
      });
      if (errObra) throw errObra;

      if (prefijo) {
        const { error: errPref } = await supabase
          .from("obras")
          .update({ prefijo })
          .eq("id", obraId);
        if (errPref) throw errPref;
      }

      const { error: errFachada } = await supabase.rpc("guardar_fachada", {
        p_obra: obraId,
        p_config: configParaGuardar(config),
      });
      if (errFachada) throw errFachada;

      await refresh();
      await refreshObras();
      setGuardado(true);
      navigate(`/obra/${obraId}/hoy`, { replace: true });
    } catch (e) {
      console.error(e);
      setErrorGuardar(e?.message || "No se pudo guardar la obra.");
    } finally {
      setGuardando(false);
    }
  };

  const cantPisos =
    Number.isInteger(config.piso_desde) && Number.isInteger(config.piso_hasta)
      ? Math.max(0, config.piso_hasta - config.piso_desde + 1)
      : 0;

  const caraSeleccionada = seleccion ? config.caras[seleccion.caraOrden - 1] : null;

  const pasoObra = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        label="Nombre de la obra"
        value={config.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        placeholder="Ej. Cipriani Torre 1"
        fullWidth
        autoFocus
        required
      />
      <TextField
        label="Ubicación (opcional)"
        value={config.ubicacion}
        onChange={(e) => cambiar({ ubicacion: e.target.value })}
        placeholder="Ej. Punta del Este"
        fullWidth
      />
      <TextField
        label="Prefijo (3 letras)"
        value={prefijo}
        onChange={(e) => setPrefijo(limpiarPrefijoObra(e.target.value))}
        placeholder="CIP"
        fullWidth
        error={prefijoInvalido}
        helperText={
          prefijoInvalido
            ? "Tiene que ser una letra y dos letras o números (ej. CIP)."
            : "Va al principio de todos los códigos y etiquetas de la obra. Si lo dejás vacío, se genera solo."
        }
        inputProps={{ maxLength: 3, autoCapitalize: "characters", "aria-label": "Prefijo de la obra" }}
      />
      {!isCeo && authStatus === "ready" && (
        <Alert severity="warning">Solo un CEO puede crear una obra nueva.</Alert>
      )}
    </Box>
  );

  const pasoModo = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        orientation="vertical"
        value={config.modo}
        onChange={(_, v) => cambiarModo(v)}
      >
        {Object.entries(MODOS).map(([valor, m]) => (
          <ToggleButton key={valor} value={valor} sx={{ display: "block", textAlign: "left", py: 1.5 }}>
            <Box sx={{ fontWeight: 800 }}>{m.label}</Box>
            <Box sx={{ fontSize: 13, fontWeight: 500, opacity: 0.8, mt: 0.5 }}>{m.detalle}</Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );

  const pasoPisos = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField
          label="Desde"
          type="number"
          value={valorNumero(config.piso_desde)}
          onChange={(e) => cambiar({ piso_desde: aEntero(e.target.value) })}
          inputProps={{ step: 1 }}
          sx={{ width: 140 }}
        />
        <TextField
          label="Hasta"
          type="number"
          value={valorNumero(config.piso_hasta)}
          onChange={(e) => cambiar({ piso_hasta: aEntero(e.target.value) })}
          inputProps={{ step: 1 }}
          sx={{ width: 140 }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {cantPisos === 1 ? "1 piso" : `${fmt(cantPisos)} pisos`}
      </Typography>
    </Box>
  );

  const pasoCaras = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {config.caras.map((cara, i) => (
        <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {!simple && (
            <Typography variant="caption" color="text.secondary">
              {LADOS[i] ?? `Cara ${i + 1}`}
            </Typography>
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <TextField
              label="Código"
              size="small"
              value={cara.codigo}
              onChange={(e) => actualizarCara(i, { codigo: e.target.value })}
              sx={{ width: 90 }}
            />
            <TextField
              label="Nombre"
              size="small"
              value={cara.nombre}
              onChange={(e) => actualizarCara(i, { nombre: e.target.value })}
              sx={{ flex: "1 1 140px" }}
            />
            <TextField
              label="Módulos por piso"
              size="small"
              type="number"
              value={valorNumero(cara.modulos_por_piso)}
              onChange={(e) => actualizarCara(i, { modulos_por_piso: aEntero(e.target.value) })}
              inputProps={{ min: 1, step: 1 }}
              sx={{ width: 150 }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );

  const pasoSecuencias = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography color="text.secondary">
        Armá la secuencia de cada cara. Se repite a lo largo de los ejes: con Ventana, Panel queda
        V, P, V, P…
      </Typography>
      {config.caras.map((cara, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            pb: 3,
            borderBottom: 1,
            borderColor: C.line,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
            <Typography fontWeight={800}>
              {cara.nombre || "Sin nombre"} ({cara.codigo || "?"})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Number.isInteger(cara.modulos_por_piso) ? cara.modulos_por_piso : 0} módulos por piso
            </Typography>
            {!simple && (
              <Button size="small" sx={{ ml: "auto" }} onClick={() => copiarATodas(i)}>
                Copiar a todas las caras
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            {cara.secuencia.map((tipo, k) => (
              <Box
                key={k}
                sx={{ display: "inline-flex", alignItems: "center", border: 1, borderColor: C.line }}
              >
                <IconButton
                  size="small"
                  aria-label="Mover a la izquierda"
                  disabled={k === 0}
                  onClick={() => cambiarSecuencia(i, (s) => intercambiar(s, k, -1))}
                  sx={{ width: 24, height: 32, fontSize: 10 }}
                >
                  ◀
                </IconButton>
                <Chip
                  size="small"
                  label={TIPOS[tipo].label}
                  onDelete={() => cambiarSecuencia(i, (s) => s.filter((_, j) => j !== k))}
                  sx={chipTipoSx(tipo)}
                />
                <IconButton
                  size="small"
                  aria-label="Mover a la derecha"
                  disabled={k === cara.secuencia.length - 1}
                  onClick={() => cambiarSecuencia(i, (s) => intercambiar(s, k, 1))}
                  sx={{ width: 24, height: 32, fontSize: 10 }}
                >
                  ▶
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              onClick={() => cambiarSecuencia(i, (s) => [...s, "ventana"])}
            >
              + Ventana
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => cambiarSecuencia(i, (s) => [...s, "panel"])}
            >
              + Panel
            </Button>
          </Box>

          <FilaEjes cara={cara} />
        </Box>
      ))}
    </Box>
  );

  const pasoEntorno = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {config.caras.map((cara, i) => (
        <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography fontWeight={800}>
            {cara.nombre || "Sin nombre"} ({cara.codigo || "?"})
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            aria-label={`Entorno de la cara ${cara.nombre || cara.codigo}`}
            value={cara.entorno ?? null}
            onChange={(_, v) => v !== null && actualizarCara(i, { entorno: v })}
          >
            {Object.entries(ENTORNOS).map(([valor, e]) => (
              <ToggleButton key={valor} value={valor}>
                {e.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      ))}
    </Box>
  );

  const pasoResumen = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Total de Componentes
        </Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
          {fmt(slots.length)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {config.nombre.trim() || "Sin nombre"}
          {config.ubicacion.trim() ? ` · ${config.ubicacion.trim()}` : ""} ·{" "}
          {MODOS[config.modo]?.label ?? config.modo} · Pisos {valorNumero(config.piso_desde)} a{" "}
          {valorNumero(config.piso_hasta)} ({fmt(cantPisos)} pisos)
          {simple ? ` · Vista: ${VISTAS_SIMPLE[config.vista_simple]?.label ?? config.vista_simple}` : ""}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 3 }}>
        {Object.entries(TIPOS).map(([tipo, t]) => (
          <Box key={tipo} sx={{ borderLeft: `3px solid ${t.color}`, pl: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
              {fmt(resumen.porTipo[tipo] ?? 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.plural}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cara</TableCell>
              {!simple && <TableCell>Entorno</TableCell>}
              <TableCell align="right">/ Piso</TableCell>
              <TableCell align="right">Ventanas</TableCell>
              <TableCell align="right">Paneles</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {config.caras.map((cara, i) => (
              <TableRow key={i}>
                <TableCell>{cara.nombre || "Sin nombre"}</TableCell>
                {!simple && (
                  <TableCell>{ENTORNOS[cara.entorno]?.label ?? "Sin elegir"}</TableCell>
                )}
                <TableCell align="right">{valorNumero(cara.modulos_por_piso)}</TableCell>
                <TableCell align="right">{fmt(resumen.porCara[i]?.ventana ?? 0)}</TableCell>
                <TableCell align="right">{fmt(resumen.porCara[i]?.panel ?? 0)}</TableCell>
                <TableCell align="right">{fmt(resumen.porCara[i]?.total ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {errorGuardar && <Alert severity="error">{errorGuardar}</Alert>}
      {guardado && <Alert severity="success">Obra guardada.</Alert>}
    </Box>
  );

  const contenido = simple
    ? [pasoObra, pasoModo, pasoPisos, pasoCaras, pasoSecuencias, pasoResumen][paso]
    : [pasoObra, pasoModo, pasoPisos, pasoCaras, pasoSecuencias, pasoEntorno, pasoResumen][paso];
  const ultimo = paso === PASOS.length - 1;

  const irAPaso = (i) => {
    setPaso(Math.max(0, Math.min(i, PASOS.length - 1)));
  };

  const vistaPreview = (() => {
    if (!simple) {
      return <Torre3D config={config} slots={slots} mode="material" onSelect={setSeleccion} />;
    }
    if (config.vista_simple === "lamina") {
      return <Lamina3D config={config} slots={slots} mode="material" onSelect={setSeleccion} />;
    }
    return <Fachada2D config={config} slots={slots} onSelect={setSeleccion} />;
  })();

  return (
    <Box
      sx={{
        minHeight: VIEWPORT_H,
        height: { md: VIEWPORT_H },
        bgcolor: C.ground,
        color: C.ink,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
        <Box
          sx={{
            width: { md: 560 },
            minWidth: 0,
            flexShrink: 0,
            height: { md: "100%" },
            overflowY: { md: "auto" },
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            borderRight: { md: 1 },
            borderRightColor: C.line,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Nueva obra
            </Typography>
          </Box>

          <Stepper
            nonLinear
            alternativeLabel
            activeStep={paso}
            sx={{
              width: "100%",
              "& .MuiStepLabel-label": {
                fontSize: 11,
                mt: 0.5,
                whiteSpace: "nowrap",
              },
              "& .MuiStepConnector-root": { top: 14 },
              "& .MuiStepButton-root": { m: 0, p: "8px 2px" },
            }}
          >
            {PASOS.map((label, i) => (
              <Step key={label} completed={i < paso}>
                <StepButton onClick={() => irAPaso(i)}>
                  <StepLabel StepIconComponent={StepCuadrado}>{label}</StepLabel>
                </StepButton>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ flex: 1 }}>{contenido}</Box>

          {errores.length > 0 && paso > 0 && (
            <Alert severity="error">
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </Box>
            </Alert>
          )}
          {errorGuardar && !ultimo && <Alert severity="error">{errorGuardar}</Alert>}

          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Button disabled={paso === 0 || guardando} onClick={() => setPaso((p) => p - 1)}>
              Atrás
            </Button>
            {ultimo ? (
              <Button
                variant="contained"
                disabled={errores.length > 0 || guardando || !isCeo}
                onClick={guardar}
              >
                {guardando ? "Guardando…" : "Guardar obra"}
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={
                  paso === 0 &&
                  (!String(config.nombre ?? "").trim() || prefijoInvalido)
                }
                onClick={() => setPaso((p) => p + 1)}
              >
                Siguiente
              </Button>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: { xs: "70vh", md: "100%" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          {simple && (
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: 1,
            borderColor: C.line,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={config.vista_simple}
                onChange={(_, v) => {
                  if (v !== null) {
                    setSeleccion(null);
                    cambiar({ vista_simple: v });
                  }
                }}
              >
                {Object.entries(VISTAS_SIMPLE).map(([valor, v]) => (
                  <ToggleButton key={valor} value={valor} title={v.detalle}>
                    {v.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <Box sx={{ flex: 1, minHeight: 0 }}>{vistaPreview}</Box>

          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderTop: 1,
              borderColor: C.line,
              fontSize: 14,
              color: seleccion ? C.ink : C.muted,
            }}
          >
            {seleccion ? (
              <>
                <Box component="span" sx={{ color: C.muted, mr: 1 }}>
                  Módulo seleccionado:
                </Box>
                <strong>
                  Piso {seleccion.piso} · {caraSeleccionada?.nombre || seleccion.caraCodigo} · Eje{" "}
                  {seleccion.eje} · {TIPOS[seleccion.tipo]?.label ?? seleccion.tipo}
                </strong>
              </>
            ) : (
              "Hacé clic en un módulo para ver su piso, cara, eje y tipo."
            )}
          </Box>
        </Box>
    </Box>
  );
}
