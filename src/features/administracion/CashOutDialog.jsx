import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { centsToInput, parseMoneyToCents } from "./saleMath";
import { useAdminToast } from "./toast";
import { useOperatingContext } from "./useOperatingContext";

const REASONS = [
  { value: "retiro_socio", label: "Retiro socio" },
  { value: "pago_proveedor", label: "Pago a proveedor" },
  { value: "flete", label: "Flete" },
  { value: "sueldo_adelanto", label: "Sueldo/adelanto" },
  { value: "gastos", label: "Gastos" },
  { value: "otro", label: "Otro" },
];

export default function CashOutDialog({ open, onClose, onSaved }) {
  const { organizationId } = useAdminOrg();
  const ops = useOperatingContext();
  const { showError, showSuccess } = useAdminToast();
  const [reason, setReason] = useState("retiro_socio");
  const [currency, setCurrency] = useState("UYU");
  const [amountText, setAmountText] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("retiro_socio");
    setCurrency("UYU");
    setAmountText("");
    setNotes("");
    setBusy(false);
  }, [open]);

  const amountCents = parseMoneyToCents(amountText);
  const notesOk = reason !== "otro" || notes.trim().length > 0;
  const canConfirm =
    ops.canOperate &&
    amountCents != null &&
    amountCents > 0n &&
    notesOk;

  async function confirm() {
    if (!canConfirm) return;
    if (reason === "otro" && !notes.trim()) {
      showError('El motivo "Otro" requiere una nota');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_register_cash_movement", {
      p_organization_id: organizationId,
      p_terminal_id: ops.terminalId,
      p_direction: "egreso",
      p_reason: reason,
      p_currency: currency,
      p_amount: Number(centsToInput(amountCents)),
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess(
      `Retiro registrado: ${formatMoney(centsToInput(amountCents), currency)}`,
    );
    onSaved?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Retiro</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Motivo"
          fullWidth
          margin="normal"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {REASONS.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Moneda"
          fullWidth
          margin="normal"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
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
        <TextField
          label="Nota"
          fullWidth
          margin="normal"
          multiline
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required={reason === "otro"}
          helperText={reason === "otro" ? "Obligatoria para motivo Otro" : undefined}
        />
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
