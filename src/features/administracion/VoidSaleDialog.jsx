import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminToast } from "./toast";

export default function VoidSaleDialog({ open, sale, onClose, onVoided }) {
  const { showError, showSuccess } = useAdminToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setBusy(false);
  }, [open]);

  async function confirm() {
    const text = reason.trim();
    if (!text) {
      showError("Motivo obligatorio");
      return;
    }
    if (!sale?.ref_id) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_void_sale", {
      p_sale_id: sale.ref_id,
      p_reason: text,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess(`Venta Nº ${sale.number} anulada`);
    onVoided?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Anular venta</DialogTitle>
      <DialogContent>
        {sale && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Venta Nº {sale.number}
            {sale.customer_name ? ` · ${sale.customer_name}` : ""}
            {" · "}
            {formatMoney(sale.amount, sale.currency)}
          </Typography>
        )}
        <TextField
          label="Motivo"
          fullWidth
          margin="normal"
          multiline
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={confirm}
          disabled={busy || !reason.trim()}
        >
          Anular
        </Button>
      </DialogActions>
    </Dialog>
  );
}
