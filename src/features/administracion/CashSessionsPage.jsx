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
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 12 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Apertura</TableCell>
              <TableCell>Cierre</TableCell>
              <TableCell>Caja</TableCell>
              <TableCell>Abrió</TableCell>
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
                <TableCell colSpan={14} align="center">
                  <CircularProgress size={24} sx={{ my: 3 }} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No hay aperturas ni cierres de caja.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.opened_at)}</TableCell>
                  <TableCell>
                    {r.closed_at ? formatDateTime(r.closed_at) : "Abierta"}
                  </TableCell>
                  <TableCell>{r.terminalName}</TableCell>
                  <TableCell>{r.openedByName}</TableCell>
                  <TableCell>{r.closedByName}</TableCell>
                  <TableCell align="right">{formatMoney(r.opening_uyu, "UYU")}</TableCell>
                  <TableCell align="right">{formatMoney(r.opening_usd, "USD")}</TableCell>
                  <TableCell align="right">{moneyOrBlank(r.expected_uyu, "UYU")}</TableCell>
                  <TableCell align="right">{moneyOrBlank(r.expected_usd, "USD")}</TableCell>
                  <TableCell align="right">{moneyOrBlank(r.counted_uyu, "UYU")}</TableCell>
                  <TableCell align="right">{moneyOrBlank(r.counted_usd, "USD")}</TableCell>
                  <TableCell align="right" sx={diffSx(r.difference_uyu)}>
                    {moneyOrBlank(r.difference_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right" sx={diffSx(r.difference_usd)}>
                    {moneyOrBlank(r.difference_usd, "USD")}
                  </TableCell>
                  <TableCell>{r.closing_notes ?? ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
