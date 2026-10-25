import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { buildCustomerStatement } from "./customerStatement";
import { formatDateTime, formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminToast } from "./toast";
import { useOperatingContext } from "./useOperatingContext";
import CustomerDialog from "./CustomerDialog";

function balanceColor(n) {
  if (n > 0) return "error.main";
  if (n < 0) return "success.main";
  return "text.primary";
}

function cellMoney(amount, currency) {
  if (amount == null) return "";
  return formatMoney(amount, currency);
}

export default function CustomerSheet({
  open,
  customerId,
  onClose,
  onCollect,
  onChanged,
}) {
  const ops = useOperatingContext();
  const { showError } = useAdminToast();
  const [customer, setCustomer] = useState(null);
  const [balance, setBalance] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    const [cust, bal, sales, payments] = await Promise.all([
      supabase
        .from("admin_customers")
        .select(
          "id, name, doc_type, doc_number, phone, email, address, notes, credit_limit, credit_limit_currency, active",
        )
        .eq("id", customerId)
        .maybeSingle(),
      supabase
        .from("admin_customer_balances")
        .select("customer_id, balance_uyu, balance_usd, credit_limit, credit_limit_currency")
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabase
        .from("admin_sales")
        .select("id, number, kind, currency, total, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true }),
      supabase
        .from("admin_payments")
        .select(
          "id, kind, currency, amount, applied_currency, applied_amount, status, created_at",
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true }),
    ]);
    setLoading(false);
    if (cust.error) {
      showError(rpcErrorMessage(cust.error));
      return;
    }
    if (bal.error) showError(rpcErrorMessage(bal.error));
    if (sales.error) showError(rpcErrorMessage(sales.error));
    if (payments.error) showError(rpcErrorMessage(payments.error));
    setCustomer(cust.data);
    setBalance(bal.data);
    setRows(buildCustomerStatement(sales.data ?? [], payments.data ?? []));
  }, [customerId, showError]);

  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setBalance(null);
      setRows([]);
      return;
    }
    load();
  }, [open, customerId, load]);

  const balUyu = Number(balance?.balance_uyu) || 0;
  const balUsd = Number(balance?.balance_usd) || 0;
  const limit =
    customer?.credit_limit == null
      ? "Sin límite"
      : formatMoney(customer.credit_limit, customer.credit_limit_currency);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { height: "90vh", maxHeight: 800 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {customer?.name ?? "Cliente"}
          </Box>
          <Button size="small" onClick={() => setEditOpen(true)} disabled={!customer}>
            Editar
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!ops.canOperate || !customer}
            title={ops.canOperate ? undefined : "Abrí la caja para cobrar"}
            onClick={() => onCollect?.(customer)}
          >
            Cobrar
          </Button>
          <Button size="small" onClick={onClose}>
            Cerrar
          </Button>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}
        >
          {loading && !customer ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : customer ? (
            <>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Documento:{" "}
                  {customer.doc_number
                    ? `${customer.doc_type ?? ""} ${customer.doc_number}`.trim()
                    : "—"}
                </Typography>
                <Typography variant="body2">Teléfono: {customer.phone || "—"}</Typography>
                <Typography variant="body2">Email: {customer.email || "—"}</Typography>
                <Typography variant="body2">Dirección: {customer.address || "—"}</Typography>
                {customer.notes ? (
                  <Typography variant="body2">Notas: {customer.notes}</Typography>
                ) : null}
                <Typography variant="body2">
                  Saldo $:{" "}
                  <Box component="span" sx={{ color: balanceColor(balUyu), fontWeight: 600 }}>
                    {formatMoney(balUyu, "UYU")}
                  </Box>
                  {" · "}
                  Saldo U$S:{" "}
                  <Box component="span" sx={{ color: balanceColor(balUsd), fontWeight: 600 }}>
                    {formatMoney(balUsd, "USD")}
                  </Box>
                </Typography>
                <Typography variant="body2">Límite: {limit}</Typography>
              </Stack>

              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 12 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha y hora</TableCell>
                      <TableCell>Concepto</TableCell>
                      <TableCell align="right">Debe $</TableCell>
                      <TableCell align="right">Haber $</TableCell>
                      <TableCell align="right">Debe U$S</TableCell>
                      <TableCell align="right">Haber U$S</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary">
                            Sin movimientos
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow
                          key={r.key}
                          sx={
                            r.voided
                              ? { textDecoration: "line-through", opacity: 0.65 }
                              : undefined
                          }
                        >
                          <TableCell>{formatDateTime(r.at)}</TableCell>
                          <TableCell>{r.concept}</TableCell>
                          <TableCell align="right">
                            {cellMoney(r.debeUyu, "UYU")}
                          </TableCell>
                          <TableCell align="right">
                            {cellMoney(r.haberUyu, "UYU")}
                          </TableCell>
                          <TableCell align="right">
                            {cellMoney(r.debeUsd, "USD")}
                          </TableCell>
                          <TableCell align="right">
                            {cellMoney(r.haberUsd, "USD")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <CustomerDialog
        open={editOpen}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          load();
          onChanged?.();
        }}
      />
    </>
  );
}
