import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useObra } from "../../obras/ObraProvider";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "../personal/theme";
import {
  confirmacionCoincide,
  estadosAlcanzables,
  puedeEliminar,
} from "./edicionContenedor";
import {
  ESTADOS_CON_LLEGADA,
  ISO_RE,
  MODULO_TIPO_LABEL,
  formatFechaHora,
  formatLlegada,
  labelEstadoContenedor,
  labelEstadoModulo,
  plantaCorta,
  rangoEstado,
} from "./estados";

/**
 * @param {{
 *   contenedorId: string | null,
 *   obraId: string,
 *   createdBanner?: string | null,
 *   onClose: () => void,
 *   onChanged: () => void,
 * }} props
 */
export default function ContenedorDrawer({
  contenedorId,
  obraId,
  createdBanner,
  onClose,
  onChanged,
}) {
  const { can, mi_rol } = useObra();
  const canImport = can("contenedor.import");
  const canTrans = can("contenedor.transicion");
  const canDelete = can("contenedor.delete");
  const esCeo = mi_rol === "ceo";

  const open = Boolean(contenedorId);

  const [cont, setCont] = useState(null);
  const [modulos, setModulos] = useState([]);
  const [events, setEvents] = useState([]);
  const [transiciones, setTransiciones] = useState([]);
  const [nivel, setNivel] = useState(null);
  const [nivelError, setNivelError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [plantas, setPlantas] = useState([]);
  const [editIso, setEditIso] = useState("");
  const [editBl, setEditBl] = useState("");
  const [editPrecinto, setEditPrecinto] = useState("");
  const [editPlanta, setEditPlanta] = useState("");
  const [editLlegada, setEditLlegada] = useState("");
  const [editEstado, setEditEstado] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState(null);

  const [transDlg, setTransDlg] = useState(null); // { to, label }
  const [transNota, setTransNota] = useState("");
  const [transBusy, setTransBusy] = useState(false);
  const [transError, setTransError] = useState(null);

  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [eliminarCodigo, setEliminarCodigo] = useState("");
  const [eliminarBusy, setEliminarBusy] = useState(false);
  const [eliminarError, setEliminarError] = useState(null);

  const load = useCallback(async () => {
    if (!contenedorId || !obraId) return;
    setLoading(true);
    setError(null);

    const [cRes, mRes, eRes, tRes, nRes] = await Promise.all([
      supabase
        .from("contenedores")
        .select(
          "id, codigo, codigo_iso, estado, bl, precinto_esperado, planta_id, llegada_estimada, plantas(nombre)",
        )
        .eq("id", contenedorId)
        .eq("obra_id", obraId)
        .maybeSingle(),
      supabase
        .from("v_modulos")
        .select("id, codigo, referencia, tipo, estado, posicion")
        .eq("contenedor_id", contenedorId)
        .order("posicion"),
      supabase
        .from("status_events")
        .select("id, from_state, to_state, nota, created_at, profiles(full_name)")
        .eq("contenedor_id", contenedorId)
        .order("created_at", { ascending: false }),
      supabase
        .from("transiciones")
        .select("from_state, to_state")
        .eq("entidad", "contenedor"),
      supabase.rpc("contenedor_nivel_edicion", { p_contenedor: contenedorId }),
    ]);

    if (cRes.error) setError(cRes.error.message);
    else setCont(cRes.data);

    if (mRes.error) setError((e) => e ?? mRes.error.message);
    else setModulos(mRes.data ?? []);

    if (eRes.error) setError((e) => e ?? eRes.error.message);
    else setEvents(eRes.data ?? []);

    if (tRes.error) setError((e) => e ?? tRes.error.message);
    else setTransiciones(tRes.data ?? []);

    if (nRes.error) {
      setNivel(null);
      setNivelError(nRes.error.message);
    } else {
      setNivel(typeof nRes.data === "string" ? nRes.data : null);
      setNivelError(null);
    }

    setLoading(false);
  }, [contenedorId, obraId]);

  useEffect(() => {
    if (open) load();
    else {
      setCont(null);
      setModulos([]);
      setEvents([]);
      setEditOpen(false);
      setTransDlg(null);
      setEliminarOpen(false);
      setNivel(null);
      setNivelError(null);
    }
  }, [open, load]);

  const destinos = useMemo(() => {
    if (!cont) return [];
    return estadosAlcanzables(cont.estado, transiciones).sort(
      (a, b) => rangoEstado(a) - rangoEstado(b),
    );
  }, [cont, transiciones]);

  function openEdit() {
    if (!cont) return;
    setEditIso(cont.codigo_iso ?? "");
    setEditBl(cont.bl ?? "");
    setEditPrecinto(cont.precinto_esperado ?? "");
    setEditPlanta(cont.planta_id ?? "");
    setEditLlegada(cont.llegada_estimada ?? "");
    setEditEstado(cont.estado ?? "");
    setEditError(null);
    setEditOpen(true);
    (async () => {
      const { data, error: err } = await supabase
        .from("plantas")
        .select("id, nombre")
        .order("nombre");
      if (err) setEditError(err.message);
      else setPlantas(data ?? []);
    })();
  }

  async function saveEdit() {
    if (!cont) return;
    const iso = editIso.trim().toUpperCase();
    if (iso && !ISO_RE.test(iso)) {
      setEditError("Número ISO inválido (4 letras + 7 dígitos)");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    const { error: err } = await supabase.rpc("actualizar_contenedor", {
      p_contenedor: cont.id,
      p_bl: editBl.trim() || null,
      p_precinto: editPrecinto.trim() || null,
      p_planta: editPlanta || null,
      p_llegada: editLlegada || null,
      p_codigo_iso: iso || null,
    });
    setEditBusy(false);
    if (err) {
      setEditError(err.message);
      return;
    }
    if (canTrans && editEstado && editEstado !== cont.estado) {
      setEditBusy(true);
      const { error: errEstado } = await supabase.rpc("transition_contenedor", {
        p_contenedor: cont.id,
        p_to: editEstado,
        p_nota: null,
      });
      setEditBusy(false);
      if (errEstado) {
        setEditError(errEstado.message);
        await load();
        return;
      }
    }
    setEditOpen(false);
    await load();
    onChanged();
  }

  function abrirEliminar() {
    setEliminarCodigo("");
    setEliminarError(null);
    setEliminarOpen(true);
  }

  async function confirmarEliminar() {
    if (!cont || !confirmacionCoincide(eliminarCodigo, cont.codigo)) return;
    setEliminarBusy(true);
    setEliminarError(null);
    const { error: err } = await supabase.rpc("contenedor_eliminar", {
      p_contenedor: cont.id,
    });
    setEliminarBusy(false);
    if (err) {
      setEliminarError(err.message);
      return;
    }
    setEliminarOpen(false);
    onChanged();
    onClose();
  }

  function openTrans(to) {
    setTransDlg({ to, label: labelEstadoContenedor(to) });
    setTransNota("");
    setTransError(null);
  }

  async function confirmTrans() {
    if (!cont || !transDlg) return;
    setTransBusy(true);
    setTransError(null);
    const { error: err } = await supabase.rpc("transition_contenedor", {
      p_contenedor: cont.id,
      p_to: transDlg.to,
      p_nota: transNota.trim() || null,
    });
    setTransBusy(false);
    if (err) {
      setTransError(err.message);
      return;
    }
    setTransDlg(null);
    await load();
    onChanged();
  }

  const plantaNombre = cont?.plantas?.nombre;
  const llegadaTxt =
    cont && ESTADOS_CON_LLEGADA.has(cont.estado)
      ? formatLlegada(cont.llegada_estimada)
      : null;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 480 },
            bgcolor: C.bg,
            color: C.text,
            borderRadius: 0,
            borderLeft: 1,
            borderColor: C.line,
            boxShadow: "none",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: C.line,
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>Contenedor</Typography>
          <IconButton
            onClick={onClose}
            aria-label="Cerrar"
            sx={{ color: C.muted, borderRadius: 0 }}
          >
            ×
          </IconButton>
        </Box>

        <Box sx={{ p: 2, overflow: "auto", flex: 1 }}>
          {loading && (
            <Typography sx={{ color: C.muted }}>Cargando…</Typography>
          )}
          {error && (
            <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
              {error}
            </Typography>
          )}
          {!loading && !cont && contenedorId && (
            <Typography sx={{ color: C.muted }}>
              Contenedor no encontrado.
            </Typography>
          )}

          {cont && (
            <>
              {createdBanner && (
                <Typography
                  sx={{
                    color: C.accent,
                    mb: 2,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  Contenedor {createdBanner} creado
                </Typography>
              )}

              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "1.5rem",
                  letterSpacing: 0.5,
                  mb: 0.5,
                }}
              >
                {cont.codigo}
              </Typography>
              <Typography sx={{ color: C.muted, mb: 0.5 }}>
                {cont.codigo_iso || "Sin número ISO"}
              </Typography>
              <Typography sx={{ mb: 3 }}>
                {labelEstadoContenedor(cont.estado)}
                {llegadaTxt ? ` · llega ${llegadaTxt}` : ""}
              </Typography>

              {/* Datos */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>Datos</Typography>
                {canImport && (
                  <Button
                    size="small"
                    onClick={openEdit}
                    sx={{ textTransform: "none", borderRadius: 0 }}
                  >
                    Editar
                  </Button>
                )}
              </Box>
              <Box sx={{ mb: 3 }}>
                <Dato label="Número ISO" value={cont.codigo_iso} />
                <Dato label="BL" value={cont.bl} />
                <Dato label="Precinto esperado" value={cont.precinto_esperado} />
                <Dato label="Planta" value={plantaCorta(plantaNombre)} />
                <Dato
                  label="Llegada estimada"
                  value={
                    cont.llegada_estimada
                      ? formatLlegada(cont.llegada_estimada)
                      : null
                  }
                />
              </Box>

              {/* Estado / transiciones */}
              {canTrans && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ fontWeight: 600, mb: 1 }}>Estado</Typography>
                  <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 1 }}>
                    Ahora: {labelEstadoContenedor(cont.estado)}
                  </Typography>
                  {destinos.length === 0 ? (
                    <Typography sx={{ color: C.muted, fontSize: "0.8rem" }}>
                      Desde acá no hay otro estado permitido.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {destinos.map((to) => (
                        <Button
                          key={to}
                          variant={rangoEstado(to) < rangoEstado(cont.estado) ? "outlined" : "contained"}
                          onClick={() => openTrans(to)}
                          sx={{ borderRadius: 0, textTransform: "none" }}
                        >
                          {labelEstadoContenedor(to)}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* Módulos */}
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                Módulos ({modulos.length})
              </Typography>
              <Box sx={{ mb: 3 }}>
                {modulos.length === 0 && (
                  <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                    Sin módulos
                  </Typography>
                )}
                {modulos.map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 0.7fr 1fr",
                      gap: 1,
                      py: 1,
                      borderBottom: 1,
                      borderColor: C.line,
                      fontSize: "0.8rem",
                    }}
                  >
                    <Typography sx={{ fontSize: "inherit", fontFamily: "monospace" }}>
                      {m.codigo}
                    </Typography>
                    <Typography sx={{ fontSize: "inherit", color: C.muted }}>
                      {m.referencia || "—"}
                    </Typography>
                    <Typography sx={{ fontSize: "inherit" }}>
                      {MODULO_TIPO_LABEL[m.tipo] ?? m.tipo}
                    </Typography>
                    <Typography sx={{ fontSize: "inherit", color: C.muted }}>
                      {labelEstadoModulo(m.estado)}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Historia */}
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Historia</Typography>
              <Box>
                {events.length === 0 && (
                  <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                    Sin eventos
                  </Typography>
                )}
                {events.map((ev) => {
                  const from = ev.from_state
                    ? labelEstadoContenedor(ev.from_state)
                    : null;
                  const to = labelEstadoContenedor(ev.to_state);
                  const quien = ev.profiles?.full_name || "—";
                  const cuando = formatFechaHora(ev.created_at);
                  const cambio =
                    from && from !== to
                      ? `${from} → ${to}`
                      : ev.nota || to;
                  const partes = [cambio, quien, cuando];
                  if (ev.nota && from && from !== to) partes.push(ev.nota);
                  return (
                    <Typography
                      key={ev.id}
                      sx={{
                        fontSize: "0.8rem",
                        color: C.muted,
                        py: 1,
                        borderBottom: 1,
                        borderColor: C.line,
                      }}
                    >
                      {partes.join(" · ")}
                    </Typography>
                  );
                })}
              </Box>

              {canDelete && nivelError && (
                <Typography sx={{ color: C.danger, mt: 2, fontSize: "0.8rem" }}>
                  {nivelError}
                </Typography>
              )}
              {canDelete && puedeEliminar(nivel, esCeo) && (
                <Button
                  onClick={abrirEliminar}
                  sx={{
                    mt: 3,
                    color: "error.main",
                    textTransform: "none",
                    borderRadius: 0,
                    px: 0,
                  }}
                >
                  Eliminar
                </Button>
              )}
            </>
          )}
        </Box>
      </Drawer>

      {/* Editar datos */}
      <Dialog
        open={editOpen}
        onClose={editBusy ? undefined : () => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Editar datos
        </DialogTitle>
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          {editError && (
            <Typography sx={{ color: C.danger, fontSize: "0.875rem" }}>
              {editError}
            </Typography>
          )}
          <TextField
            label="Número ISO"
            value={editIso}
            onChange={(e) =>
              setEditIso(e.target.value.toUpperCase().replace(/\s/g, ""))
            }
            sx={{ ...fieldSx, mt: 1 }}
            fullWidth
          />
          <TextField
            label="BL"
            value={editBl}
            onChange={(e) => setEditBl(e.target.value)}
            sx={fieldSx}
            fullWidth
          />
          <TextField
            label="Precinto esperado"
            value={editPrecinto}
            onChange={(e) => setEditPrecinto(e.target.value)}
            sx={fieldSx}
            fullWidth
          />
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel id="planta-edit-label">Planta</InputLabel>
            <Select
              labelId="planta-edit-label"
              label="Planta"
              value={editPlanta}
              onChange={(e) => setEditPlanta(e.target.value)}
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
          {canTrans && (
            <FormControl fullWidth sx={fieldSx}>
              <InputLabel id="estado-edit-label">Estado</InputLabel>
              <Select
                labelId="estado-edit-label"
                label="Estado"
                value={editEstado}
                onChange={(e) => setEditEstado(e.target.value)}
                MenuProps={selectMenuProps}
              >
                <MenuItem value={cont?.estado ?? ""}>
                  {labelEstadoContenedor(cont?.estado)}
                </MenuItem>
                {destinos
                  .filter((to) => to !== cont?.estado)
                  .map((to) => (
                    <MenuItem key={to} value={to}>
                      {labelEstadoContenedor(to)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Llegada estimada"
            type="date"
            value={editLlegada}
            onChange={(e) => setEditLlegada(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setEditOpen(false)}
            disabled={editBusy}
            sx={{ color: C.muted }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={saveEdit}
            disabled={editBusy}
            sx={{ borderRadius: 0 }}
          >
            {editBusy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar transición */}
      <Dialog
        open={Boolean(transDlg)}
        onClose={transBusy ? undefined : () => setTransDlg(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Cambiar estado
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {transError && (
            <Typography sx={{ color: C.danger, mb: 1, fontSize: "0.875rem" }}>
              {transError}
            </Typography>
          )}
          <Typography sx={{ mb: 2 }}>
            {cont?.codigo}: {labelEstadoContenedor(cont?.estado)} →{" "}
            {transDlg?.label}
          </Typography>
          <TextField
            label="Nota (opcional)"
            value={transNota}
            onChange={(e) => setTransNota(e.target.value)}
            multiline
            minRows={2}
            sx={fieldSx}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setTransDlg(null)}
            disabled={transBusy}
            sx={{ color: C.muted }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={confirmTrans}
            disabled={transBusy}
            sx={{ borderRadius: 0 }}
          >
            {transBusy ? "Guardando…" : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={eliminarOpen}
        onClose={eliminarBusy ? undefined : () => setEliminarOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Eliminar contenedor
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {eliminarError && (
            <Typography sx={{ color: C.danger, mb: 1, fontSize: "0.875rem" }}>
              {eliminarError}
            </Typography>
          )}
          <Typography sx={{ mb: 2 }}>
            Se borra {cont?.codigo} y sus módulos. Escribí {cont?.codigo} para confirmar.
          </Typography>
          <TextField
            label="Código"
            value={eliminarCodigo}
            onChange={(e) => setEliminarCodigo(e.target.value)}
            sx={fieldSx}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setEliminarOpen(false)}
            disabled={eliminarBusy}
            sx={{ color: C.muted }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmarEliminar}
            disabled={eliminarBusy || !confirmacionCoincide(eliminarCodigo, cont?.codigo)}
            sx={{ borderRadius: 0 }}
          >
            {eliminarBusy ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Dato({ label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: C.line,
      }}
    >
      <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.875rem", textAlign: "right" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}
