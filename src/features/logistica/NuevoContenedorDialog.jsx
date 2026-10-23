import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "../personal/theme";
import {
  ISO_RE,
  MODULO_TIPO_LABEL,
  MODULO_TIPO_PLURAL,
  MODULO_TIPOS,
} from "./estados";
import { generarReferencias, validatePackingRows } from "./packingList";

const emptyRow = () => ({ referencia: "", tipo: "ventana" });

/**
 * Alta manual: número ISO del contenedor + tabla de módulos (código/referencia y tipo).
 * El código interno C-NNNN lo asigna import_contenedor_auto.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   obraId: string,
 *   onImported: (result: { id: string, codigo: string, partial?: boolean }) => void,
 * }} props
 */
export default function NuevoContenedorDialog({
  open,
  onClose,
  obraId,
  onImported,
}) {
  const [codigoIso, setCodigoIso] = useState("");
  const [bl, setBl] = useState("");
  const [precinto, setPrecinto] = useState("");
  const [plantaId, setPlantaId] = useState("");
  const [llegada, setLlegada] = useState("");
  const [plantas, setPlantas] = useState([]);
  const [modulos, setModulos] = useState([emptyRow()]);

  const [prefijo, setPrefijo] = useState("AL-");
  const [desde, setDesde] = useState("1");
  const [cantidad, setCantidad] = useState("25");
  const [digitos, setDigitos] = useState("4");
  const [genTipo, setGenTipo] = useState("ventana");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setCodigoIso("");
    setBl("");
    setPrecinto("");
    setPlantaId("");
    setLlegada("");
    setModulos([emptyRow()]);
    setPrefijo("AL-");
    setDesde("1");
    setCantidad("25");
    setDigitos("4");
    setGenTipo("ventana");
    setBusy(false);
    setError(null);

    (async () => {
      const { data, error: err } = await supabase
        .from("plantas")
        .select("id, nombre")
        .order("nombre");
      if (err) setError(err.message);
      else setPlantas(data ?? []);
    })();
  }, [open]);

  const validated = useMemo(
    () =>
      validatePackingRows(
        modulos.map((m) => ({
          referencia: String(m.referencia ?? "").trim(),
          tipo: String(m.tipo ?? "").trim().toLowerCase(),
        })),
      ),
    [modulos],
  );

  const isoOk = ISO_RE.test(codigoIso);
  const canConfirm = isoOk && validated.ok && !busy;

  function updateRow(i, patch) {
    setModulos((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setModulos((prev) => {
      if (prev.length >= 99) return prev;
      return [...prev, emptyRow()];
    });
  }

  function removeRow(i) {
    setModulos((prev) => {
      if (prev.length <= 1) return [emptyRow()];
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function generar() {
    setError(null);
    const nuevas = generarReferencias({
      prefijo,
      desde: Number(desde),
      cantidad: Number(cantidad),
      digitos: Number(digitos),
      tipo: genTipo,
    });
    if (nuevas.length === 0) {
      setError("Indicá una cantidad mayor a 0.");
      return;
    }
    setModulos((prev) => {
      const soloVacias = prev.every(
        (r) => !String(r.referencia ?? "").trim(),
      );
      const base = soloVacias ? [] : prev;
      const merged = [...base, ...nuevas];
      if (merged.length > 99) {
        setError("No se pueden superar 99 módulos; se truncó la lista.");
        return merged.slice(0, 99);
      }
      return merged;
    });
  }

  async function confirmar() {
    if (!obraId || !canConfirm) return;
    setBusy(true);
    setError(null);

    const p_data = {
      codigo_iso: codigoIso,
      modulos: validated.rows.map((r) => ({
        tipo: r.tipo,
        referencia: r.referencia,
      })),
    };

    const { data: created, error: impErr } = await supabase.rpc(
      "import_contenedor_auto",
      { p_obra: obraId, p_data },
    );

    if (impErr) {
      setBusy(false);
      setError(impErr.message);
      return;
    }

    const id = created?.id;
    const codigo = created?.codigo;
    if (!id) {
      setBusy(false);
      setError("La creación no devolvió el id del contenedor");
      return;
    }

    const { error: updErr } = await supabase.rpc("actualizar_contenedor", {
      p_contenedor: id,
      p_bl: bl.trim() || null,
      p_precinto: precinto.trim() || null,
      p_planta: plantaId || null,
      p_llegada: llegada || null,
      p_codigo_iso: null,
    });

    setBusy(false);

    if (updErr) {
      setError(
        `Contenedor ${codigo} creado, pero no se pudieron guardar BL/planta/llegada: ${updErr.message}`,
      );
      onImported({ id, codigo, partial: true });
      return;
    }

    onClose();
    onImported({ id, codigo });
  }

  const resumen = validated.resumen;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
        Nuevo contenedor
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
            {error}
          </Typography>
        )}

        <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 2 }}>
          El código interno (C-0001) lo asigna el sistema. Acá cargás el número
          ISO y lo que trae adentro (código de ALUMAN + tipo).
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 3,
          }}
        >
          <TextField
            label="Número ISO"
            value={codigoIso}
            onChange={(e) =>
              setCodigoIso(e.target.value.toUpperCase().replace(/\s/g, ""))
            }
            required
            error={codigoIso.length > 0 && !isoOk}
            helperText={
              codigoIso.length > 0 && !isoOk
                ? "4 letras + 7 dígitos (ej. MSCU4321116)"
                : " "
            }
            inputProps={{ maxLength: 11 }}
            sx={fieldSx}
            fullWidth
          />
          <TextField
            label="BL"
            value={bl}
            onChange={(e) => setBl(e.target.value)}
            sx={fieldSx}
            fullWidth
          />
          <TextField
            label="Precinto esperado"
            value={precinto}
            onChange={(e) => setPrecinto(e.target.value)}
            sx={fieldSx}
            fullWidth
          />
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel id="planta-nuevo-label">Planta</InputLabel>
            <Select
              labelId="planta-nuevo-label"
              label="Planta"
              value={plantaId}
              onChange={(e) => setPlantaId(e.target.value)}
              MenuProps={selectMenuProps}
            >
              <MenuItem value="">
                <em>Sin planta</em>
              </MenuItem>
              {plantas.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Llegada estimada"
            type="date"
            value={llegada}
            onChange={(e) => setLlegada(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
            fullWidth
          />
        </Box>

        {/* Generador de códigos */}
        <Typography sx={{ fontWeight: 600, mb: 1 }}>
          Generar códigos
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr 1fr",
              sm: "1.2fr 0.7fr 0.7fr 0.7fr 1fr auto",
            },
            gap: 1.5,
            alignItems: "start",
            mb: 2,
          }}
        >
          <TextField
            label="Prefijo"
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value)}
            placeholder="AL-"
            size="small"
            sx={fieldSx}
          />
          <TextField
            label="Desde"
            type="number"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            size="small"
            inputProps={{ min: 0 }}
            sx={fieldSx}
          />
          <TextField
            label="Cantidad"
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            size="small"
            inputProps={{ min: 1, max: 99 }}
            sx={fieldSx}
          />
          <TextField
            label="Dígitos"
            type="number"
            value={digitos}
            onChange={(e) => setDigitos(e.target.value)}
            size="small"
            inputProps={{ min: 1, max: 8 }}
            sx={fieldSx}
          />
          <FormControl size="small" sx={fieldSx} fullWidth>
            <InputLabel id="gen-tipo-label">Tipo</InputLabel>
            <Select
              labelId="gen-tipo-label"
              label="Tipo"
              value={genTipo}
              onChange={(e) => setGenTipo(e.target.value)}
              MenuProps={selectMenuProps}
            >
              {MODULO_TIPOS.map((t) => (
                <MenuItem key={t} value={t}>
                  {MODULO_TIPO_LABEL[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={generar}
            sx={{ borderRadius: 0, textTransform: "none", height: 40 }}
          >
            Generar
          </Button>
        </Box>
        <Typography sx={{ color: C.muted, fontSize: "0.75rem", mb: 2 }}>
          Ej.: prefijo AL-, desde 1, 25 módulos, 4 dígitos → AL-0001 … AL-0025.
          Si la tabla ya tiene filas, se agregan al final.
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            Módulos ({modulos.length})
            {validated.ok && resumen.total > 0
              ? ` · ${resumen.ventana} ${MODULO_TIPO_PLURAL.ventana} · ${resumen.panel} ${MODULO_TIPO_PLURAL.panel}`
              : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Link
              component="button"
              type="button"
              onClick={() => setModulos([emptyRow()])}
              sx={{ color: C.muted, fontSize: "0.8rem" }}
            >
              Vaciar
            </Link>
            <Link
              component="button"
              type="button"
              onClick={addRow}
              sx={{ color: C.accent, fontSize: "0.8rem" }}
            >
              + Agregar fila
            </Link>
          </Box>
        </Box>

        {!validated.ok && validated.errors.length > 0 && (
          <Box sx={{ mb: 1 }}>
            {validated.errors.slice(0, 5).map((msg) => (
              <Typography
                key={msg}
                sx={{ color: C.danger, fontSize: "0.8rem" }}
              >
                {msg}
              </Typography>
            ))}
            {validated.errors.length > 5 && (
              <Typography sx={{ color: C.danger, fontSize: "0.8rem" }}>
                … y {validated.errors.length - 5} más
              </Typography>
            )}
          </Box>
        )}

        <Box
          sx={{
            maxHeight: 320,
            overflow: "auto",
            border: 1,
            borderColor: C.line,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 140px 40px",
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: C.line,
              position: "sticky",
              top: 0,
              bgcolor: C.bg,
            }}
          >
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>#</Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Código (referencia)
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Tipo
            </Typography>
            <span />
          </Box>
          {modulos.map((row, i) => {
            const err = validated.rows[i]?.error;
            return (
              <Box
                key={i}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 140px 40px",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: C.line,
                  alignItems: "center",
                }}
              >
                <Typography sx={{ color: C.muted, fontSize: "0.8rem" }}>
                  {i + 1}
                </Typography>
                <TextField
                  size="small"
                  value={row.referencia}
                  onChange={(e) =>
                    updateRow(i, { referencia: e.target.value })
                  }
                  error={Boolean(err)}
                  placeholder="AL-0001"
                  sx={fieldSx}
                  fullWidth
                />
                <FormControl size="small" sx={fieldSx} fullWidth>
                  <Select
                    value={row.tipo || "ventana"}
                    onChange={(e) => updateRow(i, { tipo: e.target.value })}
                    MenuProps={selectMenuProps}
                  >
                    {MODULO_TIPOS.map((t) => (
                      <MenuItem key={t} value={t}>
                        {MODULO_TIPO_LABEL[t]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  size="small"
                  aria-label="Quitar fila"
                  onClick={() => removeRow(i)}
                  sx={{ color: C.muted, borderRadius: 0 }}
                >
                  ×
                </IconButton>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: C.muted }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={!canConfirm}
          onClick={confirmar}
          sx={{ borderRadius: 0 }}
        >
          {busy ? "Creando…" : "Crear contenedor"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
