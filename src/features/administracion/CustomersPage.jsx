import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import CollectionDialog from "./CollectionDialog";
import CustomerDialog from "./CustomerDialog";
import CustomerSheet from "./CustomerSheet";
import { formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminRealtime } from "./useAdminRealtime";
import { useAdminToast } from "./toast";

const BALANCE_TABLES = ["admin_sales", "admin_payments"];

function balanceSx(n) {
  if (n > 0) return { color: "error.main", fontWeight: 600 };
  if (n < 0) return { color: "success.main", fontWeight: 600 };
  return undefined;
}

function docLabel(c) {
  if (!c.doc_number) return "";
  return `${c.doc_type ?? ""} ${c.doc_number}`.trim();
}

export default function CustomersPage() {
  const { organizationId } = useAdminOrg();
  const { showError } = useAdminToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetId, setSheetId] = useState(null);
  const [sheetNonce, setSheetNonce] = useState(0);
  const [collectCustomer, setCollectCustomer] = useState(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [customers, balances] = await Promise.all([
      supabase
        .from("admin_customers")
        .select(
          "id, name, doc_type, doc_number, phone, email, address, notes, credit_limit, credit_limit_currency, active",
        )
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("admin_customer_balances")
        .select("customer_id, balance_uyu, balance_usd")
        .eq("organization_id", organizationId),
    ]);
    if (customers.error) {
      showError(rpcErrorMessage(customers.error));
      setRows([]);
      setLoading(false);
      return;
    }
    if (balances.error) showError(rpcErrorMessage(balances.error));
    const byId = new Map(
      (balances.data ?? []).map((b) => [b.customer_id, b]),
    );
    setRows(
      (customers.data ?? []).map((c) => {
        const b = byId.get(c.id);
        return {
          ...c,
          balance_uyu: Number(b?.balance_uyu) || 0,
          balance_usd: Number(b?.balance_usd) || 0,
        };
      }),
    );
    setLoading(false);
  }, [organizationId, showError]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useAdminRealtime({ onTick: load, tables: BALANCE_TABLES });

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.doc_number ?? "").toLowerCase().includes(q),
      )
    : rows;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box sx={{ display: "flex", gap: 1, py: 1, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o documento"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 300 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          onClick={() => setDialogOpen(true)}
        >
          + Nuevo cliente
        </Button>
      </Box>
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 13 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Teléfono</TableCell>
              <TableCell align="right">Saldo $</TableCell>
              <TableCell align="right">Saldo U$S</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No hay clientes
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visible.map((c) => (
              <TableRow
                key={c.id}
                hover
                sx={{ cursor: "pointer", opacity: c.active ? 1 : 0.55 }}
                onClick={() => setSheetId(c.id)}
              >
                <TableCell>
                  {c.name}
                  {c.active ? "" : " (inactivo)"}
                </TableCell>
                <TableCell>{docLabel(c)}</TableCell>
                <TableCell>{c.phone ?? ""}</TableCell>
                <TableCell align="right" sx={balanceSx(c.balance_uyu)}>
                  {formatMoney(c.balance_uyu, "UYU")}
                </TableCell>
                <TableCell align="right" sx={balanceSx(c.balance_usd)}>
                  {formatMoney(c.balance_usd, "USD")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CustomerDialog
        open={dialogOpen}
        customer={null}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
      <CustomerSheet
        key={`${sheetId ?? ""}-${sheetNonce}`}
        open={Boolean(sheetId)}
        customerId={sheetId}
        onClose={() => setSheetId(null)}
        onChanged={load}
        onCollect={(cust) => {
          setCollectCustomer(cust);
        }}
      />
      <CollectionDialog
        open={Boolean(collectCustomer)}
        customer={collectCustomer}
        onClose={() => setCollectCustomer(null)}
        onSaved={() => {
          load();
          setSheetNonce((n) => n + 1);
        }}
      />
    </Box>
  );
}
