import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from "@mui/material";
import { supabase } from "../../../lib/supabase";
import { useAdminOrg } from "../AdminOrgProvider";

const EMPTY = {
  nombre: "",
  es_proveedor: false,
  es_cliente: false,
  rut: "",
  contacto: "",
  notas: "",
};

export default function ContraparteDialog({ open, contraparte, onClose, onSaved }) {
  const { organizationId } = useAdminOrg();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!contraparte) {
      setForm(EMPTY);
      return;
    }
    setForm({
      nombre: contraparte.nombre ?? "",
      es_proveedor: Boolean(contraparte.es_proveedor),
      es_cliente: Boolean(contraparte.es_cliente),
      rut: contraparte.rut ?? "",
      contacto: contraparte.contacto ?? "",
      notas: contraparte.notas ?? "",
    });
  }, [open, contraparte]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!form.es_proveedor && !form.es_cliente) {
      setError("Marcá si es proveedor, cliente o ambos");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_cc_guardar_contraparte", {
      p_organization_id: organizationId,
      p_nombre: nombre,
      p_es_proveedor: form.es_proveedor,
      p_es_cliente: form.es_cliente,
      p_rut: form.rut.trim() || null,
      p_contacto: form.contacto.trim() || null,
      p_notas: form.notas.trim() || null,
      p_id: contraparte?.contraparte_id ?? contraparte?.id ?? null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved?.(data);
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{contraparte ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setField("nombre", e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.es_proveedor}
                  onChange={(e) => setField("es_proveedor", e.target.checked)}
                />
              }
              label="Es proveedor"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.es_cliente}
                  onChange={(e) => setField("es_cliente", e.target.checked)}
                />
              }
              label="Es cliente"
            />
          </Stack>
          <TextField
            label="RUT"
            value={form.rut}
            onChange={(e) => setField("rut", e.target.value)}
            fullWidth
          />
          <TextField
            label="Contacto"
            value={form.contacto}
            onChange={(e) => setField("contacto", e.target.value)}
            fullWidth
          />
          <TextField
            label="Notas"
            value={form.notas}
            onChange={(e) => setField("notas", e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
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
