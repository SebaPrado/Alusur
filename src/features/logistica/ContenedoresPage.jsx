import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useObra } from "../../obras/ObraProvider";
import { PageActions } from "../obra/PageActions";
import { C, fieldSx } from "../personal/theme";
import ContenedorDrawer from "./ContenedorDrawer";
import ImportarPackingDialog from "./ImportarPackingDialog";
import NuevoContenedorDialog from "./NuevoContenedorDialog";
import {
  CONTENEDOR_CONTEO_LABEL,
  CONTENEDOR_ESTADOS,
  ESTADOS_CON_LLEGADA,
  formatLlegada,
  labelEstadoContenedor,
  plantaCorta,
  rangoEstado,
} from "./estados";

function modulosCount(row) {
  const m = row?.modulos;
  if (Array.isArray(m) && m[0]?.count != null) return Number(m[0].count);
  if (typeof m === "number") return m;
  return 0;
}

export default function ContenedoresPage() {
  const { obraId, can } = useObra();
  const { contenedorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const canImport = can("contenedor.import");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [createdBanner, setCreatedBanner] = useState(
    location.state?.createdCodigo ?? null,
  );

  const base = `/obra/${obraId}/logistica/contenedores`;

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("contenedores")
      .select(
        "id, codigo, codigo_iso, estado, llegada_estimada, plantas(nombre), modulos(count)",
      )
      .eq("obra_id", obraId);
    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (location.state?.createdCodigo) {
      setCreatedBanner(location.state.createdCodigo);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const conteos = useMemo(() => {
    const map = Object.fromEntries(CONTENEDOR_ESTADOS.map((e) => [e, 0]));
    for (const r of rows) {
      if (map[r.estado] != null) map[r.estado] += 1;
    }
    return map;
  }, [rows]);

  const lista = useMemo(() => {
    const needle = q.trim().toUpperCase();
    let list = rows;
    if (filtroEstado) list = list.filter((r) => r.estado === filtroEstado);
    if (needle) {
      list = list.filter(
        (r) =>
          (r.codigo || "").toUpperCase().includes(needle) ||
          (r.codigo_iso || "").toUpperCase().includes(needle),
      );
    }
    return [...list].sort((a, b) => {
      const ra = rangoEstado(a.estado);
      const rb = rangoEstado(b.estado);
      if (ra !== rb) return ra - rb;
      return String(a.codigo).localeCompare(String(b.codigo));
    });
  }, [rows, filtroEstado, q]);

  function toggleFiltro(estado) {
    setFiltroEstado((prev) => (prev === estado ? null : estado));
  }

  function openDetalle(id) {
    navigate(`${base}/${id}`);
  }

  function closeDetalle() {
    setCreatedBanner(null);
    navigate(base);
  }

  function onImported({ id, codigo, partial }) {
    load();
    if (partial) {
      // el diálogo queda abierto con el error; igual refrescar
      return;
    }
    setCreatedBanner(codigo);
    navigate(`${base}/${id}`, { state: { createdCodigo: codigo } });
  }

  return (
    <Box>
      {canImport && (
        <PageActions>
          <Button
            variant="contained"
            size="small"
            onClick={() => setNuevoOpen(true)}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            Nuevo contenedor
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setImportOpen(true)}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            Importar packing list
          </Button>
        </PageActions>
      )}

      {/* Conteo */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: { xs: 1, sm: 0 },
          mb: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: C.line,
        }}
      >
        {CONTENEDOR_ESTADOS.map((estado, i) => {
          const active = filtroEstado === estado;
          const n = conteos[estado] ?? 0;
          return (
            <React.Fragment key={estado}>
              {i > 0 && (
                <Typography
                  component="span"
                  sx={{
                    color: C.muted,
                    px: 0.75,
                    display: { xs: "none", sm: "inline" },
                  }}
                >
                  ·
                </Typography>
              )}
              <Typography
                component="button"
                type="button"
                onClick={() => toggleFiltro(estado)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  color: active ? C.accent : C.muted,
                  fontWeight: active ? 600 : 400,
                  fontSize: "0.875rem",
                  borderBottom: active ? `1px solid` : "1px solid transparent",
                  borderColor: active ? C.accent : "transparent",
                  "&:hover": { color: C.text },
                }}
              >
                {CONTENEDOR_CONTEO_LABEL[estado]} {n}
              </Typography>
            </React.Fragment>
          );
        })}
      </Box>

      <TextField
        size="small"
        placeholder="Buscar por código o número ISO"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ ...fieldSx, mb: 2, maxWidth: 360 }}
        fullWidth
      />

      {error && (
        <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
          {error}
        </Typography>
      )}

      {loading && (
        <Typography sx={{ color: C.muted }}>Cargando…</Typography>
      )}

      {!loading && lista.length === 0 && (
        <Typography sx={{ color: C.muted }}>
          {rows.length === 0
            ? "Todavía no hay contenedores en esta obra."
            : "Ningún contenedor coincide con el filtro."}
        </Typography>
      )}

      <Box>
        {lista.map((row) => {
          const n = modulosCount(row);
          const planta = plantaCorta(row.plantas?.nombre);
          const llegada =
            ESTADOS_CON_LLEGADA.has(row.estado) && row.llegada_estimada
              ? formatLlegada(row.llegada_estimada)
              : null;
          const selected = contenedorId === row.id;
          return (
            <Box
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetalle(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetalle(row.id);
                }
              }}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr 1fr",
                  md: "90px 130px 100px 80px 110px 1fr",
                },
                gap: { xs: 0.5, md: 2 },
                py: 1.5,
                borderBottom: 1,
                borderColor: C.line,
                cursor: "pointer",
                bgcolor: selected ? "rgba(36, 149, 150, 0.12)" : "transparent",
                "&:hover": { bgcolor: "rgba(46, 58, 78, 0.45)" },
              }}
            >
              <Typography sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                {row.codigo}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {row.codigo_iso || "—"}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {planta}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {n} mód.
              </Typography>
              <Typography sx={{ fontSize: "0.875rem" }}>
                {labelEstadoContenedor(row.estado)}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {llegada ? `llega ${llegada}` : ""}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <ContenedorDrawer
        contenedorId={contenedorId ?? null}
        obraId={obraId}
        createdBanner={
          contenedorId && createdBanner ? createdBanner : null
        }
        onClose={closeDetalle}
        onChanged={load}
      />

      {canImport && (
        <>
          <NuevoContenedorDialog
            open={nuevoOpen}
            onClose={() => setNuevoOpen(false)}
            obraId={obraId}
            onImported={onImported}
          />
          <ImportarPackingDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            obraId={obraId}
            onImported={onImported}
          />
        </>
      )}
    </Box>
  );
}
