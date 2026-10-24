import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Button, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { TIPOS } from "../fachada/buildSlots";
import { medidasDesdeSlots } from "../fachada/slotsDesdeTorre";
import { ORDEN_VISUAL, VISUAL, formatFechaUY } from "./model";
import { ProgresoGate, useProgreso } from "./useProgresoData.jsx";
import { CajaTabla, EstadoMarca, tablaSx, ubicacion } from "./ui";

const RANK = { sin_modulo: 0, produccion: 1, camino: 2, obra: 3, instalado: 4, terminado: 5 };

export default function PisosTab() {
  return (
    <ProgresoGate>
      <PisosVista />
    </ProgresoGate>
  );
}

function PisosVista() {
  const { obraId } = useObra();
  const { filas, config } = useProgreso();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const pisoParam = params.get("piso");

  const { pisos, maxEje, pisoMasBajo } = useMemo(() => {
    const m = medidasDesdeSlots(filas, config.caras);
    return {
      pisos: m.pisos,
      maxEje: Math.max(0, ...m.anchos),
      pisoMasBajo: m.pisoMin ?? config.piso_desde,
    };
  }, [filas, config]);

  const pisoDefault = useMemo(() => {
    const pendientes = filas.filter((f) => f.visual !== "instalado" && f.visual !== "terminado");
    if (!pendientes.length) return pisoMasBajo;
    return Math.min(...pendientes.map((f) => f.piso));
  }, [filas, pisoMasBajo]);

  useEffect(() => {
    if (pisoParam != null && pisoParam !== "") return;
    const next = new URLSearchParams(params);
    next.set("piso", String(pisoDefault));
    setParams(next, { replace: true });
  }, [pisoParam, pisoDefault, params, setParams]);

  const piso = Number(pisoParam);
  const pisoOk = pisos.includes(piso) ? piso : pisoDefault;
  const delPiso = filas.filter((f) => f.piso === pisoOk);
  const idxPiso = pisos.indexOf(pisoOk);

  function ir(n) {
    const next = new URLSearchParams(params);
    next.set("piso", String(n));
    setParams(next, { replace: true });
  }

  function abrir(fila) {
    const search = fila.modulo
      ? `?modulo=${encodeURIComponent(fila.modulo.codigo)}`
      : `?pos=${fila.piso}|${fila.caraCodigo}|${fila.eje}`;
    navigate({ pathname: `/obra/${obraId}/progreso/torre`, search });
  }

  const counts = Object.fromEntries(ORDEN_VISUAL.map((k) => [k, delPiso.filter((f) => f.visual === k).length]));
  const porInstalar = delPiso
    .filter((f) => RANK[f.visual] < 4)
    .sort((a, b) => RANK[a.visual] - RANK[b.visual] || a.caraOrden - b.caraOrden || a.eje - b.eje);
  const instalados = delPiso
    .filter((f) => f.visual === "instalado" || f.visual === "terminado")
    .sort((a, b) => (b.fechas.instalado?.getTime() ?? 0) - (a.fechas.instalado?.getTime() ?? 0));

  const celda = (cara, eje) =>
    delPiso.find((f) => f.caraCodigo === cara.codigo && f.eje === eje) ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        <Button
          aria-label="Piso anterior"
          disabled={idxPiso < 0 || idxPiso >= pisos.length - 1}
          onClick={() => ir(pisos[idxPiso + 1])}
        >
          ◀
        </Button>
        <Select
          size="small"
          value={pisoOk}
          aria-label="Elegir piso"
          onChange={(e) => ir(Number(e.target.value))}
          sx={{ minWidth: 120, borderRadius: 0 }}
        >
          {pisos.map((p) => (
            <MenuItem key={p} value={p}>
              Piso {p}
            </MenuItem>
          ))}
        </Select>
        <Button
          aria-label="Piso siguiente"
          disabled={idxPiso <= 0}
          onClick={() => ir(pisos[idxPiso - 1])}
        >
          ▶
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            navigate({ pathname: `/obra/${obraId}/progreso/torre`, search: `?piso=${pisoOk}` })
          }
        >
          Ver en 3D
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {ORDEN_VISUAL.map((k) => (
          <Box key={k} sx={{ border: 1, borderColor: "divider", px: 1.25, py: 0.75, minWidth: 96 }}>
            <Box sx={{ fontWeight: 700, fontSize: 18 }}>{counts[k]}</Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontSize: 12 }}>
              <Box sx={{ width: 10, height: 10, bgcolor: VISUAL[k].color }} />
              {VISUAL[k].label}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ border: 1, borderColor: "divider", p: 1.5, overflowX: "auto" }}>
        <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>Elevación del piso</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `88px repeat(${maxEje}, minmax(36px, 1fr))`,
            gap: "4px",
            minWidth: 88 + maxEje * 40,
          }}
        >
          <Box />
          {Array.from({ length: maxEje }, (_, i) => {
            const eje = i + 1;
            const muestra = config.caras.map((c) => celda(c, eje)).find(Boolean);
            const tipo = muestra ? (TIPOS[muestra.tipo]?.corto ?? "") : "";
            return (
              <Box key={eje} sx={{ textAlign: "center", fontSize: 12, color: "text.secondary" }}>
                Eje {eje}
                <Box sx={{ fontSize: 11 }}>{tipo}</Box>
              </Box>
            );
          })}
          {config.caras.map((cara) => (
            <CaraFila key={cara.codigo} cara={cara} maxEje={maxEje} celda={celda} onAbrir={abrir} />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box>
          <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>
            Por instalar · {porInstalar.length}
          </Typography>
          <CajaTabla>
            {porInstalar.length === 0 ? (
              <Box sx={{ p: 2, color: "text.secondary" }}>Todo el piso está instalado.</Box>
            ) : (
              <Table size="small" sx={tablaSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Módulo</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Contenedor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {porInstalar.map((f) => (
                    <TableRow key={`${f.caraCodigo}-${f.eje}`}>
                      <TableCell>{f.modulo?.codigo ?? "—"}</TableCell>
                      <TableCell>{ubicacion(f, config, false)}</TableCell>
                      <TableCell>
                        <EstadoMarca visual={f.visual} />
                      </TableCell>
                      <TableCell>{f.modulo?.contenedor_codigo ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CajaTabla>
        </Box>
        <Box>
          <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>
            Instalados · {instalados.length}
          </Typography>
          <CajaTabla>
            {instalados.length === 0 ? (
              <Box sx={{ p: 2, color: "text.secondary" }}>
                Todavía no hay módulos instalados en este piso.
              </Box>
            ) : (
              <Table size="small" sx={tablaSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Módulo</TableCell>
                    <TableCell>Ubicación</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Instalado</TableCell>
                    <TableCell>Equipo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {instalados.map((f) => (
                    <TableRow key={`${f.caraCodigo}-${f.eje}`}>
                      <TableCell>{f.modulo?.codigo ?? "—"}</TableCell>
                      <TableCell>{ubicacion(f, config, false)}</TableCell>
                      <TableCell>
                        <EstadoMarca visual={f.visual} />
                      </TableCell>
                      <TableCell>{formatFechaUY(f.fechas.instalado) || "—"}</TableCell>
                      <TableCell>{f.equipo?.nombre || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CajaTabla>
        </Box>
      </Box>
    </Box>
  );
}

function CaraFila({ cara, maxEje, celda, onAbrir }) {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", fontSize: 13 }}>{cara.nombre || cara.codigo}</Box>
      {Array.from({ length: maxEje }, (_, i) => {
        const eje = i + 1;
        const fila = celda(cara, eje);
        if (!fila) {
          // Sin slot: vacío, sin borde ni fondo (distinto de "Sin módulo").
          return <Box key={eje} sx={{ height: 32 }} />;
        }
        const tipo = TIPOS[fila.tipo]?.label ?? fila.tipo;
        return (
          <Box
            key={eje}
            component="button"
            type="button"
            title={`${fila.modulo?.codigo ?? "Sin módulo"} · Eje ${eje} · ${tipo} · ${VISUAL[fila.visual].label}`}
            aria-label={`${cara.nombre || cara.codigo}, eje ${eje}, ${VISUAL[fila.visual].label}`}
            onClick={() => onAbrir(fila)}
            sx={{
              height: 32,
              border: "1px solid",
              borderColor: "divider",
              p: 0,
              cursor: "pointer",
              bgcolor: VISUAL[fila.visual].color,
            }}
          />
        );
      })}
    </>
  );
}
