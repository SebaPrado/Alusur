import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { supabase } from "../../../lib/supabase";
import { useAdminOrg } from "../AdminOrgProvider";
import ContraparteDialog from "./ContraparteDialog";
import {
  absMax,
  etiquetaContraparte,
  formatCcDate,
  formatCcMoney,
  fraseSaldos,
} from "./frases";

function ResumenBlock({ title, color, lines, vencidoLines }) {
  if (!lines.length) return null;
  return (
    <Box sx={{ flex: 1, minWidth: 180 }}>
      <Typography
        variant="overline"
        sx={{ color, fontWeight: 700, letterSpacing: 1 }}
      >
        {title}
      </Typography>
      {lines.map((l) => (
        <Typography key={l.key} variant="h4" sx={{ color, fontWeight: 700, lineHeight: 1.2 }}>
          {l.text}
        </Typography>
      ))}
      {vencidoLines.map((l) => (
        <Typography key={l.key} variant="body2" sx={{ color: "warning.main", mt: 0.5 }}>
          ⚠ {l.text} vencido
        </Typography>
      ))}
    </Box>
  );
}

function filaFrase(row) {
  const etiqueta = etiquetaContraparte(row.es_proveedor, row.es_cliente);
  const saldo = fraseSaldos(row.saldo_uyu, row.saldo_usd);
  const bits = [`${row.nombre} · ${etiqueta} — ${saldo}`];

  const vencidoTotal = [];
  const vCobrarUsd = Number(row.vencido_a_cobrar_usd) || 0;
  const vCobrarUyu = Number(row.vencido_a_cobrar_uyu) || 0;
  const vPagarUsd = Number(row.vencido_a_pagar_usd) || 0;
  const vPagarUyu = Number(row.vencido_a_pagar_uyu) || 0;
  if (vCobrarUsd > 0) vencidoTotal.push(formatCcMoney(vCobrarUsd, "USD"));
  if (vCobrarUyu > 0) vencidoTotal.push(formatCcMoney(vCobrarUyu, "UYU"));
  if (vPagarUsd > 0) vencidoTotal.push(formatCcMoney(vPagarUsd, "USD"));
  if (vPagarUyu > 0) vencidoTotal.push(formatCcMoney(vPagarUyu, "UYU"));
  if (vencidoTotal.length) {
    bits.push(`⚠ ${vencidoTotal.join(" y ")} vencido`);
  } else if (row.proximo_vencimiento) {
    bits.push(`próximo vencimiento ${formatCcDate(row.proximo_vencimiento)}`);
  }
  return bits.join(" · ");
}

export default function CuentasPage() {
  const { organizationId, isManager } = useAdminOrg();
  const [resumen, setResumen] = useState(null);
  const [saldos, setSaldos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    const [r, s] = await Promise.all([
      supabase
        .from("admin_cc_resumen")
        .select(
          "nos_deben_uyu, nos_deben_usd, debemos_uyu, debemos_usd, vencido_a_cobrar_uyu, vencido_a_cobrar_usd, vencido_a_pagar_uyu, vencido_a_pagar_usd",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("admin_cc_saldos")
        .select(
          "organization_id, contraparte_id, nombre, es_proveedor, es_cliente, activa, saldo_uyu, saldo_usd, vencido_a_cobrar_uyu, vencido_a_cobrar_usd, vencido_a_pagar_uyu, vencido_a_pagar_usd, proximo_vencimiento",
        )
        .eq("organization_id", organizationId),
    ]);
    setLoading(false);
    if (r.error) {
      setError(r.error.message);
      return;
    }
    if (s.error) {
      setError(s.error.message);
      return;
    }
    setResumen(
      r.data ?? {
        nos_deben_uyu: 0,
        nos_deben_usd: 0,
        debemos_uyu: 0,
        debemos_usd: 0,
        vencido_a_cobrar_uyu: 0,
        vencido_a_cobrar_usd: 0,
        vencido_a_pagar_uyu: 0,
        vencido_a_pagar_usd: 0,
      },
    );
    setSaldos(s.data ?? []);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const rows = verArchivadas ? saldos : saldos.filter((x) => x.activa);
    return [...rows].sort(
      (a, b) => absMax(b.saldo_uyu, b.saldo_usd) - absMax(a.saldo_uyu, a.saldo_usd),
    );
  }, [saldos, verArchivadas]);

  const teDebenLines = [];
  const teDebenVencido = [];
  const debesLines = [];
  const debesVencido = [];
  if (resumen) {
    const nosUsd = Number(resumen.nos_deben_usd) || 0;
    const nosUyu = Number(resumen.nos_deben_uyu) || 0;
    const debUsd = Number(resumen.debemos_usd) || 0;
    const debUyu = Number(resumen.debemos_uyu) || 0;
    if (nosUsd > 0) teDebenLines.push({ key: "usd", text: formatCcMoney(nosUsd, "USD") });
    if (nosUyu > 0) teDebenLines.push({ key: "uyu", text: formatCcMoney(nosUyu, "UYU") });
    if (debUsd > 0) debesLines.push({ key: "usd", text: formatCcMoney(debUsd, "USD") });
    if (debUyu > 0) debesLines.push({ key: "uyu", text: formatCcMoney(debUyu, "UYU") });

    const vcUsd = Number(resumen.vencido_a_cobrar_usd) || 0;
    const vcUyu = Number(resumen.vencido_a_cobrar_uyu) || 0;
    const vpUsd = Number(resumen.vencido_a_pagar_usd) || 0;
    const vpUyu = Number(resumen.vencido_a_pagar_uyu) || 0;
    if (vcUsd > 0) teDebenVencido.push({ key: "usd", text: formatCcMoney(vcUsd, "USD") });
    if (vcUyu > 0) teDebenVencido.push({ key: "uyu", text: formatCcMoney(vcUyu, "UYU") });
    if (vpUsd > 0) debesVencido.push({ key: "usd", text: formatCcMoney(vpUsd, "USD") });
    if (vpUyu > 0) debesVencido.push({ key: "uyu", text: formatCcMoney(vpUyu, "UYU") });
  }

  const aMano =
    resumen &&
    teDebenLines.length === 0 &&
    debesLines.length === 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, py: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !resumen ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: "divider" }}
          >
            {aMano ? (
              <Typography variant="h5" color="text.secondary">
                Están a mano con todos
              </Typography>
            ) : (
              <>
                <ResumenBlock
                  title="Te deben"
                  color="success.main"
                  lines={teDebenLines}
                  vencidoLines={teDebenVencido}
                />
                <ResumenBlock
                  title="Debés"
                  color="error.main"
                  lines={debesLines}
                  vencidoLines={debesVencido}
                />
              </>
            )}
          </Stack>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={verArchivadas}
                  onChange={(e) => setVerArchivadas(e.target.checked)}
                />
              }
              label="Ver archivadas"
            />
            <Box sx={{ flex: 1 }} />
            {isManager && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setEditando(null);
                  setDialogOpen(true);
                }}
              >
                + Empresa
              </Button>
            )}
          </Box>

          {visible.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>
              Todavía no hay empresas. {isManager ? "Agregá la primera con + Empresa." : ""}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {visible.map((row) => (
                <Box
                  key={row.contraparte_id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1.25,
                    px: 1.5,
                    borderRadius: 1,
                    opacity: row.activa ? 1 : 0.55,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Link
                    component={RouterLink}
                    to={`/administracion/cuentas/${row.contraparte_id}`}
                    underline="hover"
                    color="inherit"
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <Typography variant="body1">{filaFrase(row)}</Typography>
                  </Link>
                  {isManager && (
                    <Button
                      size="small"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { data, error: err } = await supabase
                          .from("admin_contrapartes")
                          .select(
                            "id, nombre, es_proveedor, es_cliente, rut, contacto, notas",
                          )
                          .eq("id", row.contraparte_id)
                          .maybeSingle();
                        if (err) {
                          setError(err.message);
                          return;
                        }
                        setEditando(
                          data
                            ? {
                                contraparte_id: data.id,
                                nombre: data.nombre,
                                es_proveedor: data.es_proveedor,
                                es_cliente: data.es_cliente,
                                rut: data.rut,
                                contacto: data.contacto,
                                notas: data.notas,
                              }
                            : null,
                        );
                        setDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}

      <ContraparteDialog
        open={dialogOpen}
        contraparte={editando}
        onClose={() => {
          setDialogOpen(false);
          setEditando(null);
        }}
        onSaved={() => load()}
      />
    </Box>
  );
}
