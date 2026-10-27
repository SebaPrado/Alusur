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
import { rpcErrorMessage } from "./rpcError";
import { centsToInput, parseMoneyToCents } from "./saleMath";
import { useAdminToast } from "./toast";

const IVA = ["22", "10", "0"];

function ivaValue(rate) {
  const n = Number(rate);
  if (n === 10) return "10";
  if (n === 0) return "0";
  return "22";
}

const EMPTY = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  unit: "unidad",
  currency: "UYU",
  price: "",
  iva: "22",
};

export default function ProductDialog({ open, product, categories, onClose, onSaved }) {
  const { organizationId } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!product) {
      setForm(EMPTY);
      return;
    }
    const cents = parseMoneyToCents(product.price, product.currency);
    setForm({
      name: product.name ?? "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      categoryId: product.category_id ?? "",
      unit: product.unit ?? "unidad",
      currency: product.currency === "USD" ? "USD" : "UYU",
      price: cents == null ? "" : centsToInput(cents, product.currency),
      iva: ivaValue(product.iva_rate),
    });
  }, [open, product]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const name = form.name.trim();
    const priceCents = parseMoneyToCents(form.price, form.currency);
    if (!name) {
      showError("El nombre es obligatorio");
      return;
    }
    if (priceCents == null) {
      showError("Precio inválido");
      return;
    }
    const payload = {
      category_id: form.categoryId || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      name,
      unit: form.unit.trim() || "unidad",
      currency: form.currency,
      price: centsToInput(priceCents, form.currency),
      iva_rate: Number(form.iva),
    };
    setBusy(true);
    const query = product
      ? supabase.from("admin_products").update(payload).eq("id", product.id)
      : supabase
          .from("admin_products")
          .insert({ ...payload, organization_id: organizationId });
    const { error } = await query;
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess(product ? "Producto actualizado" : "Producto creado");
    onSaved?.();
    onClose?.();
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
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
          label="SKU"
          fullWidth
          margin="normal"
          value={form.sku}
          onChange={(e) => setField("sku", e.target.value)}
        />
        <TextField
          label="Código de barras"
          fullWidth
          margin="normal"
          value={form.barcode}
          onChange={(e) => setField("barcode", e.target.value)}
        />
        <TextField
          select
          label="Categoría"
          fullWidth
          margin="normal"
          value={form.categoryId}
          onChange={(e) => setField("categoryId", e.target.value)}
        >
          <MenuItem value="">Sin categoría</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Unidad"
          fullWidth
          margin="normal"
          value={form.unit}
          onChange={(e) => setField("unit", e.target.value)}
        />
        <TextField
          select
          label="Moneda"
          fullWidth
          margin="normal"
          value={form.currency}
          onChange={(e) => setField("currency", e.target.value)}
        >
          <MenuItem value="UYU">UYU ($)</MenuItem>
          <MenuItem value="USD">USD (U$S)</MenuItem>
        </TextField>
        <TextField
          label="Precio"
          fullWidth
          margin="normal"
          value={form.price}
          onChange={(e) => setField("price", e.target.value)}
          inputProps={{ inputMode: "decimal" }}
        />
        <TextField
          select
          label="IVA"
          fullWidth
          margin="normal"
          value={form.iva}
          onChange={(e) => setField("iva", e.target.value)}
        >
          {IVA.map((n) => (
            <MenuItem key={n} value={n}>
              {n}%
            </MenuItem>
          ))}
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
