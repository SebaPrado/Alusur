import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  TextField,
  Typography,
} from "@mui/material";
import { FiFilter, FiHome, FiCheckCircle, FiLoader, FiMapPin } from "react-icons/fi";
import { MdCompareArrows, MdTerrain } from "react-icons/md";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { mismoCodigo, normalizarCodigo } from "../../lib/codigos";
import { useObra } from "../../obras/ObraProvider";
import { PageActions } from "../obra/PageActions";
import { C, fieldSx } from "../personal/theme";
import ContenedorDrawer from "./ContenedorDrawer";
import ImportarPackingDialog from "./ImportarPackingDialog";
import NuevoContenedorDialog from "./NuevoContenedorDialog";
import {
  CONTENEDOR_CONTEO_LABEL,
  CONTENEDOR_LISTA_ORDEN,
  ESTADOS_CON_LLEGADA,
  formatLlegada,
  labelEstadoContenedor,
  ordenListaEstado,
  plantaCorta,
} from "./estados";

function modulosCount(row) {
  const m = row?.modulos;
  if (Array.isArray(m) && m[0]?.count != null) return Number(m[0].count);
  if (typeof m === "number") return m;
  return 0;
}

const ICON_SIZE = 16;

function EstadoIcon({ estado }) {
  const common = { size: ICON_SIZE, style: { flexShrink: 0 } };
  switch (estado) {
    case "en_obra":
      return <FiMapPin {...common} color="currentColor" />;
    case "en_deposito":
      return <FiHome {...common} />;
    case "en_puerto":
      return <MdTerrain {...common} />;
    case "en_camino":
      return <MdCompareArrows {...common} />;
    case "en_produccion":
      return (
        <FiLoader
          {...common}
          style={{
            ...common.style,
            animation: "alusur-spin 4.5s linear infinite",
          }}
        />
      );
    case "descargado":
      return <FiCheckCircle {...common} style={{ ...common.style, color: "#4caf50" }} />;
    default:
      return null;
  }
}

export default function ContenedoresPage() {
  const { obraId, obra, can } = useObra();
  const { contenedorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const canImport = can("contenedor.import");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [q, setQ] = useState("");
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [createdBanner, setCreatedBanner] = useState(
    location.state?.createdCodigo ?? null,
  );

  const base = `/construccion/obra/${obraId}/logistica/contenedores`;
  const filtrosActivos = Boolean(filtroEstado) || Boolean(q.trim());

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
    const map = Object.fromEntries(CONTENEDOR_LISTA_ORDEN.map((e) => [e, 0]));
    for (const r of rows) {
      if (map[r.estado] != null) map[r.estado] += 1;
    }
    return map;
  }, [rows]);

  const lista = useMemo(() => {
    const needle = q.trim().toUpperCase();
    const consulta = normalizarCodigo(q);
    let list = rows;
    if (filtroEstado) list = list.filter((r) => r.estado === filtroEstado);
    if (needle) {
      list = list.filter(
        (r) =>
          (r.codigo || "").toUpperCase().includes(needle) ||
          (consulta && mismoCodigo(r.codigo, consulta)) ||
          (r.codigo_iso || "").toUpperCase().includes(needle),
      );
    }
    return [...list].sort((a, b) => {
      const ra = ordenListaEstado(a.estado);
      const rb = ordenListaEstado(b.estado);
      if (ra !== rb) return ra - rb;
      return String(a.codigo).localeCompare(String(b.codigo));
    });
  }, [rows, filtroEstado, q]);

  function toggleFiltro(estado) {
    setFiltroEstado((prev) => (prev === estado ? null : estado));
    setFiltrosOpen(false);
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
    <Box
      sx={{
        "@keyframes alusur-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      }}
    >
      {canImport && (
        <PageActions>
          <Button
            variant="contained"
            size="small"
            onClick={() => setNuevoOpen(true)}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            + Nuevo contenedor
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

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="small"
            startIcon={<FiFilter size={16} />}
            onClick={() => setFiltrosOpen((o) => !o)}
            sx={{
              borderRadius: 0,
              textTransform: "none",
              color: filtrosActivos || filtrosOpen ? C.accent : C.muted,
              borderBottom: 1,
              borderColor:
                filtrosActivos || filtrosOpen ? C.accent : "transparent",
              px: 0.5,
              minWidth: 0,
              "&:hover": { color: C.text, bgcolor: "transparent" },
            }}
          >
            Filtrar
            {filtrosActivos ? " · activo" : ""}
          </Button>
        </Box>

        <Collapse in={filtrosOpen} unmountOnExit>
          <Box
            sx={{
              mt: 1.25,
              pt: 1.25,
              borderTop: 1,
              borderColor: C.line,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.75,
                justifyContent: "flex-end",
              }}
            >
              {CONTENEDOR_LISTA_ORDEN.map((estado) => {
                const active = filtroEstado === estado;
                const n = conteos[estado] ?? 0;
                return (
                  <Button
                    key={estado}
                    size="small"
                    variant={active ? "contained" : "outlined"}
                    startIcon={<EstadoIcon estado={estado} />}
                    onClick={() => toggleFiltro(estado)}
                  >
                    {CONTENEDOR_CONTEO_LABEL[estado]} {n}
                  </Button>
                );
              })}
            </Box>
            <TextField
              size="small"
              placeholder={
                obra?.prefijo ? `Buscar contenedor (${obra.prefijo}-C-0001)` : "Buscar contenedor (CIP-C-0001)"
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ ...fieldSx, maxWidth: 280, width: "100%" }}
            />
          </Box>
        </Collapse>
      </Box>

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
                  xs: "auto 1fr 1fr",
                  md: "28px 90px 130px 100px 80px 140px 1fr",
                },
                alignItems: "center",
                gap: { xs: 0.75, md: 2 },
                py: 1.5,
                borderBottom: 1,
                borderColor: C.line,
                cursor: "pointer",
                bgcolor: selected ? "rgba(36, 149, 150, 0.12)" : "transparent",
                "&:hover": { bgcolor: "rgba(46, 58, 78, 0.45)" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                }}
              >
                <EstadoIcon estado={row.estado} />
              </Box>
              <Typography sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                {row.codigo}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.875rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                {row.codigo_iso || "—"}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.875rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                {planta}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.875rem",
                  display: { xs: "none", md: "block" },
                }}
              >
                {n} mód.
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  gridColumn: { xs: "3", md: "auto" },
                }}
              >
                {labelEstadoContenedor(row.estado)}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.875rem",
                  display: { xs: "none", md: "block" },
                }}
              >
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
