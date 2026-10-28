import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../../lib/supabase";
import { useAdminOrg } from "../AdminOrgProvider";
import { fraseVistaPrevia } from "./frases";

function todayIso() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TITULOS = {
  compra: {
    factura: "Nos facturó",
    nota_credito: "Nos hizo una nota de crédito",
    pago: "Le pagamos",
  },
  venta: {
    factura: "Le facturamos",
    nota_credito: "Le hicimos una nota de crédito",
    pago: "Nos pagó",
  },
};

function dateInput(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

export default function MovimientoDialog({
  open,
  onClose,
  onSaved,
  contraparteId,
  lado,
  tipo,
  saldoUyu,
  saldoUsd,
  movimiento = null,
}) {
  const { organizationId } = useAdminOrg();
  const editing = Boolean(movimiento?.id);
  const ladoEff = movimiento?.lado ?? lado;
  const tipoEff = movimiento?.tipo ?? tipo;

  const [moneda, setMoneda] = useState("USD");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [vencimiento, setVencimiento] = useState("");
  const [numero, setNumero] = useState("");
  const [concepto, setConcepto] = useState("");
  const [medio, setMedio] = useState("");
  const [obraId, setObraId] = useState("");
  const [obras, setObras] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (movimiento) {
      setMoneda(movimiento.moneda === "UYU" ? "UYU" : "USD");
      setImporte(String(movimiento.importe ?? ""));
      setFecha(dateInput(movimiento.fecha) || todayIso());
      setVencimiento(dateInput(movimiento.vencimiento));
      setNumero(movimiento.numero ?? "");
      setConcepto(movimiento.concepto ?? "");
      setMedio(movimiento.medio ?? "");
      setObraId(movimiento.obra_id ?? "");
      return;
    }
    setMoneda("USD");
    setImporte("");
    setFecha(todayIso());
    setVencimiento("");
    setNumero("");
    setConcepto("");
    setMedio("");
    setObraId("");
  }, [open, lado, tipo, movimiento]);

  useEffect(() => {
    if (!open || !organizationId) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.rpc("admin_cc_obras", {
        p_organization_id: organizationId,
      });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setObras([]);
        return;
      }
      setObras(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  const saldoActual = moneda === "USD" ? saldoUsd : saldoUyu;
  const preview = useMemo(() => {
    const n = Number(String(importe).replace(",", "."));
    return fraseVistaPrevia(
      saldoActual,
      ladoEff,
      tipoEff,
      n,
      moneda,
      editing ? movimiento : null,
    );
  }, [saldoActual, ladoEff, tipoEff, importe, moneda, editing, movimiento]);

  const tituloBase = TITULOS[ladoEff]?.[tipoEff] ?? "Movimiento";
  const titulo = editing ? `Editar · ${tituloBase}` : tituloBase;

  async function save() {
    const n = Number(String(importe).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("El importe tiene que ser mayor que cero");
      return;
    }
    if (tipoEff === "pago" && !medio) {
      setError("Indicá el medio de pago");
      return;
    }
    setBusy(true);
    setError(null);

    const payload = {
      p_moneda: moneda,
      p_importe: n,
      p_fecha: fecha || todayIso(),
      p_vencimiento: tipoEff === "factura" && vencimiento ? vencimiento : null,
      p_numero: numero.trim() || null,
      p_concepto: concepto.trim() || null,
      p_medio: tipoEff === "pago" ? medio : null,
      p_obra_id: obraId || null,
    };

    const { error: err } = editing
      ? await supabase.rpc("admin_cc_editar", {
          p_movimiento_id: movimiento.id,
          ...payload,
        })
      : await supabase.rpc("admin_cc_registrar", {
          p_contraparte_id: contraparteId,
          p_lado: ladoEff,
          p_tipo: tipoEff,
          ...payload,
        });

    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            fullWidth
          >
            <MenuItem value="USD">US$</MenuItem>
            <MenuItem value="UYU">$</MenuItem>
          </TextField>
          <TextField
            label="Importe"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            fullWidth
            required
            inputProps={{ inputMode: "decimal" }}
            autoFocus
          />
          {preview && (
            <Typography variant="body2" color="text.secondary">
              {preview}
            </Typography>
          )}
          <TextField
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          {tipoEff === "factura" && (
            <TextField
              label="Vencimiento"
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
          {tipoEff === "pago" && (
            <TextField
              select
              label="Medio"
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="transferencia">Transferencia</MenuItem>
              <MenuItem value="efectivo">Efectivo</MenuItem>
              <MenuItem value="cheque">Cheque</MenuItem>
              <MenuItem value="otro">Otro</MenuItem>
            </TextField>
          )}
          <TextField
            label="Número de comprobante"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            fullWidth
          />
          <TextField
            label="Concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            fullWidth
          />
          {obras.length > 0 && (
            <TextField
              select
              label="Obra"
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">Sin obra</MenuItem>
              {obras.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.nombre}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
