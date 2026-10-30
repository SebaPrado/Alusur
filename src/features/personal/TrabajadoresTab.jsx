import React, { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { FiMoreVertical } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { PageActions } from "../obra/PageActions";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "./theme";
import NuevoTrabajadorDialog from "./NuevoTrabajadorDialog";
import EnrolamientoCard from "./EnrolamientoCard";
import InfoButton from "./InfoButton";
import AccesoObrerosInfo from "./AccesoObrerosInfo";

function formatBloqueo(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null;
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

function estadoLabel(row) {
  if (!row.activo) return "Dado de baja";
  const hasta = formatBloqueo(row.bloqueado_hasta);
  if (hasta) return `Bloqueado hasta ${hasta}`;
  return "Activo";
}

export default function TrabajadoresTab() {
  const { obraId, openEmpresas, empresasTick } = useOutletContext();
  const { can, mi_rol } = useObra();
  const controlTotal = controlTotalEnObra(mi_rol);
  const canMembers = can("members.manage");
  const canEquipo = can("equipo.manage");
  const canHab = can("habilitacion.manage");

  const [rows, setRows] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [maquinaTipos, setMaquinaTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [enrol, setEnrol] = useState(null); // { fullName, workerCode, pin? }

  const [equipoDlg, setEquipoDlg] = useState(null); // row
  const [equipoPick, setEquipoPick] = useState("");
  const [habDlg, setHabDlg] = useState(null); // { row, selectedIds: Set }
  const [bajaDlg, setBajaDlg] = useState(null);
  const [altaDlg, setAltaDlg] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTopic, setInfoTopic] = useState("acceso");

  function openInfo(topic) {
    setInfoTopic(topic);
    setInfoOpen(true);
  }

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    const [trab, eqs, tipos] = await Promise.all([
      supabase.rpc("listar_trabajadores", { p_obra: obraId }),
      supabase.from("equipos").select("id, nombre").eq("obra_id", obraId).order("nombre"),
      supabase.from("maquina_tipos").select("id, nombre").order("nombre"),
    ]);
    if (trab.error) setError(trab.error.message);
    else setRows(trab.data ?? []);
    if (eqs.error) setError((e) => e ?? eqs.error.message);
    else setEquipos(eqs.data ?? []);
    if (tipos.error) setError((e) => e ?? tipos.error.message);
    else setMaquinaTipos(tipos.data ?? []);
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load]);

  // worker_code / pin solo vienen de listar_trabajadores con members.manage o CEO
  const showCredenciales = canMembers && rows.some((r) => r.worker_code != null);
  const cols = showCredenciales
    ? "minmax(140px, 1.4fr) 90px 72px 1fr 1fr 140px 36px"
    : "minmax(140px, 1.4fr) 1fr 1fr 140px 36px";

  async function handleNuevoPin(row) {
    setActionBusy(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "reset_pin",
          obra_id: obraId,
          user_id: row.user_id,
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
      setEnrol({
        fullName: row.full_name,
        workerCode: data.worker_code ?? row.worker_code,
        pin: data.pin,
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmCambioEquipo() {
    if (!equipoDlg) return;
    setActionBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("asignar_equipo", {
        p_obra: obraId,
        p_user: equipoDlg.user_id,
        p_equipo: equipoPick || null,
      });
      if (err) throw new Error(err.message);
      setEquipoDlg(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function openHabDlg(row) {
    const { data, error: err } = await supabase
      .from("habilitaciones")
      .select("maquina_tipo_id")
      .eq("user_id", row.user_id);
    if (err) {
      setError(err.message);
      return;
    }
    setHabDlg({
      row,
      selected: new Set((data ?? []).map((h) => h.maquina_tipo_id)),
    });
  }

  async function saveHab() {
    if (!habDlg) return;
    setActionBusy(true);
    setError(null);
    try {
      const userId = habDlg.row.user_id;
      const { data: current, error: curErr } = await supabase
        .from("habilitaciones")
        .select("maquina_tipo_id")
        .eq("user_id", userId);
      if (curErr) throw new Error(curErr.message);
      const have = new Set((current ?? []).map((h) => h.maquina_tipo_id));
      const want = habDlg.selected;
      const toAdd = [...want].filter((id) => !have.has(id));
      const toDel = [...have].filter((id) => !want.has(id));
      if (toAdd.length) {
        const { error: insErr } = await supabase.from("habilitaciones").insert(
          toAdd.map((maquina_tipo_id) => ({ user_id: userId, maquina_tipo_id })),
        );
        if (insErr) throw new Error(insErr.message);
      }
      for (const id of toDel) {
        const { error: delErr } = await supabase
          .from("habilitaciones")
          .delete()
          .eq("user_id", userId)
          .eq("maquina_tipo_id", id);
        if (delErr) throw new Error(delErr.message);
      }
      setHabDlg(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmAlta() {
    if (!altaDlg) return;
    setActionBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("reactivar_trabajador", {
        p_obra: obraId,
        p_user: altaDlg.user_id,
      });
      if (err) throw new Error(err.message);
      setAltaDlg(null);
      setOpenActionsId(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmBaja() {
    if (!bajaDlg) return;
    setActionBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("remove_member", {
        p_obra: obraId,
        p_user: bajaDlg.user_id,
      });
      if (err) throw new Error(err.message);
      setBajaDlg(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
            {loading
              ? "Cargando…"
              : `${rows.length} trabajador${rows.length === 1 ? "" : "es"}`}
          </Typography>
          {canMembers && (
            <InfoButton
              label="Cómo entra un obrero a la app"
              onClick={() => openInfo("acceso")}
            />
          )}
        </Box>
      </Box>

      {canMembers && (
        <PageActions>
          <Button
            size="small"
            onClick={() => setNuevoOpen(true)}
            sx={{
              color: C.bg,
              bgcolor: C.accent,
              borderRadius: 0,
              textTransform: "none",
              px: 2,
              "&:hover": { bgcolor: C.accent, opacity: 0.9 },
            }}
          >
            + Nuevo trabajador
          </Button>
        </PageActions>
      )}

      {error && (
        <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>{error}</Typography>
      )}

      {!loading && rows.length === 0 && (
        <Typography sx={{ color: C.muted }}>No hay trabajadores en esta obra.</Typography>
      )}

      <Box>
        {showCredenciales && rows.length > 0 && (
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: cols,
              gap: 2,
              pb: 1,
              borderBottom: 1, borderColor: C.line,
            }}
          >
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>Nombre</Typography>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>Código</Typography>
              <InfoButton
                label="Qué es el código y el QR"
                size={16}
                onClick={() => openInfo("codigo")}
              />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>PIN</Typography>
              <InfoButton
                label="Qué es el PIN"
                size={16}
                onClick={() => openInfo("pin")}
              />
            </Box>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>Equipo</Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>Habilitaciones</Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>Estado</Typography>
            <Box />
          </Box>
        )}
        {rows.map((row) => {
          const habs =
            Array.isArray(row.habilitaciones) && row.habilitaciones.length
              ? row.habilitaciones.join(", ")
              : "—";
          const actionsOpen = openActionsId === row.user_id;
          const showMenu = row.activo || controlTotal;
          const spanXs = { gridColumn: { xs: "1 / -1", md: "auto" } };
          return (
            <Box
              key={row.user_id}
              sx={{
                py: 1.5,
                borderBottom: 1, borderColor: C.line,
                display: "grid",
                gridTemplateColumns: { xs: "1fr 36px", md: cols },
                columnGap: { xs: 1, md: 2 },
                rowGap: { xs: 0.5, md: 0 },
                alignItems: "center",
                opacity: row.activo ? 1 : 0.55,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  color: C.text,
                  gridColumn: { xs: "1", md: "auto" },
                  gridRow: { xs: "1", md: "auto" },
                }}
              >
                {row.full_name}
              </Typography>
              {showCredenciales && (
                <Typography
                  sx={{
                    color: C.muted,
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    ...spanXs,
                  }}
                >
                  {row.worker_code ?? "—"}
                </Typography>
              )}
              {showCredenciales && (
                <Typography
                  sx={{
                    ...spanXs,
                    color: row.pin ? C.text : C.muted,
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    letterSpacing: row.pin ? 2 : 0,
                    fontWeight: row.pin ? 600 : 400,
                  }}
                  title={
                    row.pin
                      ? undefined
                      : "PIN no disponible: usá «Nuevo PIN» para generar uno visible"
                  }
                >
                  {row.pin ?? "—"}
                </Typography>
              )}
              <Typography sx={{ color: C.muted, fontSize: "0.875rem", ...spanXs }}>
                {row.equipo || "Sin equipo"}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem", ...spanXs }}>{habs}</Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem", ...spanXs }}>
                {estadoLabel(row)}
              </Typography>

              {showMenu && (
                <IconButton
                  size="small"
                  aria-label={`Acciones de ${row.full_name}`}
                  aria-expanded={actionsOpen}
                  onClick={() =>
                    setOpenActionsId((id) => (id === row.user_id ? null : row.user_id))
                  }
                  sx={{
                    gridColumn: { xs: "2", md: "auto" },
                    gridRow: { xs: "1", md: "auto" },
                    justifySelf: "end",
                    width: 28,
                    height: 28,
                    p: 0,
                    borderRadius: 0,
                    color: actionsOpen ? C.accent : C.muted,
                    "&:hover": { color: C.accent, bgcolor: "transparent" },
                  }}
                >
                  <FiMoreVertical size={16} />
                </IconButton>
              )}

              <Collapse
                in={actionsOpen}
                timeout={180}
                unmountOnExit
                sx={{ gridColumn: "1 / -1" }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 0.25,
                    pt: 1,
                    pr: 0.5,
                  }}
                >
                  {row.activo && canEquipo && (
                    <ActionLink
                      onClick={() => {
                        setEquipoPick(row.equipo_id ?? "");
                        setEquipoDlg(row);
                      }}
                    >
                      Cambiar equipo
                    </ActionLink>
                  )}
                  {row.activo && canHab && (
                    <ActionLink onClick={() => openHabDlg(row)}>Habilitaciones</ActionLink>
                  )}
                  {row.activo && canMembers && (
                    <ActionLink disabled={actionBusy} onClick={() => handleNuevoPin(row)}>
                      Nuevo PIN
                    </ActionLink>
                  )}
                  {row.activo && canMembers && row.worker_code && (
                    <ActionLink
                      onClick={() =>
                        setEnrol({
                          fullName: row.full_name,
                          workerCode: row.worker_code,
                          pin: row.pin ?? null,
                        })
                      }
                    >
                      Reimprimir QR
                    </ActionLink>
                  )}
                  {row.activo && canMembers && (
                    <ActionLink danger onClick={() => setBajaDlg(row)}>
                      Dar de baja
                    </ActionLink>
                  )}
                  {!row.activo && controlTotal && (
                    <ActionLink onClick={() => setAltaDlg(row)}>Dar de alta</ActionLink>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      <NuevoTrabajadorDialog
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        obraId={obraId}
        equipos={equipos}
        onOpenEmpresas={openEmpresas}
        empresasTick={empresasTick}
        onCreated={({ fullName, workerCode, pin }) => {
          setEnrol({ fullName, workerCode, pin });
          load();
        }}
      />

      <EnrolamientoCard
        open={!!enrol}
        onClose={() => setEnrol(null)}
        fullName={enrol?.fullName}
        workerCode={enrol?.workerCode}
        pin={enrol?.pin ?? null}
      />

      <AccesoObrerosInfo
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        topic={infoTopic}
      />

      <Dialog
        open={!!equipoDlg}
        onClose={() => setEquipoDlg(null)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Cambiar equipo · {equipoDlg?.full_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ ...fieldSx, mt: 1 }}>
            <InputLabel>Equipo</InputLabel>
            <Select
              label="Equipo"
              value={equipoPick}
              onChange={(e) => setEquipoPick(e.target.value)}
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
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button onClick={() => setEquipoDlg(null)} sx={{ color: C.muted, textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            onClick={confirmCambioEquipo}
            disabled={actionBusy}
            sx={{ color: C.accent, textTransform: "none" }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!habDlg}
        onClose={() => setHabDlg(null)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Habilitaciones · {habDlg?.row?.full_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {maquinaTipos.map((t) => {
            const checked = habDlg?.selected?.has(t.id);
            return (
              <Box
                key={t.id}
                onClick={() => {
                  setHabDlg((prev) => {
                    if (!prev) return prev;
                    const next = new Set(prev.selected);
                    if (next.has(t.id)) next.delete(t.id);
                    else next.add(t.id);
                    return { ...prev, selected: next };
                  });
                }}
                sx={{
                  py: 1,
                  borderBottom: 1, borderColor: C.line,
                  cursor: "pointer",
                  color: checked ? C.accent : C.text,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{t.nombre}</span>
                <span>{checked ? "✓" : ""}</span>
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button onClick={() => setHabDlg(null)} sx={{ color: C.muted, textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            onClick={saveHab}
            disabled={actionBusy}
            sx={{ color: C.accent, textTransform: "none" }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!altaDlg}
        onClose={() => setAltaDlg(null)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>Dar de alta</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ color: C.text }}>
            ¿Damos de alta otra vez a <strong>{altaDlg?.full_name}</strong>? Vuelve a estar activo
            en la obra, sin equipo. El código y el PIN siguen siendo los mismos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button onClick={() => setAltaDlg(null)} sx={{ color: C.muted, textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            onClick={confirmAlta}
            disabled={actionBusy}
            sx={{ color: C.accent, textTransform: "none" }}
          >
            Dar de alta
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!bajaDlg}
        onClose={() => setBajaDlg(null)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>Dar de baja</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ color: C.text }}>
            ¿Damos de baja a <strong>{bajaDlg?.full_name}</strong>? Se cierra su equipo y queda el
            historial.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button onClick={() => setBajaDlg(null)} sx={{ color: C.muted, textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            onClick={confirmBaja}
            disabled={actionBusy}
            sx={{ color: C.danger, textTransform: "none" }}
          >
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ActionLink({ children, onClick, disabled, danger }) {
  return (
    <Button
      size="small"
      disabled={disabled}
      onClick={onClick}
      sx={{
        minWidth: 0,
        px: 0.5,
        py: 0.25,
        justifyContent: "flex-end",
        color: danger ? C.danger : C.accent,
        textTransform: "none",
        fontSize: "0.8rem",
        "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
      }}
    >
      {children}
    </Button>
  );
}
