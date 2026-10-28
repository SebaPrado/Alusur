import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";

const ROLE_OPTIONS = [
  { value: "dueno", label: "Dueño" },
  { value: "admin", label: "Admin" },
  { value: "vendedor", label: "Vendedor" },
];

async function functionErrorMessage(fnErr, data) {
  if (data?.error) return String(data.error);
  if (!fnErr) return null;
  try {
    const body = await fnErr.context?.json?.();
    if (body?.error) return String(body.error);
  } catch {
    /* ignore */
  }
  try {
    const text = await fnErr.context?.text?.();
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed?.error) return String(parsed.error);
    }
  } catch {
    /* ignore */
  }
  return fnErr.message || "No se pudo crear el miembro";
}

export default function NuevoMiembroDialog({ open, onClose, onCreated }) {
  const { organizationId } = useAdminOrg();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("vendedor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setEmail("");
    setRole("vendedor");
    setError(null);
    setBusy(false);
  }, [open]);

  async function handleSave() {
    setError(null);
    if (!fullName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!email.trim()) {
      setError("El email es obligatorio");
      return;
    }
    if (!organizationId) {
      setError("No hay organización seleccionada");
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "admin-users",
        {
          body: {
            action: "create_admin_member",
            organization_id: organizationId,
            full_name: fullName.trim(),
            email: email.trim(),
            role,
          },
        },
      );
      const errMsg = await functionErrorMessage(fnErr, data);
      if (errMsg) throw new Error(errMsg);

      onCreated({
        userId: data.user_id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        temporaryPassword: data.temporary_password ?? null,
        existed: Boolean(data.existed),
      });
      onClose();
    } catch (e) {
      setError(e.message || "No se pudo crear el miembro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nuevo miembro</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <TextField
          label="Nombre"
          size="small"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus
          fullWidth
        />
        <TextField
          label="Email"
          size="small"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Rol</InputLabel>
          <Select
            label="Rol"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={busy}>
          {busy ? "Guardando…" : "Crear"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
