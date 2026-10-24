import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { FiInfo } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "../personal/theme";
import {
  ISO_RE,
  MODULO_TIPO_LABEL,
  MODULO_TIPO_PLURAL,
  MODULO_TIPOS,
} from "./estados";
import {
  claveCatalogo,
  existeEnCatalogo,
  opcionesDeCatalogo,
} from "./catalogoModulos";
import { generarReferencias, validatePackingRows, validarFilasCatalogo } from "./packingList";
import { useCatalogo } from "./useCatalogo";

const emptyRowLegacy = () => ({ referencia: "", tipo: "ventana" });
const emptyRowCat = () => ({ referencia: "", codigo_tipo: "", pieza: "principal" });

const backdropSx = {
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  backgroundColor: "rgba(0, 0, 0, 0.45)",
};

/**
 * Alta manual en 2 pasos: (1) datos del contenedor, (2) módulos.
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
  const { catalogo, loading: catLoading, error: catError } = useCatalogo(
    open ? obraId : null,
  );
  const conCatalogo = catalogo.length > 0;
  const opciones = useMemo(() => opcionesDeCatalogo(catalogo), [catalogo]);

  const [paso, setPaso] = useState(1);
  /** null | 'n' | 'uno' — cómo se cargan los módulos en el paso 2 */
  const [modoCarga, setModoCarga] = useState(null);
  const [codigoIso, setCodigoIso] = useState("");
  const [bl, setBl] = useState("");
  const [precinto, setPrecinto] = useState("");
  const [plantaId, setPlantaId] = useState("");
  const [llegada, setLlegada] = useState("");
  const [plantas, setPlantas] = useState([]);
  const [modulos, setModulos] = useState([emptyRowLegacy()]);

  const [prefijo, setPrefijo] = useState("AL-");
  const [desde, setDesde] = useState("1");
  const [cantidad, setCantidad] = useState("25");
  const [digitos, setDigitos] = useState("4");
  const [genTipo, setGenTipo] = useState("ventana");
  const [genOpcion, setGenOpcion] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setModoCarga(null);
    setCodigoIso("");
    setBl("");
    setPrecinto("");
    setPlantaId("");
    setLlegada("");
    setPrefijo("AL-");
    setDesde("1");
    setCantidad("25");
    setDigitos("4");
    setGenTipo("ventana");
    setGenOpcion(null);
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

  // Cuando llega el catálogo, alinear filas vacías al modo correcto.
  useEffect(() => {
    if (!open || catLoading) return;
    setModulos((prev) => {
      if (conCatalogo) {
        if (prev.every((r) => !r.referencia && !r.codigo_tipo)) return [emptyRowCat()];
        return prev.map((r) =>
          r.codigo_tipo != null || r.pieza != null
            ? r
            : { referencia: r.referencia ?? "", codigo_tipo: "", pieza: "principal" },
        );
      }
      if (prev.every((r) => !r.referencia && !r.tipo)) return [emptyRowLegacy()];
      return prev.map((r) =>
        r.tipo != null
          ? r
          : { referencia: r.referencia ?? "", tipo: "ventana" },
      );
    });
  }, [open, catLoading, conCatalogo]);

  useEffect(() => {
    if (catError) setError(catError);
  }, [catError]);

  const validated = useMemo(() => {
    if (conCatalogo) {
      return validarFilasCatalogo(
        modulos.map((m) => ({
          referencia: String(m.referencia ?? "").trim(),
          codigo_tipo: String(m.codigo_tipo ?? "").trim(),
          pieza: String(m.pieza ?? "principal").trim().toLowerCase() || "principal",
        })),
        catalogo,
      );
    }
    return validatePackingRows(
      modulos.map((m) => ({
        referencia: String(m.referencia ?? "").trim(),
        tipo: String(m.tipo ?? "").trim().toLowerCase(),
      })),
    );
  }, [modulos, conCatalogo, catalogo]);

  const isoOk = ISO_RE.test(codigoIso);
  const canPaso1 = isoOk && !busy;
  const canConfirm = isoOk && validated.ok && !busy && !catLoading;

  function updateRow(i, patch) {
    setModulos((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setModulos((prev) => {
      if (prev.length >= 99) return prev;
      return [...prev, conCatalogo ? emptyRowCat() : emptyRowLegacy()];
    });
  }

  function removeRow(i) {
    setModulos((prev) => {
      if (prev.length <= 1) return [conCatalogo ? emptyRowCat() : emptyRowLegacy()];
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function generar() {
    setError(null);
    const baseOpts = {
      prefijo,
      desde: Number(desde),
      cantidad: Number(cantidad),
      digitos: Number(digitos),
    };
    let nuevas;
    if (conCatalogo) {
      if (!genOpcion) {
        setError("Elegí un código del catálogo para generar.");
        return;
      }
      nuevas = generarReferencias({
        ...baseOpts,
        codigo_tipo: genOpcion.codigo_tipo,
        pieza: genOpcion.pieza,
      });
    } else {
      nuevas = generarReferencias({ ...baseOpts, tipo: genTipo });
    }
    if (nuevas.length === 0) {
      setError("Indicá una cantidad mayor a 0.");
      return;
    }
    setModulos((prev) => {
      const soloVacias = prev.every((r) => !String(r.referencia ?? "").trim());
      const base = soloVacias ? [] : prev;
      const merged = [...base, ...nuevas];
      if (merged.length > 99) {
        setError("No se pueden superar 99 módulos; se truncó la lista.");
        return merged.slice(0, 99);
      }
      return merged;
    });
  }

  function irPaso2() {
    if (!canPaso1) return;
    setError(null);
    setPaso(2);
  }

  async function confirmar() {
    if (!obraId || !canConfirm) return;
    setBusy(true);
    setError(null);

    const p_data = {
      codigo_iso: codigoIso,
      modulos: conCatalogo
        ? validated.rows.map((r) => ({
            codigo_tipo: r.codigo_tipo,
            pieza: r.pieza,
            referencia: r.referencia,
          }))
        : validated.rows.map((r) => ({
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

  function opcionDeFila(row) {
    if (!row?.codigo_tipo) return null;
    const key = claveCatalogo(row.codigo_tipo, row.pieza || "principal");
    return opciones.find((o) => o.key === key) ?? null;
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth={paso === 1 ? "sm" : "md"}
      PaperProps={{ sx: dialogPaperSx }}
      BackdropProps={{ sx: backdropSx }}
    >
      <DialogTitle sx={{ borderBottom: 1, borderColor: C.line, pb: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{ fontWeight: 700, display: "block" }}
            >
              Nuevo contenedor
            </Typography>
            <Typography
              component="span"
              sx={{ color: C.muted, fontSize: "0.8rem", fontWeight: 400 }}
            >
              {paso === 1
                ? "1 · Datos del contenedor"
                : "2 · Poblar con módulos"}
            </Typography>
          </Box>
          {paso === 1 && (
            <Tooltip
              title="El código interno (C-0001) lo asigna el sistema. Acá cargás el número ISO y los datos de seguimiento."
              arrow
              enterTouchDelay={0}
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: C.bg,
                    color: C.text,
                    border: 1,
                    borderColor: C.line,
                    borderRadius: 0,
                    fontSize: "0.8rem",
                    maxWidth: 280,
                    boxShadow: "none",
                  },
                },
                arrow: { sx: { color: C.bg } },
              }}
            >
              <IconButton
                size="small"
                aria-label="Información"
                sx={{
                  color: C.muted,
                  borderRadius: 0,
                  border: 1,
                  borderColor: C.line,
                  width: 28,
                  height: 28,
                  mt: 0.25,
                  "&:hover": { color: C.accent, borderColor: C.accent },
                }}
              >
                <FiInfo size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          // MUI pone padding-top: 0 cuando hay DialogTitle delante
          "&&": { pt: 3.5 },
        }}
      >
        {error && (
          <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
            {error}
          </Typography>
        )}

        {paso === 1 && (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
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
                sx={{ ...fieldSx, gridColumn: { xs: "1", sm: "1 / -1" } }}
                fullWidth
              />
            </Box>
          </>
        )}

        {paso === 2 && (
          <>
            <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 2 }}>
              ISO {codigoIso}
              {bl.trim() ? ` · BL ${bl.trim()}` : ""}
              {conCatalogo
                ? " · Catálogo ALUMAN."
                : " · Referencia + tipo."}
            </Typography>

            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              ¿Cómo querés cargar los módulos?
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                mb: 2,
                border: 1,
                borderColor: C.line,
                px: 1.5,
                py: 0.75,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={modoCarga === "n"}
                    onChange={() =>
                      setModoCarga((m) => (m === "n" ? null : "n"))
                    }
                    size="small"
                    sx={{
                      color: C.muted,
                      "&.Mui-checked": { color: C.accent },
                      borderRadius: 0,
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      Agregar N módulos
                    </Typography>
                    <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                      Generá una secuencia (ej. AL-0001 … AL-0025) con el mismo
                      código de catálogo.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mx: 0, py: 0.5 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={modoCarga === "uno"}
                    onChange={() =>
                      setModoCarga((m) => (m === "uno" ? null : "uno"))
                    }
                    size="small"
                    sx={{
                      color: C.muted,
                      "&.Mui-checked": { color: C.accent },
                      borderRadius: 0,
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      Agregar de a 1
                    </Typography>
                    <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                      Cargá cada módulo a mano en la tabla (referencia +
                      catálogo).
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", mx: 0, py: 0.5 }}
              />
            </Box>

            {modoCarga === "n" && (
              <>
                <Typography sx={{ fontWeight: 600, mb: 1 }}>
                  {conCatalogo
                    ? "Generar N módulos de un código"
                    : "Generar códigos"}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr 1fr",
                      sm: conCatalogo
                        ? "1.2fr 0.7fr 0.7fr 0.7fr 1.4fr auto"
                        : "1.2fr 0.7fr 0.7fr 0.7fr 1fr auto",
                    },
                    gap: 1.5,
                    alignItems: "start",
                    mb: 1,
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
                  {conCatalogo ? (
                    <Autocomplete
                      size="small"
                      options={opciones}
                      value={genOpcion}
                      onChange={(_, v) => setGenOpcion(v)}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(a, b) => a.key === b.key}
                      filterOptions={(opts, state) => {
                        const q = state.inputValue.trim().toLowerCase();
                        if (!q) return opts;
                        return opts.filter((o) => o.filterText.includes(q));
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Código" sx={fieldSx} />
                      )}
                    />
                  ) : (
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
                  )}
                  <Button
                    variant="outlined"
                    onClick={generar}
                    sx={{
                      borderRadius: 0,
                      textTransform: "none",
                      height: 40,
                    }}
                  >
                    Generar
                  </Button>
                </Box>
                <Typography
                  sx={{ color: C.muted, fontSize: "0.75rem", mb: 2 }}
                >
                  Ej.: prefijo AL-, desde 1, 25 módulos, 4 dígitos → AL-0001 …
                  AL-0025. Si la tabla ya tiene filas, se agregan al final.
                </Typography>
              </>
            )}

            {modoCarga === "uno" && (
              <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 2 }}>
                Completá cada fila o usá “+ Agregar fila” para sumar otra.
              </Typography>
            )}

            {modoCarga && (
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
                {validated.ok && resumen.total > 0 && !conCatalogo
                  ? ` · ${resumen.ventana} ${MODULO_TIPO_PLURAL.ventana} · ${resumen.panel} ${MODULO_TIPO_PLURAL.panel}`
                  : ""}
                {validated.ok && conCatalogo && resumen.porCodigo?.length
                  ? ` · ${resumen.porCodigo.map((c) => `${c.n}× ${c.codigo_tipo}`).join(" · ")}`
                  : ""}
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Link
                  component="button"
                  type="button"
                  onClick={() =>
                    setModulos([conCatalogo ? emptyRowCat() : emptyRowLegacy()])
                  }
                  sx={{ color: C.muted, fontSize: "0.8rem" }}
                >
                  Vaciar
                </Link>
                {modoCarga === "uno" && (
                  <Link
                    component="button"
                    type="button"
                    onClick={addRow}
                    sx={{ color: C.accent, fontSize: "0.8rem" }}
                  >
                    + Agregar fila
                  </Link>
                )}
              </Box>
            </Box>
            )}

            {modoCarga && !validated.ok && validated.errors.length > 0 && (
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

            {modoCarga && (
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
                  gridTemplateColumns: conCatalogo
                    ? "40px 1fr 1.4fr 72px 40px"
                    : "40px 1fr 140px 40px",
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
                  #
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                  Código (referencia)
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                  {conCatalogo ? "Catálogo" : "Tipo"}
                </Typography>
                {conCatalogo && (
                  <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
                    Clase
                  </Typography>
                )}
                <span />
              </Box>
              {modulos.map((row, i) => {
                const err = validated.rows[i]?.error;
                const opcion = conCatalogo ? opcionDeFila(row) : null;
                const catLabel = opcion?.categoria
                  ? MODULO_TIPO_LABEL[opcion.categoria] ?? opcion.categoria
                  : "—";
                return (
                  <Box
                    key={i}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: conCatalogo
                        ? "40px 1fr 1.4fr 72px 40px"
                        : "40px 1fr 140px 40px",
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
                    {conCatalogo ? (
                      <>
                        <Autocomplete
                          size="small"
                          options={opciones}
                          value={opcion}
                          onChange={(_, v) =>
                            updateRow(i, {
                              codigo_tipo: v?.codigo_tipo ?? "",
                              pieza: v?.pieza ?? "principal",
                            })
                          }
                          getOptionLabel={(o) => o.label}
                          isOptionEqualToValue={(a, b) => a.key === b.key}
                          filterOptions={(opts, state) => {
                            const q = state.inputValue.trim().toLowerCase();
                            if (!q) return opts;
                            return opts.filter((o) => o.filterText.includes(q));
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              error={
                                Boolean(err) &&
                                !existeEnCatalogo(
                                  catalogo,
                                  row.codigo_tipo,
                                  row.pieza,
                                )
                              }
                              placeholder="CE10.1…"
                              sx={fieldSx}
                            />
                          )}
                        />
                        <Typography
                          sx={{ color: C.muted, fontSize: "0.8rem" }}
                        >
                          {catLabel}
                        </Typography>
                      </>
                    ) : (
                      <FormControl size="small" sx={fieldSx} fullWidth>
                        <Select
                          value={row.tipo || "ventana"}
                          onChange={(e) =>
                            updateRow(i, { tipo: e.target.value })
                          }
                          MenuProps={selectMenuProps}
                        >
                          {MODULO_TIPOS.map((t) => (
                            <MenuItem key={t} value={t}>
                              {MODULO_TIPO_LABEL[t]}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
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
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 3, py: 2 }}>
        {paso === 1 ? (
          <>
            <Button onClick={onClose} disabled={busy} sx={{ color: C.muted }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={!canPaso1}
              onClick={irPaso2}
              sx={{ borderRadius: 0, textTransform: "none" }}
            >
              Siguiente · módulos
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => {
                setError(null);
                setPaso(1);
              }}
              disabled={busy}
              sx={{ color: C.muted, mr: "auto" }}
            >
              Atrás
            </Button>
            <Button onClick={onClose} disabled={busy} sx={{ color: C.muted }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={!canConfirm}
              onClick={confirmar}
              sx={{ borderRadius: 0, textTransform: "none" }}
            >
              {busy ? "Creando…" : "Crear contenedor"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
