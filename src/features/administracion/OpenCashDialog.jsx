import React, { useState } from "react";
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
import { useAdminOrg } from "./AdminOrgProvider";
import { rpcErrorMessage } from "./rpcError";
import { centsToInput, parseMoneyToCents } from "./saleMath";
import { useAdminToast } from "./toast";

export default function OpenCashDialog({ open, onClose, terminalId, onOpened }) {
  const { organizationId } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
  const [uyu, setUyu] = useState("0");
  const [usd, setUsd] = useState("0");
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    const yuyCents = parseMoneyToCents(uyu, "UYU");
    const usdCents = parseMoneyToCents(usd, "USD");
    if (yuyCents == null || usdCents == null) {
      showError("Importe de apertura inválido");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_open_cash_session", {
      p_organization_id: organizationId,
      p_terminal_id: terminalId,
      p_opening_uyu: Number(centsToInput(yuyCents, "UYU")),
      p_opening_usd: Number(centsToInput(usdCents, "USD")),
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess("Caja abierta");
    onOpened?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Abrir caja</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Fondo inicial de cada cajón (efectivo físico).
        </Typography>
        <TextField
          label="Fondo UYU ($)"
          fullWidth
          margin="normal"
          value={uyu}
          onChange={(e) => setUyu(e.target.value)}
          inputProps={{ inputMode: "decimal" }}
        />
        <TextField
          label="Fondo USD (U$S)"
          fullWidth
          margin="normal"
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          inputProps={{ inputMode: "decimal" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleOpen} disabled={busy}>
          Abrir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
