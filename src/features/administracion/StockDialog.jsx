import React, { useEffect, useState } from "react";
import {
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
import { rpcErrorMessage } from "./rpcError";
import { parseQtyThousandths, scaledToDecimal } from "./saleMath";
import { useAdminToast } from "./toast";

export default function StockDialog({ open, product, onClose, onSaved }) {
  const { showError, showSuccess } = useAdminToast();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("compra");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setReason("compra");
  }, [open, product?.id]);

  async function save() {
    const qty = parseQtyThousandths(quantity, { allowNegative: true });
    if (qty == null || qty === 0n) {
      showError("Cantidad inválida");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_stock", {
      p_product_id: product.id,
      p_quantity: scaledToDecimal(qty, 3),
      p_reason: reason,
      p_notes: null,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess("Stock actualizado");
    onSaved?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Cargar stock</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1}>
          {product?.name}. Positivo entra, negativo sale.
        </Typography>
        <TextField
          label="Cantidad"
          fullWidth
          margin="normal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputProps={{ inputMode: "decimal" }}
          autoFocus
        />
        <TextField
          select
          label="Motivo"
          fullWidth
          margin="normal"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <MenuItem value="compra">Compra</MenuItem>
          <MenuItem value="ajuste">Ajuste</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          Cargar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
