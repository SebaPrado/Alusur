import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAdminOrg } from "./AdminOrgProvider";
import LedgerFilters from "./LedgerFilters";
import { buildLedgerQuery, dateRangeForPreset } from "./ledgerQuery";
import { exportLedgerCsv } from "./ledgerCsv";
import { formatDateTime, formatMoney, signedMoney } from "./money";
import { useAdminRealtime } from "./useAdminRealtime";
import { useAdminToast } from "./toast";
import { rpcErrorMessage } from "./rpcError";

const PAGE = 80;

const COLS = [
  { key: "fecha", label: "Fecha y hora", sx: { minWidth: 150 } },
  { key: "tipo", label: "Tipo", sx: { minWidth: 100 } },
  { key: "nro", label: "Nº", sx: { minWidth: 56 } },
  { key: "cliente", label: "Cliente", sx: { minWidth: 120 } },
  { key: "detalle", label: "Detalle", sx: { minWidth: 180 } },
  { key: "moneda", label: "Moneda", sx: { minWidth: 56 } },
  { key: "importe", label: "Importe", sx: { minWidth: 110 }, align: "right" },
  { key: "medios", label: "Medios", sx: { minWidth: 120 } },
  { key: "ef_uyu", label: "Efectivo $", sx: { minWidth: 100 }, align: "right" },
  { key: "ef_usd", label: "Efectivo U$S", sx: { minWidth: 100 }, align: "right" },
  { key: "sal_uyu", label: "Saldo $", sx: { minWidth: 100 }, align: "right" },
  { key: "sal_usd", label: "Saldo U$S", sx: { minWidth: 100 }, align: "right" },
  { key: "usuario", label: "Usuario", sx: { minWidth: 100 } },
  { key: "terminal", label: "Terminal", sx: { minWidth: 90 } },
  { key: "estado", label: "Estado", sx: { minWidth: 80 } },
];

function isVoided(status) {
  return status === "anulada" || status === "anulado";
}

export default function LedgerPage() {
  const { organizationId } = useAdminOrg();
  const { showError } = useAdminToast();
  const [filters, setFilters] = useState({
    preset: "hoy",
    rangeFrom: "",
    rangeTo: "",
    eventType: null,
    userId: null,
    terminalId: null,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [exporting, setExporting] = useState(false);
  const loadedCountRef = useRef(0);
  const scrollRef = useRef(null);
  const range = useMemo(
    () =>
      dateRangeForPreset(filters.preset, filters.rangeFrom, filters.rangeTo),
    [filters.preset, filters.rangeFrom, filters.rangeTo],
  );

  const queryFilters = useCallback(
    () => ({
      organizationId,
      from: range.from,
      to: range.to,
      eventType: filters.eventType,
      userId: filters.userId,
      terminalId: filters.terminalId,
    }),
    [
      organizationId,
      range,
      filters.eventType,
      filters.userId,
      filters.terminalId,
    ],
  );

  const loadInitial = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await buildLedgerQuery(queryFilters()).range(
      0,
      PAGE - 1,
    );
    setLoading(false);
    if (error) {
      showError(rpcErrorMessage(error));
      setRows([]);
      loadedCountRef.current = 0;
      setHasMore(false);
      return;
    }
    const chunk = data ?? [];
    setRows(chunk);
    loadedCountRef.current = chunk.length;
    setHasMore(chunk.length >= PAGE);
  }, [organizationId, queryFilters, showError]);

  const loadMore = useCallback(async () => {
    if (!organizationId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const from = loadedCountRef.current;
    const { data, error } = await buildLedgerQuery(queryFilters()).range(
      from,
      from + PAGE - 1,
    );
    setLoadingMore(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    const chunk = data ?? [];
    setRows((prev) => [...prev, ...chunk]);
    loadedCountRef.current = from + chunk.length;
    setHasMore(chunk.length >= PAGE);
  }, [organizationId, hasMore, loadingMore, queryFilters, showError]);

  /** Realtime: refetch 0 → loadedCount sin resetear scroll. */
  const refetchLoadedRange = useCallback(async () => {
    if (!organizationId) return;
    const count = loadedCountRef.current;
    if (count <= 0) {
      await loadInitial();
      return;
    }
    const { data, error } = await buildLedgerQuery(queryFilters()).range(
      0,
      count - 1,
    );
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    const chunk = data ?? [];
    setRows(chunk);
    loadedCountRef.current = chunk.length;
  }, [organizationId, queryFilters, loadInitial, showError]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useAdminRealtime({ onTick: refetchLoadedRange });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
        loadMore();
      }
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  async function handleExport() {
    setExporting(true);
    try {
      await exportLedgerCsv(queryFilters());
    } catch (err) {
      showError(rpcErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <LedgerFilters
        value={filters}
        onChange={setFilters}
        onExport={handleExport}
        exporting={exporting}
      />
      <TableContainer ref={scrollRef} sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 12, py: 0.5, px: 1 } }}>
          <TableHead>
            <TableRow>
              {COLS.map((c) => (
                <TableCell key={c.key} align={c.align} sx={c.sx}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS.length} align="center">
                  <CircularProgress size={24} sx={{ my: 3 }} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS.length}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Sin movimientos en el período.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={`${r.event_type}-${r.ref_id}`}
                  sx={
                    isVoided(r.status)
                      ? {
                          textDecoration: "line-through",
                          opacity: 0.65,
                        }
                      : undefined
                  }
                >
                  <TableCell>{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>{r.event_type}</TableCell>
                  <TableCell>{r.number ?? ""}</TableCell>
                  <TableCell>{r.customer_name ?? ""}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={r.detail ?? ""}
                  >
                    {r.detail ?? ""}
                  </TableCell>
                  <TableCell>{r.currency === "USD" ? "U$S" : "$"}</TableCell>
                  <TableCell align="right">
                    {formatMoney(r.amount, r.currency)}
                  </TableCell>
                  <TableCell>{r.payment_methods ?? ""}</TableCell>
                  <TableCell align="right">
                    {signedMoney(r.cash_delta_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right">
                    {signedMoney(r.cash_delta_usd, "USD")}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(r.cash_balance_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(r.cash_balance_usd, "USD")}
                  </TableCell>
                  <TableCell>{r.user_name ?? ""}</TableCell>
                  <TableCell>{r.terminal_name ?? ""}</TableCell>
                  <TableCell>{r.status ?? ""}</TableCell>
                </TableRow>
              ))
            )}
            {loadingMore && (
              <TableRow>
                <TableCell colSpan={COLS.length} align="center">
                  <CircularProgress size={20} sx={{ my: 1 }} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
