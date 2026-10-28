import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { supabase } from "../../../lib/supabase";

export default function AnularDialog({ open, movimientoId, onClose, onAnulado }) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setError(null);
  }, [open, movimientoId]);

  async function save() {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("admin_cc_anular", {
      p_movimiento_id: movimientoId,
      p_motivo: motivo.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onAnulado?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Anular movimiento</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" color="warning" onClick={save} disabled={busy}>
          Anular
        </Button>
      </DialogActions>
    </Dialog>
  );
}
