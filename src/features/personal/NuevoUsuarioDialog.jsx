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
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "./theme";

const ROLE_LABEL = {
  superadmin: "SuperAdmin",
  admin: "Admin",
  owner: "Owner",
};

export default function NuevoUsuarioDialog({
  open,
  onClose,
  obraId,
  roles = [],
  onCreated,
  onOpenEmpresas = null,
  empresasTick = 0,
}) {
  const { mi_rol } = useObra();
  const controlTotal = controlTotalEnObra(mi_rol);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [role, setRole] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !obraId) return;
    setFullName("");
    setEmail("");
    setEmpresaId("");
    setRole(roles[0] ?? "");
    setError(null);
  }, [open, obraId, roles]);

  useEffect(() => {
    if (!open || !obraId) return;

    (async () => {
      const { data: oe, error: oeErr } = await supabase
        .from("obra_empresas")
        .select("empresa_id")
        .eq("obra_id", obraId);
      if (oeErr) {
        setError(oeErr.message);
        return;
      }
      const ids = [...new Set((oe ?? []).map((r) => r.empresa_id).filter(Boolean))];
      let list = [];
      if (ids.length > 0) {
        const { data: emps, error: empErr } = await supabase
          .from("empresas")
          .select("id, nombre")
          .in("id", ids)
          .order("nombre");
        if (empErr) {
          setError(empErr.message);
          return;
        }
        list = emps ?? [];
      }
      setEmpresas(list);
      if (list.length === 1) setEmpresaId(list[0].id);
      else if (list.length === 0) {
        setEmpresaId("");
        setError(
          "Esta obra no tiene empresas vinculadas. Usá «Empresas de la obra» para pegar ALUSUR o ALUMAN.",
        );
      } else {
        setError(null);
      }
    })();
  }, [open, obraId, empresasTick]);

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
    if (!empresaId) {
      setError("Elegí una empresa");
      return;
    }
    if (!role) {
      setError("Elegí un rol");
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create_user",
          obra_id: obraId,
          empresa_id: empresaId,
          role,
          full_name: fullName.trim(),
          email: email.trim(),
        },
      });
      if (fnErr) {
        let msg = fnErr.message;
        try {
          const body = await fnErr.context?.json?.();
          if (body?.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      onCreated({
        userId: data.user_id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        temporaryPassword: data.temporary_password ?? null,
        existed: Boolean(data.existed),
      });
      onClose();
    } catch (e) {
      setError(e.message || "No se pudo crear el usuario");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle
        sx={{
          color: C.text,
          borderBottom: 1, borderColor: C.line,
          py: 2,
          px: 3,
        }}
      >
        Nuevo usuario
      </DialogTitle>
      <DialogContent
        sx={{
          pt: "28px !important",
          px: 3,
          pb: 1,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          overflow: "visible",
        }}
      >
        {error && (
          <Typography sx={{ color: C.danger, fontSize: "0.875rem", mt: -0.5 }}>
            {error}
          </Typography>
        )}
        <TextField
          label="Nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          fullWidth
          required
          sx={fieldSx}
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          required
          sx={fieldSx}
          autoComplete="off"
        />
        <FormControl fullWidth sx={fieldSx} error={empresas.length === 0}>
          <InputLabel>Empresa</InputLabel>
          <Select
            label="Empresa"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            MenuProps={selectMenuProps}
          >
            {empresas.length === 0 ? (
              <MenuItem value="" disabled>
                Sin empresas en esta obra
              </MenuItem>
            ) : (
              empresas.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.nombre}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
        {empresas.length === 0 && controlTotal && onOpenEmpresas && (
          <Button
            onClick={onOpenEmpresas}
            sx={{
              alignSelf: "flex-start",
              color: C.accent,
              textTransform: "none",
              borderRadius: 0,
              border: 1, borderColor: C.accent,
            }}
          >
            Vincular empresas a la obra
          </Button>
        )}
        <FormControl fullWidth sx={fieldSx}>
          <InputLabel>Rol</InputLabel>
          <Select
            label="Rol"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            MenuProps={selectMenuProps}
          >
            {roles.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: 1, borderColor: C.line,
          px: 3,
          py: 2.5,
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={busy} sx={{ color: C.muted, textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={busy || empresas.length === 0 || roles.length === 0}
          sx={{
            color: C.bg,
            bgcolor: C.accent,
            borderRadius: 0,
            textTransform: "none",
            px: 2.5,
            "&:hover": { bgcolor: C.accent, opacity: 0.9 },
          }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
