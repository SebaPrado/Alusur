import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { clasificarLineas, parsePackingAluman } from "../../lib/packingAluman";
import { C, dialogPaperSx } from "../personal/theme";
import { useCatalogo } from "./useCatalogo";

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   obraId: string,
 *   onImported: (result: object) => void,
 * }} props
 */
export default function ImportarEnvioDialog({ open, onClose, obraId, onImported }) {
  const fileRef = useRef(null);
  const { catalogo, loading: catLoading, error: catError } = useCatalogo(
    open ? obraId : null,
  );

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [obraAluman, setObraAluman] = useState(null);
  const [clasif, setClasif] = useState(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [okAvisos, setOkAvisos] = useState([]);

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setParsed(null);
    setObraAluman(null);
    setClasif(null);
    setParseBusy(false);
    setBusy(false);
    setError(null);
    setOkMsg(null);
    setOkAvisos([]);
    if (fileRef.current) fileRef.current.value = "";
  }, [open]);

  useEffect(() => {
    if (catError) setError(catError);
  }, [catError]);

  async function clasificarConBase(data) {
    if (!obraId || !data) {
      setClasif(null);
      return;
    }
    const { data: mapeos, error: err } = await supabase
      .from("referencias_proveedor")
      .select("referencia_norm, tipo_modulo_id")
      .eq("obra_id", obraId);
    if (err) {
      setError(err.message);
      setClasif(clasificarLineas(data, [], catalogo));
      return;
    }
    setClasif(clasificarLineas(data, mapeos ?? [], catalogo));
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setOkMsg(null);
    setOkAvisos([]);
    setParseBusy(true);
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheet = await readXlsxFile(file);
      const result = parsePackingAluman(sheet ?? [], file.name);
      setParsed(result);
      setObraAluman(result.obraAluman);
      if (result.data) await clasificarConBase(result.data);
      else setClasif(null);
    } catch (err) {
      setParsed({
        data: null,
        errores: [err?.message || "No se pudo leer el archivo"],
        avisos: [],
      });
      setClasif(null);
    } finally {
      setParseBusy(false);
    }
  }

  // Re-clasificar cuando llega el catálogo.
  useEffect(() => {
    if (!open || catLoading || !parsed?.data) return;
    clasificarConBase(parsed.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, catLoading, open]);

  async function confirmar() {
    if (!obraId || !parsed?.data || parsed.errores?.length) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    setOkAvisos([]);

    const { data: created, error: impErr } = await supabase.rpc("import_envio", {
      p_obra: obraId,
      p_data: parsed.data,
    });

    setBusy(false);

    if (impErr) {
      setError(impErr.message);
      return;
    }

    const n = created?.numero_envio ?? parsed.data.numero_envio;
    const cont = created?.contenedor_codigo ?? "—";
    const bultos = created?.bultos ?? parsed.data.bultos?.length ?? 0;
    const modulos = created?.modulos ?? clasif?.totalModulos ?? 0;
    const material =
      created?.lineas_material ?? clasif?.lineasMaterial ?? 0;
    setOkMsg(
      `Envío ${n} importado: contenedor ${cont}, ${bultos} bultos, ${modulos} módulos, ${material} líneas de material`,
    );
    setOkAvisos(Array.isArray(created?.avisos) ? created.avisos : []);
    onImported(created ?? {});
  }

  const data = parsed?.data;
  const errores = parsed?.errores ?? [];
  const avisos = parsed?.avisos ?? [];
  const pesoDetalle = (data?.bultos ?? []).reduce(
    (a, b) => a + (typeof b.peso_bruto_kg === "number" ? b.peso_bruto_kg : 0),
    0,
  );
  const bultosDetalle = data?.bultos?.length ?? 0;
  const bultosDiff =
    data?.bultos_declarados != null &&
    data.bultos_declarados !== bultosDetalle;
  const pesoDiff =
    data?.peso_declarado_kg != null &&
    Math.abs(data.peso_declarado_kg - pesoDetalle) > 1;
  const canImport = Boolean(data) && errores.length === 0 && !busy && !parseBusy;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
        Importar packing de ALUMAN
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
            {error}
          </Typography>
        )}

        {okMsg && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: C.accent, fontSize: "0.9rem" }}>
              {okMsg}
            </Typography>
            {okAvisos.map((a) => (
              <Typography
                key={a}
                sx={{ color: "warning.main", fontSize: "0.8rem", mt: 0.5 }}
              >
                {a}
              </Typography>
            ))}
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 1 }}>
            Packing list ALUMAN (.xlsx)
          </Typography>
          <Button
            variant="outlined"
            component="label"
            disabled={busy || catLoading}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            Elegir archivo
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFileChange}
            />
          </Button>
          {fileName && (
            <Typography
              component="span"
              sx={{ ml: 2, color: C.muted, fontSize: "0.875rem" }}
            >
              {fileName}
              {parseBusy ? " · leyendo…" : ""}
            </Typography>
          )}
        </Box>

        {data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography
              sx={{
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              {obraAluman || "—"}
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
              Envío {data.numero_envio}
              {data.fecha_carga ? ` · ${data.fecha_carga}` : ""}
              {data.archivo_origen ? ` · ${data.archivo_origen}` : ""}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: bultosDiff ? "warning.main" : C.text,
                }}
              >
                Bultos: {bultosDetalle} / {data.bultos_declarados ?? "—"}
                {bultosDiff ? " · no cierra" : ""}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  color: pesoDiff ? "warning.main" : C.text,
                }}
              >
                Peso: {pesoDetalle} / {data.peso_declarado_kg ?? "—"} kg
                {pesoDiff ? " · no cierra" : ""}
              </Typography>
            </Box>

            {avisos.map((a) => (
              <Typography
                key={a}
                sx={{ color: "warning.main", fontSize: "0.8rem" }}
              >
                {a}
              </Typography>
            ))}

            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", mb: 0.5 }}>
                Resumen
              </Typography>
              {clasif?.porCodigo?.length ? (
                clasif.porCodigo.map((m) => (
                  <Typography
                    key={m.codigo}
                    sx={{ fontSize: "0.85rem", fontFamily: "monospace" }}
                  >
                    {m.codigo}: {m.cantidad}
                  </Typography>
                ))
              ) : (
                <Typography sx={{ fontSize: "0.85rem", color: C.muted }}>
                  0 módulos reconocidos
                </Typography>
              )}
              <Typography sx={{ fontSize: "0.85rem", mt: 0.5 }}>
                Líneas de material: {clasif?.lineasMaterial ?? "…"}
              </Typography>
            </Box>
          </Box>
        )}

        {errores.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {errores.map((e) => (
              <Typography
                key={e}
                sx={{ color: C.danger, fontSize: "0.875rem" }}
              >
                {e}
              </Typography>
            ))}
          </Box>
        )}

      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={busy}
          sx={{ borderRadius: 0, textTransform: "none" }}
        >
          {okMsg ? "Cerrar" : "Cancelar"}
        </Button>
        {!okMsg && (
          <Button
            variant="contained"
            onClick={confirmar}
            disabled={!canImport}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            {busy ? "Importando…" : "Importar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
