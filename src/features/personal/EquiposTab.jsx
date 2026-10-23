import React, { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box,
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
import { PageActions } from "../obra/PageActions";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "./theme";

export default function EquiposTab() {
  const { obraId } = useOutletContext();
  const { can } = useObra();
  const canEquipo = can("equipo.manage");

  const [equipos, setEquipos] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [renameNombre, setRenameNombre] = useState("");
  const [liderPick, setLiderPick] = useState("");
  const [addPick, setAddPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);

    const [eqRes, memRes, trabRes] = await Promise.all([
      supabase
        .from("equipos")
        .select("id, nombre, lider_user_id")
        .eq("obra_id", obraId)
        .order("nombre"),
      supabase
        .from("equipo_members")
        .select("equipo_id, user_id")
        .eq("obra_id", obraId)
        .is("left_at", null),
      supabase.rpc("listar_trabajadores", { p_obra: obraId }),
    ]);

    if (eqRes.error) {
      setError(eqRes.error.message);
      setLoading(false);
      return;
    }
    if (memRes.error) {
      setError(memRes.error.message);
      setLoading(false);
      return;
    }
    if (trabRes.error) {
      setError(trabRes.error.message);
      setLoading(false);
      return;
    }

    const trabs = (trabRes.data ?? []).filter((t) => t.activo);
    setTrabajadores(trabs);
    const nameById = Object.fromEntries(trabs.map((t) => [t.user_id, t.full_name]));

    const counts = {};
    for (const m of memRes.data ?? []) {
      counts[m.equipo_id] = (counts[m.equipo_id] ?? 0) + 1;
    }

    const list = (eqRes.data ?? []).map((eq) => ({
      ...eq,
      integrantes: counts[eq.id] ?? 0,
      lider_nombre: eq.lider_user_id ? nameById[eq.lider_user_id] ?? "—" : null,
      miembros: (memRes.data ?? [])
        .filter((m) => m.equipo_id === eq.id)
        .map((m) => ({
          user_id: m.user_id,
          full_name: nameById[m.user_id] ?? m.user_id,
        })),
    }));
    setEquipos(list);
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = equipos.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setRenameNombre("");
      setLiderPick("");
      return;
    }
    setRenameNombre(selected.nombre);
    setLiderPick(selected.lider_user_id ?? "");
  }, [selected]);

  async function crearEquipo() {
    if (!nuevoNombre.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("equipos")
        .insert({ obra_id: obraId, nombre: nuevoNombre.trim() })
        .select("id")
        .single();
      if (err) throw new Error(err.message);
      setNuevoOpen(false);
      setNuevoNombre("");
      await load();
      if (data?.id) setSelectedId(data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function renombrar() {
    if (!selected || !renameNombre.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("equipos")
        .update({ nombre: renameNombre.trim() })
        .eq("id", selected.id)
        .eq("obra_id", obraId);
      if (err) throw new Error(err.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function guardarLider() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("equipos")
        .update({ lider_user_id: liderPick || null })
        .eq("id", selected.id)
        .eq("obra_id", obraId);
      if (err) throw new Error(err.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function agregarIntegrante() {
    if (!selected || !addPick) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("asignar_equipo", {
        p_obra: obraId,
        p_user: addPick,
        p_equipo: selected.id,
      });
      if (err) throw new Error(err.message);
      setAddPick("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function quitarIntegrante(userId) {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("asignar_equipo", {
        p_obra: obraId,
        p_user: userId,
        p_equipo: null,
      });
      if (err) throw new Error(err.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const disponibles = trabajadores.filter(
    (t) => !selected?.miembros.some((m) => m.user_id === t.user_id),
  );

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
        <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
          {loading ? "Cargando…" : `${equipos.length} equipo${equipos.length === 1 ? "" : "s"}`}
        </Typography>
      </Box>

      {canEquipo && (
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
            + Nuevo equipo
          </Button>
        </PageActions>
      )}

      {error && (
        <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>{error}</Typography>
      )}

      {!loading && equipos.length === 0 && (
        <Typography sx={{ color: C.muted }}>No hay equipos en esta obra.</Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {equipos.map((eq) => (
            <Box
              key={eq.id}
              onClick={() => setSelectedId(eq.id)}
              sx={{
                py: 1.5,
                borderBottom: 1, borderColor: C.line,
                cursor: "pointer",
                borderLeft: 2,
                borderLeftColor:
                  selectedId === eq.id ? C.accent : "transparent",
                pl: 1.5,
              }}
            >
              <Typography sx={{ fontWeight: 600, color: C.text }}>{eq.nombre}</Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                Líder: {eq.lider_nombre || "—"}
                {" · "}
                {eq.integrantes} integrante{eq.integrantes === 1 ? "" : "s"}
              </Typography>
            </Box>
          ))}
        </Box>

        {selected && (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              borderLeft: { md: 1 },
              borderLeftColor: { md: C.line },
              pl: { md: 3 },
            }}
          >
            <Typography sx={{ fontWeight: 700, mb: 2, color: C.text }}>
              {selected.nombre}
            </Typography>

            {canEquipo ? (
              <>
                <TextField
                  label="Nombre"
                  value={renameNombre}
                  onChange={(e) => setRenameNombre(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ ...fieldSx, mb: 1 }}
                />
                <Button
                  onClick={renombrar}
                  disabled={busy || renameNombre.trim() === selected.nombre}
                  sx={{ color: C.accent, textTransform: "none", mb: 2 }}
                >
                  Renombrar
                </Button>

                <FormControl fullWidth size="small" sx={{ ...fieldSx, mb: 1 }}>
                  <InputLabel>Líder</InputLabel>
                  <Select
                    label="Líder"
                    value={liderPick}
                    onChange={(e) => setLiderPick(e.target.value)}
                    MenuProps={selectMenuProps}
                  >
                    <MenuItem value="">Sin líder</MenuItem>
                    {selected.miembros.map((m) => (
                      <MenuItem key={m.user_id} value={m.user_id}>
                        {m.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  onClick={guardarLider}
                  disabled={busy || (liderPick || "") === (selected.lider_user_id || "")}
                  sx={{ color: C.accent, textTransform: "none", mb: 3 }}
                >
                  Guardar líder
                </Button>

                <Typography sx={{ color: C.muted, fontSize: "0.8rem", mb: 1 }}>
                  Integrantes
                </Typography>
                {selected.miembros.length === 0 && (
                  <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 1 }}>
                    Nadie en este equipo.
                  </Typography>
                )}
                {selected.miembros.map((m) => (
                  <Box
                    key={m.user_id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 1,
                      borderBottom: 1, borderColor: C.line,
                    }}
                  >
                    <Typography sx={{ color: C.text }}>{m.full_name}</Typography>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => quitarIntegrante(m.user_id)}
                      sx={{ color: C.danger, textTransform: "none", minWidth: 0 }}
                    >
                      Quitar
                    </Button>
                  </Box>
                ))}

                <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "flex-start" }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel>Agregar</InputLabel>
                    <Select
                      label="Agregar"
                      value={addPick}
                      onChange={(e) => setAddPick(e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      {disponibles.map((t) => (
                        <MenuItem key={t.user_id} value={t.user_id}>
                          {t.full_name}
                          {t.equipo ? ` (${t.equipo})` : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    onClick={agregarIntegrante}
                    disabled={busy || !addPick}
                    sx={{
                      color: C.bg,
                      bgcolor: C.accent,
                      borderRadius: 0,
                      textTransform: "none",
                      whiteSpace: "nowrap",
                      "&:hover": { bgcolor: C.accent, opacity: 0.9 },
                    }}
                  >
                    Agregar
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Typography sx={{ color: C.muted, mb: 1 }}>
                  Líder: {selected.lider_nombre || "—"}
                </Typography>
                {selected.miembros.map((m) => (
                  <Typography
                    key={m.user_id}
                    sx={{
                      color: C.text,
                      py: 1,
                      borderBottom: 1, borderColor: C.line,
                    }}
                  >
                    {m.full_name}
                  </Typography>
                ))}
              </>
            )}
          </Box>
        )}
      </Box>

      <Dialog
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>Nuevo equipo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="Nombre"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            fullWidth
            autoFocus
            sx={{ ...fieldSx, mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setNuevoOpen(false)}
            sx={{ color: C.muted, textTransform: "none" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={crearEquipo}
            disabled={busy || !nuevoNombre.trim()}
            sx={{ color: C.accent, textTransform: "none" }}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
