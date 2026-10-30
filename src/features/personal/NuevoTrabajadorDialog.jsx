import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
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

export default function NuevoTrabajadorDialog({
  open,
  onClose,
  obraId,
  equipos,
  onCreated,
  onOpenEmpresas = null,
  empresasTick = 0,
}) {
  const { can, mi_rol } = useObra();
  const controlTotal = controlTotalEnObra(mi_rol);
  const canHab = can("habilitacion.manage");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [equipoId, setEquipoId] = useState("");
  const [empresas, setEmpresas] = useState([]);
  const [maquinaTipos, setMaquinaTipos] = useState([]);
  const [habIds, setHabIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !obraId) return;
    setFullName("");
    setPhone("");
    setEmpresaId("");
    setEquipoId("");
    setHabIds([]);
    setError(null);
  }, [open, obraId]);

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

      if (canHab) {
        const { data: tipos, error: tErr } = await supabase
          .from("maquina_tipos")
          .select("id, nombre")
          .order("nombre");
        if (tErr) setError((prev) => prev ?? tErr.message);
        else setMaquinaTipos(tipos ?? []);
      } else {
        setMaquinaTipos([]);
      }
    })();
  }, [open, obraId, canHab, empresasTick]);

  function toggleHab(id) {
    setHabIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setError(null);
    if (!fullName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!empresaId) {
      setError("Elegí una empresa");
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create_worker",
          obra_id: obraId,
          empresa_id: empresaId,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
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

      const userId = data.user_id;
      const workerCode = data.worker_code;
      const pin = data.pin;

      if (equipoId) {
        const { error: eqErr } = await supabase.rpc("asignar_equipo", {
          p_obra: obraId,
          p_user: userId,
          p_equipo: equipoId,
        });
        if (eqErr) throw new Error(eqErr.message);
      }

      if (habIds.length > 0) {
        const rows = habIds.map((maquina_tipo_id) => ({
          user_id: userId,
          maquina_tipo_id,
        }));
        const { error: hErr } = await supabase.from("habilitaciones").insert(rows);
        if (hErr) throw new Error(hErr.message);
      }

      onCreated({
        userId,
        fullName: fullName.trim(),
        workerCode,
        pin,
      });
      onClose();
    } catch (e) {
      setError(e.message || "No se pudo crear el trabajador");
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
        Nuevo trabajador
      </DialogTitle>
      <DialogContent
        sx={{
          // MUI pone pt:0 al DialogContent tras el título y corta el label outlined
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
          label="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          fullWidth
          sx={fieldSx}
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
          <InputLabel>Equipo (opcional)</InputLabel>
          <Select
            label="Equipo (opcional)"
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            MenuProps={selectMenuProps}
          >
            <MenuItem value="">Sin equipo</MenuItem>
            {equipos.map((eq) => (
              <MenuItem key={eq.id} value={eq.id}>
                {eq.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {maquinaTipos.length > 0 && (
          <Box>
            <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 0.5 }}>
              Habilitaciones
            </Typography>
            <FormGroup row>
              {maquinaTipos.map((t) => (
                <FormControlLabel
                  key={t.id}
                  control={
                    <Checkbox
                      checked={habIds.includes(t.id)}
                      onChange={() => toggleHab(t.id)}
                      sx={{
                        color: C.line,
                        "&.Mui-checked": { color: C.accent },
                      }}
                    />
                  }
                  label={t.nombre}
                  sx={{ color: C.text }}
                />
              ))}
            </FormGroup>
          </Box>
        )}
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
          disabled={busy || empresas.length === 0}
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
