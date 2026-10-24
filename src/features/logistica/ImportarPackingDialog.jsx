import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  PLANTILLA_CSV,
} from "./estados";
import { parsePackingFile } from "./packingList";
import { useCatalogo } from "./useCatalogo";

function descargarPlantilla() {
  const blob = new Blob([PLANTILLA_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-packing-list.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   obraId: string,
 *   onImported: (result: { id: string, codigo: string, partial?: boolean }) => void,
 * }} props
 */
export default function ImportarPackingDialog({ open, onClose, obraId, onImported }) {
  const fileRef = useRef(null);
  const { catalogo, loading: catLoading, error: catError } = useCatalogo(
    open ? obraId : null,
  );
  const conCatalogo = catalogo.length > 0;

  const [step, setStep] = useState(1);
  const [codigoIso, setCodigoIso] = useState("");
  const [bl, setBl] = useState("");
  const [precinto, setPrecinto] = useState("");
  const [plantaId, setPlantaId] = useState("");
  const [llegada, setLlegada] = useState("");
  const [plantas, setPlantas] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [parseBusy, setParseBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCodigoIso("");
    setBl("");
    setPrecinto("");
    setPlantaId("");
    setLlegada("");
    setFileName("");
    setParsed(null);
    setBusy(false);
    setError(null);
    setParseBusy(false);
    if (fileRef.current) fileRef.current.value = "";

    (async () => {
      const { data, error: err } = await supabase
        .from("plantas")
        .select("id, nombre")
        .order("nombre");
      if (err) setError(err.message);
      else setPlantas(data ?? []);
    })();
  }, [open]);

  useEffect(() => {
    if (catError) setError(catError);
  }, [catError]);

  // Re-parsear cuando llega el catálogo y ya hay archivo.
  useEffect(() => {
    if (!open || catLoading || !fileRef.current?.files?.[0]) return;
    const file = fileRef.current.files[0];
    let cancel = false;
    setParseBusy(true);
    parsePackingFile(file, { catalogo })
      .then((result) => {
        if (!cancel) setParsed(result);
      })
      .catch((err) => {
        if (!cancel) {
          setParsed({
            rows: [],
            errors: [err?.message || "No se pudo leer el archivo"],
            resumen: conCatalogo
              ? { total: 0, porCodigo: [] }
              : { total: 0, ventana: 0, panel: 0 },
            ok: false,
          });
        }
      })
      .finally(() => {
        if (!cancel) setParseBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, catLoading, catalogo, conCatalogo]);

  const isoOk = ISO_RE.test(codigoIso);
  // Vista previa aunque haya códigos desconocidos (se ven en rojo); Importar exige ok.
  const canPreview =
    isoOk &&
    parsed &&
    parsed.rows.length > 0 &&
    !parseBusy &&
    !catLoading &&
    Boolean(fileName);
  const puedeImportar = Boolean(parsed?.ok) && !busy;

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    setError(null);
    setParsed(null);
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    setParseBusy(true);
    try {
      const result = await parsePackingFile(file, { catalogo });
      setParsed(result);
    } catch (err) {
      setParsed({
        rows: [],
        errors: [err?.message || "No se pudo leer el archivo"],
        resumen: conCatalogo
          ? { total: 0, porCodigo: [] }
          : { total: 0, ventana: 0, panel: 0 },
        ok: false,
      });
    } finally {
      setParseBusy(false);
    }
  }

  async function confirmar() {
    if (!obraId || !parsed?.ok) return;
    setBusy(true);
    setError(null);

    const p_data = {
      codigo_iso: codigoIso,
      modulos: conCatalogo
        ? parsed.rows.map((r) => ({
            codigo_tipo: r.codigo_tipo,
            pieza: r.pieza,
            referencia: r.referencia,
          }))
        : parsed.rows.map((r) => ({
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
      setError("La importación no devolvió el id del contenedor");
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

  const resumen = parsed?.resumen;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
        Importar packing list
        {step === 2 ? " · Vista previa" : ""}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
            {error}
          </Typography>
        )}

        {step === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
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
              <InputLabel id="planta-imp-label">Planta</InputLabel>
              <Select
                labelId="planta-imp-label"
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

            <Box>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 1 }}>
                Packing list (.csv o .xlsx)
                {conCatalogo
                  ? " · columnas referencia y código (pieza opcional)"
                  : " · columnas referencia y tipo"}
              </Typography>
              <Button
                variant="outlined"
                component="label"
                disabled={catLoading}
                sx={{ borderRadius: 0, textTransform: "none", mr: 2 }}
              >
                Elegir archivo
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={onFileChange}
                />
              </Button>
              {!conCatalogo && (
                <Link
                  component="button"
                  type="button"
                  onClick={descargarPlantilla}
                  sx={{ color: C.accent, fontSize: "0.875rem", verticalAlign: "middle" }}
                >
                  Descargar plantilla
                </Link>
              )}
              {fileName && (
                <Typography sx={{ color: C.text, fontSize: "0.875rem", mt: 1 }}>
                  {fileName}
                  {parseBusy || catLoading ? " · leyendo…" : ""}
                </Typography>
              )}
              {parsed && !parsed.ok && (
                <Box sx={{ mt: 1 }}>
                  {parsed.errors.map((msg) => (
                    <Typography
                      key={msg}
                      sx={{ color: C.danger, fontSize: "0.8rem" }}
                    >
                      {msg}
                    </Typography>
                  ))}
                </Box>
              )}
              {parsed?.ok && (
                <Typography sx={{ color: C.muted, fontSize: "0.875rem", mt: 1 }}>
                  {parsed.resumen.total} módulos listos para vista previa
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {step === 2 && parsed && (
          <Box sx={{ pt: 1 }}>
            <Typography sx={{ color: C.text, mb: 2 }}>
              {resumen.total} módulos
              {!conCatalogo && resumen.ventana
                ? ` · ${resumen.ventana} ${MODULO_TIPO_PLURAL.ventana}`
                : ""}
              {!conCatalogo && resumen.panel
                ? ` · ${resumen.panel} ${MODULO_TIPO_PLURAL.panel}`
                : ""}
              {conCatalogo && resumen.porCodigo?.length
                ? ` · ${resumen.porCodigo.map((c) => `${c.n}× ${c.codigo_tipo}`).join(" · ")}`
                : ""}
              {" · "}
              ISO {codigoIso}
            </Typography>

            {conCatalogo && resumen.porCodigo?.length > 0 && (
              <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {resumen.porCodigo.map((c) => (
                  <Box
                    key={`${c.codigo_tipo}|${c.pieza}`}
                    sx={{
                      border: 1,
                      borderColor: C.line,
                      px: 1.25,
                      py: 0.5,
                      fontSize: "0.8rem",
                    }}
                  >
                    {c.n}× {c.codigo_tipo}
                    {c.pieza === "complemento" ? " (complemento)" : ""}
                  </Box>
                ))}
              </Box>
            )}

            {!parsed.ok && (
              <Box sx={{ mb: 2 }}>
                {parsed.errors.map((msg) => (
                  <Typography
                    key={msg}
                    sx={{ color: C.danger, fontSize: "0.8rem" }}
                  >
                    {msg}
                  </Typography>
                ))}
              </Box>
            )}

            <Box
              sx={{
                maxHeight: 360,
                overflow: "auto",
                border: 1,
                borderColor: C.line,
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: conCatalogo
                    ? "1fr 120px 100px 1fr"
                    : "1fr 100px 1fr",
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
                <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                  Referencia
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                  {conCatalogo ? "Código" : "Tipo"}
                </Typography>
                {conCatalogo && (
                  <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                    Pieza
                  </Typography>
                )}
                <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                  Error
                </Typography>
              </Box>
              {parsed.rows.map((row, i) => (
                <Box
                  key={`${row.referencia}-${i}`}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: conCatalogo
                      ? "1fr 120px 100px 1fr"
                      : "1fr 100px 1fr",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderBottom: 1,
                    borderColor: C.line,
                    color: row.error || row.desconocido ? C.danger : C.text,
                  }}
                >
                  <Typography sx={{ fontSize: "0.875rem" }}>
                    {row.referencia || "—"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem" }}>
                    {conCatalogo
                      ? row.codigo_tipo || "—"
                      : (MODULO_TIPO_LABEL[row.tipo] ?? row.tipo ?? "—")}
                  </Typography>
                  {conCatalogo && (
                    <Typography sx={{ fontSize: "0.875rem" }}>
                      {row.pieza || "principal"}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: "0.8rem" }}>
                    {row.error || ""}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 3, py: 2 }}>
        {step === 1 ? (
          <>
            <Button onClick={onClose} disabled={busy} sx={{ color: C.muted }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={!canPreview}
              onClick={() => setStep(2)}
              sx={{ borderRadius: 0 }}
            >
              Vista previa
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setStep(1)}
              disabled={busy}
              sx={{ color: C.muted }}
            >
              Atrás
            </Button>
            <Button
              variant="contained"
              disabled={!puedeImportar}
              onClick={confirmar}
              sx={{ borderRadius: 0 }}
            >
              {busy ? "Importando…" : "Confirmar"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
