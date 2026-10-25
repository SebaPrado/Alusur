import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { formatMoney } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminToast } from "./toast";

function parseMoney(raw) {
  return Number(String(raw).replace(",", "."));
}

function currencyOfMethodKey(key) {
  if (key?.endsWith("_USD")) return "USD";
  return "UYU";
}

function labelOfMethodKey(key) {
  if (!key) return "";
  const [method, cur] = key.split("_");
  const methodLabel = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    pos_debito: "POS débito",
    pos_credito: "POS crédito",
  }[method] ?? method;
  return `${methodLabel} (${cur === "USD" ? "U$S" : "$"})`;
}

export default function CloseCashDialog({
  open,
  onClose,
  cashSessionId,
  onClosed,
}) {
  const { showError, showSuccess } = useAdminToast();
  const [uyu, setUyu] = useState("");
  const [usd, setUsd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleClose() {
    const counted_uyu = parseMoney(uyu);
    const counted_usd = parseMoney(usd);
    if (
      !Number.isFinite(counted_uyu) ||
      counted_uyu < 0 ||
      !Number.isFinite(counted_usd) ||
      counted_usd < 0
    ) {
      showError("Importe contado inválido");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_close_cash_session", {
      p_cash_session_id: cashSessionId,
      p_counted_uyu: counted_uyu,
      p_counted_usd: counted_usd,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    setResult(data);
    showSuccess("Caja cerrada");
    onClosed?.();
  }

  function handleDone() {
    setResult(null);
    setUyu("");
    setUsd("");
    setNotes("");
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={result ? handleDone : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{result ? "Resumen de cierre" : "Cerrar caja"}</DialogTitle>
      <DialogContent>
        {!result ? (
          <>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Contá el efectivo de cada cajón.
            </Typography>
            <TextField
              label="Contado UYU ($)"
              fullWidth
              margin="normal"
              value={uyu}
              onChange={(e) => setUyu(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
            />
            <TextField
              label="Contado USD (U$S)"
              fullWidth
              margin="normal"
              value={usd}
              onChange={(e) => setUsd(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
            />
            <TextField
              label="Notas (opcional)"
              fullWidth
              margin="normal"
              multiline
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        ) : (
          <Box>
            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">UYU</TableCell>
                  <TableCell align="right">USD</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Esperado</TableCell>
                  <TableCell align="right">
                    {formatMoney(result.expected_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(result.expected_usd, "USD")}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Contado</TableCell>
                  <TableCell align="right">
                    {formatMoney(result.counted_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(result.counted_usd, "USD")}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Diferencia</TableCell>
                  <TableCell align="right">
                    {formatMoney(result.difference_uyu, "UYU")}
                  </TableCell>
                  <TableCell align="right">
                    {formatMoney(result.difference_usd, "USD")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography variant="subtitle2" gutterBottom>
              Desglose por medio
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Medio</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(result.by_method ?? {}).map(([k, total]) => (
                  <TableRow key={k}>
                    <TableCell>{labelOfMethodKey(k)}</TableCell>
                    <TableCell align="right">
                      {formatMoney(total, currencyOfMethodKey(k))}
                    </TableCell>
                  </TableRow>
                ))}
                {Object.keys(result.by_method ?? {}).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>Sin movimientos de pago</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleClose}
              disabled={busy}
            >
              Cerrar caja
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleDone}>
            Listo
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
