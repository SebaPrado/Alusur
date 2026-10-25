import React, { useCallback, useEffect, useState } from "react";
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
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "./theme";

const TIPOS = [
  { value: "socia", label: "Socia" },
  { value: "contratada", label: "Contratada" },
];

/**
 * Solo CEO: lista empresas del catálogo y las vincula a la obra con add_empresa_to_obra.
 */
export default function VincularEmpresasDialog({ open, onClose, obraId, onChanged }) {
  const [todas, setTodas] = useState([]);
  const [vinculadas, setVinculadas] = useState({}); // empresa_id → tipo
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [nuevaNombre, setNuevaNombre] = useState("");
  const [nuevaTipo, setNuevaTipo] = useState("socia");
  const [creando, setCreando] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    const [empRes, oeRes] = await Promise.all([
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase.from("obra_empresas").select("empresa_id, tipo").eq("obra_id", obraId),
    ]);
    if (empRes.error) {
      setError(empRes.error.message);
      setLoading(false);
      return;
    }
    if (oeRes.error) {
      setError(oeRes.error.message);
      setLoading(false);
      return;
    }
    setTodas(empRes.data ?? []);
    const map = {};
    for (const r of oeRes.data ?? []) map[r.empresa_id] = r.tipo;
    setVinculadas(map);
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    if (open) {
      setNuevaNombre("");
      setNuevaTipo("socia");
      setMostrarCrear(false);
      load();
    }
  }, [open, load]);

  async function vincular(empresaId, tipo) {
    setBusyId(empresaId);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("add_empresa_to_obra", {
        p_obra: obraId,
        p_empresa: empresaId,
        p_tipo: tipo,
      });
      if (err) throw new Error(err.message);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function crearYVincular() {
    const nombre = nuevaNombre.trim();
    if (!nombre) {
      setError("Escribí el nombre de la empresa");
      return;
    }
    setCreando(true);
    setError(null);
    try {
      const { data: created, error: insErr } = await supabase
        .from("empresas")
        .insert({ nombre })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      const { error: linkErr } = await supabase.rpc("add_empresa_to_obra", {
        p_obra: obraId,
        p_empresa: created.id,
        p_tipo: nuevaTipo,
      });
      if (linkErr) throw new Error(linkErr.message);
      setNuevaNombre("");
      setMostrarCrear(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ color: C.text, borderBottom: 1, borderColor: C.line }}>
        Empresas de la obra
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ color: C.muted, fontSize: "0.875rem", mb: 2 }}>
          Los obreros se dan de alta bajo una empresa vinculada (ALUSUR, ALUMAN, etc.).
        </Typography>

        {error && (
          <Typography sx={{ color: C.danger, fontSize: "0.875rem", mb: 2 }}>{error}</Typography>
        )}

        {loading ? (
          <Typography sx={{ color: C.muted }}>Cargando…</Typography>
        ) : (
          <Box>
            {todas.length === 0 && (
              <Typography sx={{ color: C.muted }}>
                Todavía no hay empresas en el catálogo.
              </Typography>
            )}
            {todas.map((e) => {
              const tipo = vinculadas[e.id];
              const linked = !!tipo;
              return (
                <Box
                  key={e.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    py: 1.25,
                    borderBottom: 1, borderColor: C.line,
                  }}
                >
                  <Box>
                    <Typography sx={{ color: C.text, fontWeight: 600 }}>{e.nombre}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: "0.8rem" }}>
                      {linked
                        ? `Vinculada · ${tipo === "socia" ? "Socia" : "Contratada"}`
                        : "No vinculada"}
                    </Typography>
                  </Box>
                  {linked ? (
                    <Typography sx={{ color: C.accent, fontSize: "0.8rem" }}>Listo</Typography>
                  ) : (
                    <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                      <Button
                        size="small"
                        disabled={busyId === e.id}
                        onClick={() => vincular(e.id, "socia")}
                        sx={{
                          color: C.accent,
                          textTransform: "none",
                          borderRadius: 0,
                          border: 1, borderColor: C.accent,
                        }}
                      >
                        Socia
                      </Button>
                      <Button
                        size="small"
                        disabled={busyId === e.id}
                        onClick={() => vincular(e.id, "contratada")}
                        sx={{
                          color: C.muted,
                          textTransform: "none",
                          borderRadius: 0,
                          border: 1, borderColor: C.line,
                        }}
                      >
                        Contratada
                      </Button>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {!loading && (
        <Box
          sx={{
            mt: 3,
            pt: 2,
            borderTop: 1,
            borderColor: C.line,
          }}
        >
          {!mostrarCrear ? (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                onClick={() => {
                  setError(null);
                  setMostrarCrear(true);
                }}
                sx={{
                  color: C.bg,
                  bgcolor: C.accent,
                  borderRadius: 0,
                  textTransform: "none",
                  px: 2,
                  "&:hover": { bgcolor: C.accent, opacity: 0.9 },
                }}
              >
                + Crear empresa
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography sx={{ color: C.muted, fontSize: "0.8rem" }}>
                Crear empresa y vincular
              </Typography>
              <TextField
                label="Nombre"
                value={nuevaNombre}
                onChange={(ev) => setNuevaNombre(ev.target.value)}
                fullWidth
                size="small"
                sx={fieldSx}
                placeholder="Ej. ALUSUR"
                autoFocus
              />
              <FormControl fullWidth size="small" sx={fieldSx}>
                <InputLabel>Tipo</InputLabel>
                <Select
                  label="Tipo"
                  value={nuevaTipo}
                  onChange={(ev) => setNuevaTipo(ev.target.value)}
                  MenuProps={selectMenuProps}
                >
                  {TIPOS.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                <Button
                  onClick={() => {
                    setMostrarCrear(false);
                    setNuevaNombre("");
                    setNuevaTipo("socia");
                  }}
                  disabled={creando}
                  sx={{ color: C.muted, textTransform: "none", borderRadius: 0 }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={crearYVincular}
                  disabled={creando || !nuevaNombre.trim()}
                  sx={{
                    color: C.bg,
                    bgcolor: C.accent,
                    borderRadius: 0,
                    textTransform: "none",
                    px: 2,
                    "&:hover": { bgcolor: C.accent, opacity: 0.9 },
                  }}
                >
                  {creando ? "Creando…" : "Crear y vincular"}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: 1, borderColor: C.line, px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: C.text, textTransform: "none" }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
