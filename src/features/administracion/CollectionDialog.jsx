import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatCents, formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import {
  centsToInput,
  convertCents,
  parseMoneyToCents,
  rateToTenThousandths,
} from "./saleMath";
import { useAdminToast } from "./toast";
import { useExchangeRate } from "./useExchangeRate";
import { useOperatingContext } from "./useOperatingContext";

const METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "pos_debito", label: "POS débito" },
  { value: "pos_credito", label: "POS crédito" },
];

function needsReference(method) {
  return method === "transferencia" || method === "pos_debito" || method === "pos_credito";
}

function pickDebtCurrency(balUyu, balUsd) {
  const owesUyu = balUyu > 0;
  const owesUsd = balUsd > 0;
  if (owesUyu && !owesUsd) return "UYU";
  if (owesUsd && !owesUyu) return "USD";
  return "UYU";
}

export default function CollectionDialog({
  open,
  customer: customerProp,
  onClose,
  onSaved,
}) {
  const { organizationId } = useAdminOrg();
  const ops = useOperatingContext();
  const { rate } = useExchangeRate();
  const { showError, showSuccess } = useAdminToast();

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [balance, setBalance] = useState(null);
  const [debtCurrency, setDebtCurrency] = useState("UYU");
  const [method, setMethod] = useState("efectivo");
  const [payCurrency, setPayCurrency] = useState("UYU");
  const [amountText, setAmountText] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const lockedCustomer = Boolean(customerProp?.id);

  useEffect(() => {
    if (!open) return;
    setMethod("efectivo");
    setPayCurrency("UYU");
    setAmountText("");
    setReference("");
    setBusy(false);
    if (customerProp?.id) {
      setCustomerId(customerProp.id);
      setCustomerQuery(customerProp.name ?? "");
    } else {
      setCustomerId(null);
      setCustomerQuery("");
      setBalance(null);
      setDebtCurrency("UYU");
    }
  }, [open, customerProp]);

  useEffect(() => {
    if (!open || !organizationId || lockedCustomer) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("admin_customers")
        .select("id, name, doc_type, doc_number")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (error) showError(rpcErrorMessage(error));
      else setCustomers(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, lockedCustomer, showError]);

  useEffect(() => {
    if (!open || !customerId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("admin_customer_balances")
        .select("customer_id, balance_uyu, balance_usd, name")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        showError(rpcErrorMessage(error));
        return;
      }
      setBalance(data);
      const uyu = Number(data?.balance_uyu) || 0;
      const usd = Number(data?.balance_usd) || 0;
      setDebtCurrency(pickDebtCurrency(uyu, usd));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, customerId, showError]);

  const balUyu = Number(balance?.balance_uyu) || 0;
  const balUsd = Number(balance?.balance_usd) || 0;
  const debtAmount = debtCurrency === "USD" ? balUsd : balUyu;
  const debtCents =
    debtAmount > 0 ? parseMoneyToCents(String(debtAmount)) : 0n;

  const rateTt = rateToTenThousandths(rate?.rate);
  const amountCents = parseMoneyToCents(amountText);
  const appliedCents =
    amountCents != null && amountCents > 0n
      ? convertCents(amountCents, payCurrency, debtCurrency, rateTt)
      : null;

  const favorCents =
    appliedCents != null && debtCents != null && appliedCents > debtCents
      ? appliedCents - debtCents
      : 0n;

  const canConfirm =
    ops.canOperate &&
    Boolean(customerId) &&
    amountCents != null &&
    amountCents > 0n &&
    appliedCents != null &&
    appliedCents > 0n &&
    (!needsReference(method) || reference.trim());

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.doc_number ?? "").toLowerCase().includes(q),
    );
  }, [customers, customerQuery]);

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_register_collection", {
      p_organization_id: organizationId,
      p_terminal_id: ops.terminalId,
      p_customer_id: customerId,
      p_debt_currency: debtCurrency,
      p_method: method,
      p_currency: payCurrency,
      p_amount: Number(centsToInput(amountCents)),
      p_reference: needsReference(method) ? reference.trim() || null : null,
      p_notes: null,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess(
      `Cobranza registrada: ${formatMoney(data.applied_amount, data.applied_currency)}`,
    );
    onSaved?.(data);
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Cobranza</DialogTitle>
      <DialogContent>
        {!lockedCustomer && (
          <Box sx={{ mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              margin="normal"
              label="Cliente"
              placeholder="Nombre o documento"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId(null);
              }}
            />
            <Box
              sx={{
                maxHeight: 140,
                overflow: "auto",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              {filteredCustomers.slice(0, 30).map((c) => (
                <Button
                  key={c.id}
                  fullWidth
                  onClick={() => {
                    setCustomerId(c.id);
                    setCustomerQuery(c.name);
                  }}
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    bgcolor: c.id === customerId ? "action.selected" : undefined,
                  }}
                >
                  {c.name}
                  {c.doc_number ? ` · ${c.doc_type ?? ""} ${c.doc_number}` : ""}
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {lockedCustomer && (
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
            {customerProp.name}
          </Typography>
        )}

        {customerId && (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Deuda $: {formatMoney(balUyu, "UYU")}
            {" · "}
            Deuda U$S: {formatMoney(balUsd, "USD")}
          </Typography>
        )}

        <TextField
          select
          label="Deuda que paga"
          fullWidth
          margin="normal"
          value={debtCurrency}
          onChange={(e) => setDebtCurrency(e.target.value)}
          disabled={!customerId}
        >
          <MenuItem value="UYU">$ (UYU)</MenuItem>
          <MenuItem value="USD">U$S (USD)</MenuItem>
        </TextField>

        <TextField
          select
          label="Medio de pago"
          fullWidth
          margin="normal"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {METHODS.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Moneda con la que paga"
          fullWidth
          margin="normal"
          value={payCurrency}
          onChange={(e) => setPayCurrency(e.target.value)}
        >
          <MenuItem value="UYU">$ (UYU)</MenuItem>
          <MenuItem value="USD">U$S (USD)</MenuItem>
        </TextField>

        <TextField
          label="Importe"
          fullWidth
          margin="normal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputProps={{ inputMode: "decimal" }}
        />

        {needsReference(method) && (
          <TextField
            label="Referencia"
            fullWidth
            margin="normal"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        )}

        {amountCents != null && amountCents > 0n && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {appliedCents == null
              ? "No hay cotización para convertir"
              : `Se aplican ${formatCents(appliedCents, debtCurrency)} a la deuda`}
          </Typography>
        )}

        {favorCents > 0n && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Queda saldo a favor de {formatCents(favorCents, debtCurrency)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={confirm}
          disabled={busy || !canConfirm}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
