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
import { customerDocErrorMessage } from "./customerStatement";
import { rpcErrorMessage } from "./rpcError";
import { centsToInput, parseMoneyToCents } from "./saleMath";
import { useAdminToast } from "./toast";

const EMPTY = {
  name: "",
  docType: "",
  docNumber: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  creditLimit: "",
  creditLimitCurrency: "USD",
};

function emptyToNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

export default function CustomerDialog({ open, customer, onClose, onSaved }) {
  const { organizationId, isManager } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!customer) {
      setForm(EMPTY);
      return;
    }
    const limitCents =
      customer.credit_limit == null
        ? null
        : parseMoneyToCents(customer.credit_limit);
    setForm({
      name: customer.name ?? "",
      docType: customer.doc_type ?? "",
      docNumber: customer.doc_number ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      creditLimit: limitCents == null ? "" : centsToInput(limitCents),
      creditLimitCurrency:
        customer.credit_limit_currency === "UYU" ? "UYU" : "USD",
    });
  }, [open, customer]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const name = form.name.trim();
    if (!name) {
      showError("El nombre es obligatorio");
      return;
    }

    const docType = emptyToNull(form.docType);
    const docNumber = emptyToNull(form.docNumber);
    if ((docType == null) !== (docNumber == null)) {
      showError("Documento: completá tipo y número, o dejá ambos vacíos");
      return;
    }

    const payload = {
      name,
      doc_type: docType,
      doc_number: docNumber,
      phone: emptyToNull(form.phone),
      email: emptyToNull(form.email),
      address: emptyToNull(form.address),
      notes: emptyToNull(form.notes),
    };

    if (isManager) {
      const limitText = form.creditLimit.trim();
      if (!limitText) {
        payload.credit_limit = null;
      } else {
        const cents = parseMoneyToCents(limitText);
        if (cents == null) {
          showError("Límite de crédito inválido");
          return;
        }
        payload.credit_limit = centsToInput(cents);
      }
      payload.credit_limit_currency = form.creditLimitCurrency;
    }

    setBusy(true);
    const query = customer
      ? supabase.from("admin_customers").update(payload).eq("id", customer.id)
      : supabase
          .from("admin_customers")
          .insert({ ...payload, organization_id: organizationId })
          .select(
            "id, name, doc_type, doc_number, phone, email, address, notes, credit_limit, credit_limit_currency, active",
          )
          .single();
    const { data, error } = await query;
    setBusy(false);
    if (error) {
      showError(customerDocErrorMessage(error) ?? rpcErrorMessage(error));
      return;
    }
    showSuccess(customer ? "Cliente actualizado" : "Cliente creado");
    const saved = customer
      ? { ...customer, ...payload }
      : data;
    onSaved?.(saved);
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
      <DialogContent>
        <TextField
          label="Nombre"
          fullWidth
          margin="normal"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          autoFocus
        />
        <TextField
          select
          label="Tipo de documento"
          fullWidth
          margin="normal"
          value={form.docType}
          onChange={(e) => setField("docType", e.target.value)}
        >
          <MenuItem value="">Sin documento</MenuItem>
          <MenuItem value="CI">CI</MenuItem>
          <MenuItem value="RUT">RUT</MenuItem>
          <MenuItem value="OTRO">OTRO</MenuItem>
        </TextField>
        <TextField
          label="Nº documento"
          fullWidth
          margin="normal"
          value={form.docNumber}
          onChange={(e) => setField("docNumber", e.target.value)}
        />
        <TextField
          label="Teléfono"
          fullWidth
          margin="normal"
          value={form.phone}
          onChange={(e) => setField("phone", e.target.value)}
        />
        <TextField
          label="Email"
          fullWidth
          margin="normal"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
        />
        <TextField
          label="Dirección"
          fullWidth
          margin="normal"
          value={form.address}
          onChange={(e) => setField("address", e.target.value)}
        />
        <TextField
          label="Notas"
          fullWidth
          margin="normal"
          multiline
          minRows={2}
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
        />
        <TextField
          label="Límite de crédito"
          fullWidth
          margin="normal"
          value={form.creditLimit}
          onChange={(e) => setField("creditLimit", e.target.value)}
          disabled={!isManager}
          helperText={
            isManager
              ? "Vacío = sin límite"
              : "Solo dueño o admin pueden editarlo"
          }
          inputProps={{ inputMode: "decimal" }}
        />
        <TextField
          select
          label="Moneda del límite"
          fullWidth
          margin="normal"
          value={form.creditLimitCurrency}
          onChange={(e) => setField("creditLimitCurrency", e.target.value)}
          disabled={!isManager}
        >
          <MenuItem value="UYU">$ (UYU)</MenuItem>
          <MenuItem value="USD">U$S (USD)</MenuItem>
        </TextField>
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
