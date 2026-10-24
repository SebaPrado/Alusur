import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { rangoAtajo, seguimiento } from "./model";
import { ProgresoGate, useProgreso } from "./useProgresoData.jsx";
import { CajaTabla, tablaSx } from "./ui";

const ATAJOS = [
  { dias: 7, label: "Última semana" },
  { dias: 28, label: "Últimas 4 semanas" },
  { dias: 91, label: "Últimos 3 meses" },
];

const COLUMNAS = [
  { key: "salieron", label: "Salieron de fábrica", sub: "Producción → En camino" },
  { key: "llegaron", label: "Llegaron a obra", sub: "En camino → En obra" },
  { key: "instalados", label: "Instalados", sub: "En obra → Instalada" },
  { key: "terminados", label: "Terminados", sub: "Instalada → Terminada" },
];

export default function SeguimientoTab() {
  return (
    <ProgresoGate>
      <SeguimientoVista />
    </ProgresoGate>
  );
}

function SeguimientoVista() {
  const { fechasSeg, equipos } = useProgreso();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("desde") && params.get("hasta")) return;
    const r = rangoAtajo(28);
    const next = new URLSearchParams(params);
    if (!next.get("desde")) next.set("desde", r.desde);
    if (!next.get("hasta")) next.set("hasta", r.hasta);
    setParams(next, { replace: true });
  }, [params, setParams]);

  const desde = params.get("desde") || rangoAtajo(28).desde;
  const hasta = params.get("hasta") || rangoAtajo(28).hasta;
  const equipo = params.get("equipo") || "";

  function setCampo(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const data = seguimiento(fechasSeg, equipos, desde, hasta, equipo || null);
  // #region agent log
  fetch('http://127.0.0.1:7878/ingest/a845232f-d03a-4e29-9229-114d1ae28031',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b3ed7e'},body:JSON.stringify({sessionId:'b3ed7e',runId:'pre-fix',hypothesisId:'C',location:'SeguimientoTab.jsx:SeguimientoVista',message:'seguimiento computed',data:{desde,hasta,equipo:equipo||null,nFechasSeg:fechasSeg?.length??0,vacio:data.vacio,totalPeriodo:data.totalPeriodo},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const nombreFiltro = equipos.find((e) => e.id === equipo)?.nombre;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: "1.125rem" }}>
          Seguimiento
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
          Cuántos módulos pasaron de cada etapa a la siguiente entre dos fechas.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-end" }}>
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={desde}
          onChange={(e) => setCampo("desde", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={hasta}
          onChange={(e) => setCampo("hasta", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {ATAJOS.map((a) => (
          <Button
            key={a.dias}
            onClick={() => {
              const r = rangoAtajo(a.dias);
              const next = new URLSearchParams(params);
              next.set("desde", r.desde);
              next.set("hasta", r.hasta);
              setParams(next, { replace: true });
            }}
          >
            {a.label}
          </Button>
        ))}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
          <Typography sx={{ color: "text.secondary", fontSize: 13, mr: 0.5 }}>Equipo</Typography>
          <EquipoBtn on={equipo === ""} onClick={() => setCampo("equipo", "")}>
            Todos
          </EquipoBtn>
          {equipos.map((eq) => (
            <EquipoBtn key={eq.id} on={equipo === eq.id} onClick={() => setCampo("equipo", eq.id)}>
              {eq.nombre}
            </EquipoBtn>
          ))}
        </Box>
      </Box>

      {data.vacio ? (
        <Typography sx={{ color: "text.secondary" }}>No hubo movimientos entre estas fechas.</Typography>
      ) : (
        <>
          <Box>
            <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>
              Por equipo en el período
            </Typography>
            <CajaTabla>
              <Table size="small" sx={tablaSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Equipo</TableCell>
                    <TableCell align="right">Instalados</TableCell>
                    <TableCell align="right">Terminados</TableCell>
                    <TableCell align="right">Instalados por semana</TableCell>
                    <TableCell align="right">Pisos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.porEquipo.map((eq) => (
                    <TableRow key={eq.id} sx={{ opacity: equipo && equipo !== eq.id ? 0.4 : 1 }}>
                      <TableCell>{eq.nombre}</TableCell>
                      <TableCell align="right">{eq.instalados}</TableCell>
                      <TableCell align="right">{eq.terminados}</TableCell>
                      <TableCell align="right">{eq.porSemana}</TableCell>
                      <TableCell align="right">{eq.pisosLabel}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {data.totalEquipo.instalados}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {data.totalEquipo.terminados}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {data.totalEquipo.porSemana}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CajaTabla>
          </Box>

          <Box>
            <Typography sx={{ color: "text.secondary", fontSize: 12, mb: 1 }}>
              Detalle por semana
            </Typography>
            <CajaTabla>
              <Table size="small" sx={tablaSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Semana</TableCell>
                    {COLUMNAS.map((c) => (
                      <TableCell key={c.key} align="right">
                        {c.label}
                        {nombreFiltro && (c.key === "instalados" || c.key === "terminados")
                          ? ` · ${nombreFiltro}`
                          : ""}
                        <Box sx={{ fontWeight: 500, color: "text.secondary" }}>{c.sub}</Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.porSemana.map((s) => (
                    <TableRow key={s.label}>
                      <TableCell>{s.label}</TableCell>
                      {COLUMNAS.map((c) => (
                        <TableCell key={c.key} align="right">
                          {s[c.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Total del período</TableCell>
                    {COLUMNAS.map((c) => (
                      <TableCell key={c.key} align="right" sx={{ fontWeight: 700 }}>
                        {data.totalPeriodo[c.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </CajaTabla>
          </Box>
        </>
      )}
    </Box>
  );
}

function EquipoBtn({ on, children, onClick }) {
  return (
    <Button
      onClick={onClick}
      variant={on ? "contained" : "text"}
      sx={{ minWidth: 0, px: 1.25 }}
    >
      {children}
    </Button>
  );
}
