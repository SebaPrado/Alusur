import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatDateTime, formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminRealtime } from "./useAdminRealtime";
import { useAdminToast } from "./toast";

function moneyOrBlank(amount, currency) {
  if (amount == null) return "";
  return formatMoney(amount, currency);
}

function diffSx(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return { color: "error.main", fontWeight: 600 };
}

function isOpenSession(row) {
  return row.status === "abierta";
}

export default function CashSessionsPage() {
  const { organizationId } = useAdminOrg();
  const { showError } = useAdminToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [sessions, terminals, members] = await Promise.all([
      supabase
        .from("admin_cash_sessions")
        .select(
          "id, status, opened_at, closed_at, opened_by, closed_by, terminal_id, opening_uyu, opening_usd, expected_uyu, expected_usd, counted_uyu, counted_usd, difference_uyu, difference_usd, closing_notes",
        )
        .eq("organization_id", organizationId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("admin_terminals")
        .select("id, name")
        .eq("organization_id", organizationId),
      supabase
        .from("admin_members")
        .select("user_id, display_name")
        .eq("organization_id", organizationId),
    ]);
    setLoading(false);
    const error = sessions.error || terminals.error || members.error;
    if (error) {
      showError(rpcErrorMessage(error));
      setRows([]);
      return;
    }
    const terminalName = new Map((terminals.data ?? []).map((t) => [t.id, t.name]));
    const memberName = new Map((members.data ?? []).map((m) => [m.user_id, m.display_name]));
    setRows(
      (sessions.data ?? []).map((s) => ({
        ...s,
        terminalName: terminalName.get(s.terminal_id) ?? "",
        openedByName: memberName.get(s.opened_by) ?? "",
        closedByName: s.closed_by ? memberName.get(s.closed_by) ?? "" : "",
      })),
    );
  }, [organizationId, showError]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminRealtime({ onTick: load, tables: ["admin_cash_sessions"] });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ pb: 1.25, flexShrink: 0 }}>
        Cada fila es un turno de una caja: se abre con un fondo y, al cerrarlo, se
        compara lo contado con lo que debía haber. Si sigue abierto, todavía no hay cierre.
      </Typography>
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 12 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Estado</TableCell>
              <TableCell>Caja</TableCell>
              <TableCell>Apertura</TableCell>
              <TableCell>Abrió</TableCell>
              <TableCell>Cierre</TableCell>
              <TableCell>Cerró</TableCell>
              <TableCell align="right">Fondo $</TableCell>
              <TableCell align="right">Fondo U$S</TableCell>
              <TableCell align="right">Esperado $</TableCell>
              <TableCell align="right">Esperado U$S</TableCell>
              <TableCell align="right">Contado $</TableCell>
              <TableCell align="right">Contado U$S</TableCell>
              <TableCell align="right">Diferencia $</TableCell>
              <TableCell align="right">Diferencia U$S</TableCell>
              <TableCell>Notas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} align="center">
                  <CircularProgress size={24} sx={{ my: 3 }} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No hay turnos de caja.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const open = isOpenSession(r);
                return (
                <TableRow
                  key={r.id}
                  sx={
                    open
                      ? (theme) => ({ bgcolor: alpha(theme.palette.warning.main, 0.1) })
                      : undefined
                  }
                >
                  <TableCell
                    sx={{
                      color: open ? "warning.main" : "text.secondary",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {open ? "Abierta" : "Cerrada"}
                  </TableCell>
                  <TableCell>{r.terminalName}</TableCell>
                  <TableCell>{formatDateTime(r.opened_at)}</TableCell>
                  <TableCell>{r.openedByName}</TableCell>
                  <TableCell sx={{ color: open ? "text.secondary" : undefined }}>
                    {r.closed_at ? formatDateTime(r.closed_at) : "—"}
                  </TableCell>
                  <TableCell>{r.closedByName || (open ? "—" : "")}</TableCell>
                  <TableCell align="right">{formatMoney(r.opening_uyu, "UYU")}</TableCell>
                  <TableCell align="right">{formatMoney(r.opening_usd, "USD")}</TableCell>
                  <TableCell align="right" sx={{ color: open ? "text.secondary" : undefined }}>
                    {open ? "—" : moneyOrBlank(r.expected_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right" sx={{ color: open ? "text.secondary" : undefined }}>
                    {open ? "—" : moneyOrBlank(r.expected_usd, "USD")}
                  </TableCell>
                  <TableCell align="right" sx={{ color: open ? "text.secondary" : undefined }}>
                    {open ? "—" : moneyOrBlank(r.counted_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right" sx={{ color: open ? "text.secondary" : undefined }}>
                    {open ? "—" : moneyOrBlank(r.counted_usd, "USD")}
                  </TableCell>
                  <TableCell align="right" sx={open ? { color: "text.secondary" } : diffSx(r.difference_uyu)}>
                    {open ? "—" : moneyOrBlank(r.difference_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right" sx={open ? { color: "text.secondary" } : diffSx(r.difference_usd)}>
                    {open ? "—" : moneyOrBlank(r.difference_usd, "USD")}
                  </TableCell>
                  <TableCell>{open ? "—" : r.closing_notes ?? ""}</TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
