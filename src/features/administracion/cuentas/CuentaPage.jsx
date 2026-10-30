import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Link,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { FiEdit2 } from "react-icons/fi";
import { supabase } from "../../../lib/supabase";
import { useAdminOrg } from "../AdminOrgProvider";
import AnularDialog from "./AnularDialog";
import ContraparteDialog from "./ContraparteDialog";
import MovimientoDialog from "./MovimientoDialog";
import {
  conceptoMovimiento,
  etiquetaContraparte,
  formatCcDate,
  formatCcMoney,
  fraseSaldoCorto,
  fraseSaldos,
} from "./frases";

function saldoColor(saldoUyu, saldoUsd) {
  const nUyu = Number(saldoUyu) || 0;
  const nUsd = Number(saldoUsd) || 0;
  if (nUyu === 0 && nUsd === 0) return "text.secondary";
  if (nUyu > 0 || nUsd > 0) {
    if (nUyu < 0 || nUsd < 0) return "text.primary";
    return "success.main";
  }
  return "error.main";
}

function efectoSx(efecto, anulado) {
  if (anulado) return { color: "text.disabled", textDecoration: "line-through" };
  const n = Number(efecto) || 0;
  if (n > 0) return { color: "success.main", fontWeight: 600 };
  if (n < 0) return { color: "error.main", fontWeight: 600 };
  return undefined;
}

function signedEfecto(efecto, currency) {
  const n = Number(efecto) || 0;
  const abs = formatCcMoney(Math.abs(n), currency);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

function MovRowDesktop({ mv, currency, isManager, onEditar, onAnular }) {
  const anulado = Boolean(mv.anulado);
  const concepto = (
    <span>{conceptoMovimiento(mv)}</span>
  );
  return (
    <TableRow
      sx={
        anulado
          ? { bgcolor: "action.hover", "& td": { color: "text.disabled", textDecoration: "line-through" } }
          : undefined
      }
    >
      <TableCell>{formatCcDate(mv.fecha)}</TableCell>
      <TableCell>
        {anulado && mv.anulado_motivo ? (
          <Tooltip title={mv.anulado_motivo}>
            {concepto}
          </Tooltip>
        ) : (
          concepto
        )}
      </TableCell>
      <TableCell>{mv.obra ?? ""}</TableCell>
      <TableCell align="right" sx={efectoSx(mv.efecto, anulado)}>
        {anulado ? formatCcMoney(mv.importe, currency) : signedEfecto(mv.efecto, currency)}
      </TableCell>
      <TableCell align="right">
        {anulado ? "—" : fraseSaldoCorto(mv.saldo_acumulado, currency)}
      </TableCell>
      <TableCell align="right">
        {isManager && !anulado && (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <IconButton
              size="small"
              aria-label="Editar"
              title="Editar"
              onClick={() => onEditar(mv)}
            >
              <FiEdit2 size={16} />
            </IconButton>
            <Button size="small" color="warning" onClick={() => onAnular(mv)}>
              Anular
            </Button>
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
}

function MovCard({ mv, currency, isManager, onEditar, onAnular }) {
  const anulado = Boolean(mv.anulado);
  const body = (
    <Card
      variant="outlined"
      sx={{
        opacity: anulado ? 0.65 : 1,
        textDecoration: anulado ? "line-through" : "none",
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {formatCcDate(mv.fecha)}
        </Typography>
        <Typography variant="body1">{conceptoMovimiento(mv)}</Typography>
        {mv.obra && (
          <Typography variant="body2" color="text.secondary">
            {mv.obra}
          </Typography>
        )}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography sx={efectoSx(mv.efecto, anulado)}>
            {anulado ? formatCcMoney(mv.importe, currency) : signedEfecto(mv.efecto, currency)}
          </Typography>
          <Typography variant="body2">
            {anulado ? "—" : fraseSaldoCorto(mv.saldo_acumulado, currency)}
          </Typography>
        </Stack>
        {isManager && !anulado && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <IconButton
              size="small"
              aria-label="Editar"
              title="Editar"
              onClick={() => onEditar(mv)}
            >
              <FiEdit2 size={16} />
            </IconButton>
            <Button size="small" color="warning" onClick={() => onAnular(mv)}>
              Anular
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
  if (anulado && mv.anulado_motivo) {
    return <Tooltip title={mv.anulado_motivo}>{body}</Tooltip>;
  }
  return body;
}

export default function CuentaPage() {
  const { id } = useParams();
  const { isManager } = useAdminOrg();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [saldo, setSaldo] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("USD");
  const [editOpen, setEditOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(null);
  const [anularMv, setAnularMv] = useState(null);
  const [archivarBusy, setArchivarBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const [s, m] = await Promise.all([
      supabase
        .from("admin_cc_saldos")
        .select(
          "organization_id, contraparte_id, nombre, es_proveedor, es_cliente, activa, saldo_uyu, saldo_usd, vencido_a_cobrar_uyu, vencido_a_cobrar_usd, vencido_a_pagar_uyu, vencido_a_pagar_usd, proximo_vencimiento",
        )
        .eq("contraparte_id", id)
        .maybeSingle(),
      supabase
        .from("admin_cc_estado")
        .select(
          "id, contraparte_id, lado, tipo, moneda, importe, fecha, vencimiento, numero, concepto, medio, obra_id, obra, anulado, anulado_motivo, efecto, saldo_acumulado, created_at",
        )
        .eq("contraparte_id", id)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (s.error) {
      setError(s.error.message);
      return;
    }
    if (m.error) {
      setError(m.error.message);
      return;
    }
    if (!s.data) {
      setError("Empresa no encontrada");
      setSaldo(null);
      setMovimientos([]);
      return;
    }
    setSaldo(s.data);
    setMovimientos(m.data ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Detalle de contraparte para editar (rut, contacto, notas no están en la vista de saldos)
  const [detalle, setDetalle] = useState(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("admin_contrapartes")
        .select("id, nombre, es_proveedor, es_cliente, rut, contacto, notas, activa")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      setDetalle(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, saldo?.nombre, saldo?.es_proveedor, saldo?.es_cliente, saldo?.activa]);

  const monedasConMov = useMemo(() => {
    const set = new Set();
    for (const mv of movimientos) set.add(mv.moneda);
    return ["USD", "UYU"].filter((c) => set.has(c));
  }, [movimientos]);

  useEffect(() => {
    if (monedasConMov.length && !monedasConMov.includes(tab)) {
      setTab(monedasConMov[0]);
    }
  }, [monedasConMov, tab]);

  const movTab = useMemo(
    () => movimientos.filter((m) => m.moneda === tab),
    [movimientos, tab],
  );

  async function archivar() {
    if (!detalle) return;
    setArchivarBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("admin_cc_archivar_contraparte", {
      p_id: id,
      p_activa: !detalle.activa,
    });
    setArchivarBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDetalle((d) => (d ? { ...d, activa: !d.activa } : d));
    load();
  }

  if (loading && !saldo) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const frase = saldo ? fraseSaldos(saldo.saldo_uyu, saldo.saldo_usd) : "";
  const color = saldo ? saldoColor(saldo.saldo_uyu, saldo.saldo_usd) : "text.secondary";

  const vencParts = [];
  if (saldo) {
    const vcUsd = Number(saldo.vencido_a_cobrar_usd) || 0;
    const vcUyu = Number(saldo.vencido_a_cobrar_uyu) || 0;
    const vpUsd = Number(saldo.vencido_a_pagar_usd) || 0;
    const vpUyu = Number(saldo.vencido_a_pagar_uyu) || 0;
    if (vcUsd > 0) vencParts.push(`${formatCcMoney(vcUsd, "USD")} vencido a cobrar`);
    if (vcUyu > 0) vencParts.push(`${formatCcMoney(vcUyu, "UYU")} vencido a cobrar`);
    if (vpUsd > 0) vencParts.push(`${formatCcMoney(vpUsd, "USD")} vencido a pagar`);
    if (vpUyu > 0) vencParts.push(`${formatCcMoney(vpUyu, "UYU")} vencido a pagar`);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, py: 2 }}>
      <Link
        component={RouterLink}
        to="/administracion/cuentas"
        underline="hover"
        variant="body2"
        sx={{ mb: 1, alignSelf: "flex-start" }}
      >
        ← Cuentas corrientes
      </Link>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {saldo && (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ sm: "flex-start" }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {saldo.nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {etiquetaContraparte(saldo.es_proveedor, saldo.es_cliente)}
                {!saldo.activa ? " · Archivada" : ""}
              </Typography>
              <Typography variant="h4" sx={{ color, fontWeight: 700, mt: 1 }}>
                {frase}
              </Typography>
              {vencParts.map((t) => (
                <Typography key={t} variant="body2" sx={{ color: "warning.main" }}>
                  ⚠ {t}
                </Typography>
              ))}
              {saldo.proximo_vencimiento && (
                <Typography variant="body2" color="text.secondary">
                  Próximo vencimiento {formatCcDate(saldo.proximo_vencimiento)}
                </Typography>
              )}
            </Box>
            {isManager && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!detalle}
                  onClick={() => setEditOpen(true)}
                >
                  Editar empresa
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color={detalle?.activa === false ? "success" : "warning"}
                  disabled={archivarBusy || !detalle}
                  onClick={archivar}
                >
                  {detalle?.activa === false ? "Reactivar" : "Archivar"}
                </Button>
              </Stack>
            )}
          </Stack>

          {isManager && saldo.activa && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {saldo.es_proveedor && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => setMovOpen({ lado: "compra", tipo: "factura" })}
                  >
                    Nos facturó
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setMovOpen({ lado: "compra", tipo: "nota_credito" })}
                  >
                    Nos hizo una nota de crédito
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setMovOpen({ lado: "compra", tipo: "pago" })}
                  >
                    Le pagamos
                  </Button>
                </>
              )}
              {saldo.es_cliente && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => setMovOpen({ lado: "venta", tipo: "factura" })}
                  >
                    Le facturamos
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setMovOpen({ lado: "venta", tipo: "nota_credito" })}
                  >
                    Le hicimos una nota de crédito
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setMovOpen({ lado: "venta", tipo: "pago" })}
                  >
                    Nos pagó
                  </Button>
                </>
              )}
            </Stack>
          )}

          {monedasConMov.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              Todavía no hay movimientos.
            </Typography>
          ) : (
            <>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ mb: 1, borderBottom: 1, borderColor: "divider" }}
              >
                {monedasConMov.map((c) => (
                  <Tab key={c} value={c} label={c === "USD" ? "US$" : "$"} />
                ))}
              </Tabs>

              {isMobile ? (
                <Stack spacing={1}>
                  {movTab.map((mv) => (
                    <MovCard
                      key={mv.id}
                      mv={mv}
                      currency={tab}
                      isManager={isManager}
                      onEditar={(row) => setMovOpen({ movimiento: row })}
                      onAnular={setAnularMv}
                    />
                  ))}
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Concepto</TableCell>
                        <TableCell>Obra</TableCell>
                        <TableCell align="right">Importe</TableCell>
                        <TableCell align="right">Saldo</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movTab.map((mv) => (
                        <MovRowDesktop
                          key={mv.id}
                          mv={mv}
                          currency={tab}
                          isManager={isManager}
                          onEditar={(row) => setMovOpen({ movimiento: row })}
                          onAnular={setAnularMv}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </>
      )}

      <ContraparteDialog
        open={editOpen}
        contraparte={
          detalle
            ? {
                contraparte_id: detalle.id,
                nombre: detalle.nombre,
                es_proveedor: detalle.es_proveedor,
                es_cliente: detalle.es_cliente,
                rut: detalle.rut,
                contacto: detalle.contacto,
                notas: detalle.notas,
              }
            : null
        }
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          const { data, error: err } = await supabase
            .from("admin_contrapartes")
            .select("id, nombre, es_proveedor, es_cliente, rut, contacto, notas, activa")
            .eq("id", id)
            .maybeSingle();
          if (err) setError(err.message);
          else if (data) setDetalle(data);
          load();
        }}
      />

      {movOpen && (
        <MovimientoDialog
          open={Boolean(movOpen)}
          onClose={() => setMovOpen(null)}
          onSaved={load}
          contraparteId={id}
          lado={movOpen.lado}
          tipo={movOpen.tipo}
          movimiento={movOpen.movimiento ?? null}
          saldoUyu={saldo?.saldo_uyu}
          saldoUsd={saldo?.saldo_usd}
        />
      )}

      <AnularDialog
        open={Boolean(anularMv)}
        movimientoId={anularMv?.id}
        onClose={() => setAnularMv(null)}
        onAnulado={load}
      />
    </Box>
  );
}
