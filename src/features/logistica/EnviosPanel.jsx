import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Collapse,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { C, fieldSx } from "../personal/theme";
import { opcionesDeCatalogo } from "./catalogoModulos";
import { useCatalogo } from "./useCatalogo";

/**
 * Lista de envíos (v_envios) + bandeja de referencias pendientes.
 * @param {{ obraId: string, refreshKey?: number }} props
 */
export default function EnviosPanel({ obraId, refreshKey = 0 }) {
  const { catalogo } = useCatalogo(obraId);
  const opciones = useMemo(() => opcionesDeCatalogo(catalogo), [catalogo]);

  const [envios, setEnvios] = useState([]);
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bandejaOpen, setBandejaOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [tipoPorRef, setTipoPorRef] = useState({});
  const [busyRef, setBusyRef] = useState(null);
  const [mapError, setMapError] = useState(null);

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    const [eRes, rRes] = await Promise.all([
      supabase
        .from("v_envios")
        .select(
          "id, obra_id, numero, fecha_carga, matricula, bultos_detalle, bultos_declarados, peso_detalle_kg, peso_declarado_kg, modulos, contenedores",
        )
        .eq("obra_id", obraId)
        .order("numero", { ascending: false }),
      supabase
        .from("v_referencias_pendientes")
        .select(
          "obra_id, referencia, referencia_norm, descripcion, cantidad_total, bultos",
        )
        .eq("obra_id", obraId)
        .order("referencia"),
    ]);
    if (eRes.error) setError(eRes.error.message);
    else setEnvios(eRes.data ?? []);
    if (rRes.error) setError((prev) => prev ?? rRes.error.message);
    else setRefs(rRes.data ?? []);
    setSelected(new Set());
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function mapearUna(referencia, codigoTipo, pieza) {
    const { error: err } = await supabase.rpc("mapear_referencia", {
      p_obra: obraId,
      p_referencia: referencia,
      p_codigo_tipo: codigoTipo,
      p_pieza: pieza ?? null,
    });
    return err;
  }

  async function marcarMaterial(referencia) {
    setBusyRef(referencia);
    setMapError(null);
    const err = await mapearUna(referencia, null, null);
    setBusyRef(null);
    if (err) {
      setMapError(`${referencia}: ${err.message}`);
      return false;
    }
    await load();
    return true;
  }

  async function marcarTipo(referencia) {
    const opt = tipoPorRef[referencia];
    if (!opt) return;
    setBusyRef(referencia);
    setMapError(null);
    const err = await mapearUna(referencia, opt.codigo_tipo, opt.pieza);
    setBusyRef(null);
    if (err) {
      setMapError(`${referencia}: ${err.message}`);
      return;
    }
    await load();
  }

  async function marcarSeleccionadasMaterial() {
    const lista = refs.filter((r) => selected.has(r.referencia));
    setMapError(null);
    for (const r of lista) {
      setBusyRef(r.referencia);
      const err = await mapearUna(r.referencia, null, null);
      if (err) {
        setBusyRef(null);
        setMapError(`${r.referencia}: ${err.message}`);
        await load();
        return;
      }
    }
    setBusyRef(null);
    await load();
  }

  function toggleSel(referencia) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(referencia)) next.delete(referencia);
      else next.add(referencia);
      return next;
    });
  }

  function formatContenedores(v) {
    if (v == null) return "—";
    if (Array.isArray(v)) return v.join(", ") || "—";
    if (typeof v === "object") {
      if (v.codigo) return v.codigo;
      if (Array.isArray(v.codigos)) return v.codigos.join(", ");
    }
    return String(v);
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={{ fontWeight: 700, mb: 1.5, fontSize: "1rem" }}>
        Envíos
      </Typography>

      {error && (
        <Typography sx={{ color: C.danger, fontSize: "0.875rem", mb: 1 }}>
          {error}
        </Typography>
      )}
      {loading && (
        <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 1 }}>
          Cargando envíos…
        </Typography>
      )}

      {!loading && envios.length === 0 && (
        <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 2 }}>
          Todavía no hay envíos importados.
        </Typography>
      )}

      {envios.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "60px 1fr 1fr",
                md: "70px 110px 1fr 120px 140px 80px",
              },
              gap: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: C.line,
              color: C.muted,
              fontSize: "0.75rem",
            }}
          >
            <span>Nº</span>
            <Box sx={{ display: { xs: "none", md: "block" } }}>Fecha</Box>
            <span>Contenedores</span>
            <Box sx={{ display: { xs: "none", md: "block" } }}>Bultos</Box>
            <Box sx={{ display: { xs: "none", md: "block" } }}>Peso (kg)</Box>
            <span>Módulos</span>
          </Box>
          {envios.map((row) => {
            const bultosDiff =
              row.bultos_declarados != null &&
              row.bultos_detalle != null &&
              Number(row.bultos_detalle) !== Number(row.bultos_declarados);
            const pesoDiff =
              row.peso_declarado_kg != null &&
              row.peso_detalle_kg != null &&
              Math.abs(
                Number(row.peso_detalle_kg) - Number(row.peso_declarado_kg),
              ) > 1;
            return (
              <Box
                key={row.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "60px 1fr 1fr",
                    md: "70px 110px 1fr 120px 140px 80px",
                  },
                  gap: 1.5,
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: C.line,
                  fontSize: "0.875rem",
                  alignItems: "center",
                }}
              >
                <Typography sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                  {row.numero}
                </Typography>
                <Typography
                  sx={{
                    color: C.muted,
                    display: { xs: "none", md: "block" },
                  }}
                >
                  {row.fecha_carga || "—"}
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: "0.85rem" }}>
                  {formatContenedores(row.contenedores)}
                </Typography>
                <Typography
                  sx={{
                    color: bultosDiff ? "warning.main" : C.muted,
                    display: { xs: "none", md: "block" },
                  }}
                >
                  {row.bultos_detalle ?? "—"} / {row.bultos_declarados ?? "—"}
                </Typography>
                <Typography
                  sx={{
                    color: pesoDiff ? "warning.main" : C.muted,
                    display: { xs: "none", md: "block" },
                  }}
                >
                  {row.peso_detalle_kg ?? "—"} / {row.peso_declarado_kg ?? "—"}
                </Typography>
                <Typography>{row.modulos ?? "—"}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ borderTop: 1, borderColor: C.line, pt: 2 }}>
        <Button
          size="small"
          onClick={() => setBandejaOpen((o) => !o)}
          sx={{
            borderRadius: 0,
            textTransform: "none",
            color: refs.length ? "warning.main" : C.muted,
            px: 0,
            minWidth: 0,
          }}
        >
          Referencias sin revisar ({refs.length})
          {bandejaOpen ? " ▾" : " ▸"}
        </Button>

        <Collapse in={bandejaOpen} unmountOnExit>
          <Typography
            sx={{ color: C.muted, fontSize: "0.8rem", mt: 1, mb: 1.5 }}
          >
            El mapeo se aplica a los próximos imports; lo ya importado no cambia.
          </Typography>

          {mapError && (
            <Typography sx={{ color: C.danger, fontSize: "0.85rem", mb: 1 }}>
              {mapError}
            </Typography>
          )}

          {selected.size > 0 && (
            <Button
              size="small"
              variant="outlined"
              disabled={Boolean(busyRef)}
              onClick={marcarSeleccionadasMaterial}
              sx={{ borderRadius: 0, textTransform: "none", mb: 1.5 }}
            >
              Marcar seleccionadas como material
            </Button>
          )}

          {refs.length === 0 && (
            <Typography sx={{ color: C.muted, fontSize: "0.85rem" }}>
              No hay referencias pendientes.
            </Typography>
          )}

          {refs.map((r) => (
            <Box
              key={r.referencia_norm || r.referencia}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "auto 1fr",
                  md: "auto 1.4fr 0.8fr 90px 70px 1fr auto",
                },
                gap: 1,
                alignItems: "center",
                py: 1,
                borderBottom: 1,
                borderColor: C.line,
              }}
            >
              <Checkbox
                size="small"
                checked={selected.has(r.referencia)}
                onChange={() => toggleSel(r.referencia)}
                sx={{ p: 0.5 }}
              />
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {r.referencia}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.8rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                {r.descripcion || "—"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                ×{r.cantidad_total}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.8rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                {r.bultos} bultos
              </Typography>
              <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                <Autocomplete
                  size="small"
                  options={opciones}
                  value={tipoPorRef[r.referencia] ?? null}
                  onChange={(_, v) =>
                    setTipoPorRef((prev) => ({
                      ...prev,
                      [r.referencia]: v,
                    }))
                  }
                  getOptionLabel={(o) => o.label}
                  isOptionEqualToValue={(a, b) => a.key === b.key}
                  filterOptions={(opts, state) => {
                    const q = state.inputValue.trim().toLowerCase();
                    if (!q) return opts;
                    return opts.filter((o) => o.filterText.includes(q));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Es el tipo…"
                      sx={fieldSx}
                    />
                  )}
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busyRef === r.referencia}
                  onClick={() => marcarMaterial(r.referencia)}
                  sx={{ borderRadius: 0, textTransform: "none" }}
                >
                  Es material
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={
                    busyRef === r.referencia || !tipoPorRef[r.referencia]
                  }
                  onClick={() => marcarTipo(r.referencia)}
                  sx={{
                    borderRadius: 0,
                    textTransform: "none",
                    display: { xs: "none", md: "inline-flex" },
                  }}
                >
                  Asignar tipo
                </Button>
              </Box>
            </Box>
          ))}
        </Collapse>
      </Box>
    </Box>
  );
}
