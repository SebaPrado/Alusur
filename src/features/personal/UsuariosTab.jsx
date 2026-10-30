import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { PageActions } from "../obra/PageActions";
import { C, dialogPaperSx, fieldSx, selectMenuProps } from "./theme";
import NuevoUsuarioDialog from "./NuevoUsuarioDialog";

const ROLE_LABEL = {
  superadmin: "SuperAdmin",
  admin: "Admin",
  owner: "Owner",
};

/** Rango para la UI (coincide con role_rank; owner solo lo toca quien tiene control total). */
const ROLE_RANK = {
  superadmin: 50,
  admin: 40,
  obrero: 10,
  owner: 0,
};

function rolesAsignables({ controlTotal, miRol }) {
  if (controlTotal) return ["superadmin", "admin", "owner"];
  if (miRol === "superadmin") return ["admin"];
  return [];
}

function puedeModificar({ controlTotal, miRol, myUserId, target }) {
  if (!target?.activo) return false;
  if (target.user_id === myUserId) return false;
  if (controlTotal) return true;
  if (target.role === "owner") return false;
  const callerRank = ROLE_RANK[miRol] ?? 0;
  const targetRank = ROLE_RANK[target.role] ?? 0;
  return targetRank < callerRank;
}

export default function UsuariosTab() {
  const { obraId, openEmpresas, empresasTick } = useOutletContext();
  const { user } = useAuth();
  const { can, mi_rol } = useObra();
  const controlTotal = controlTotalEnObra(mi_rol);
  const canMembers = can("members.manage");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [avisoExistia, setAvisoExistia] = useState(null);

  const [rolDlg, setRolDlg] = useState(null); // row
  const [rolPick, setRolPick] = useState("");
  const [bajaDlg, setBajaDlg] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const assignable = useMemo(
    () => rolesAsignables({ controlTotal, miRol: mi_rol }),
    [controlTotal, mi_rol],
  );

  const load = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("listar_usuarios", {
      p_obra: obraId,
    });
    if (err) setError(err.message);
    else setRows(data ?? []);
    setLoading(false);
  }, [obraId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canMembers) {
    return (
      <Typography sx={{ color: C.muted }}>Sin acceso</Typography>
    );
  }

  async function confirmCambioRol() {
    if (!rolDlg || !rolPick) return;
    setActionBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("assign_role", {
        p_obra: obraId,
        p_user: rolDlg.user_id,
        p_empresa: rolDlg.empresa_id,
        p_role: rolPick,
      });
      if (err) throw new Error(err.message);
      setRolDlg(null);
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
        <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
          {loading
            ? "Cargando…"
            : `${rows.length} administrador${rows.length === 1 ? "" : "es"}`}
        </Typography>
      </Box>

      {assignable.length > 0 && (
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
            + Nuevo usuario
          </Button>
        </PageActions>
      )}

      {error && (
        <Typography sx={{ color: C.danger, mb: 2, fontSize: "0.875rem" }}>
          {error}
        </Typography>
      )}

      {avisoExistia && (
        <Typography sx={{ color: C.muted, mb: 2, fontSize: "0.875rem" }}>
          {avisoExistia}
        </Typography>
      )}

      {!loading && rows.length === 0 && (
        <Typography sx={{ color: C.muted }}>
          No hay administradores en esta obra.
        </Typography>
      )}

      <Box>
        {rows.length > 0 && (
          <Box
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: "minmax(120px, 1.2fr) 1.3fr minmax(110px, 1fr) 90px 1fr",
              gap: 2,
              pb: 1,
              borderBottom: 1, borderColor: C.line,
            }}
          >
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Nombre
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Email
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Contraseña
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Rol
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: "0.75rem" }}>
              Empresa
            </Typography>
          </Box>
        )}
        {rows.map((row) => {
          const editable = puedeModificar({
            controlTotal,
            miRol: mi_rol,
            myUserId: user?.id,
            target: row,
          });
          return (
            <Box
              key={row.user_id}
              sx={{
                py: 1.5,
                borderBottom: 1, borderColor: C.line,
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(120px, 1.2fr) 1.3fr minmax(110px, 1fr) 90px 1fr",
                },
                gap: { xs: 0.5, md: 2 },
                alignItems: "center",
                opacity: row.activo ? 1 : 0.55,
              }}
            >
              <Typography sx={{ fontWeight: 600, color: C.text }}>
                {row.full_name || "—"}
              </Typography>
              <Typography
                sx={{
                  color: C.muted,
                  fontSize: "0.875rem",
                  wordBreak: "break-all",
                }}
              >
                {row.email || "—"}
              </Typography>
              <Typography
                sx={{
                  color: row.temp_password ? C.text : C.muted,
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  letterSpacing: row.temp_password ? 1 : 0,
                  fontWeight: row.temp_password ? 600 : 400,
                  wordBreak: "break-all",
                }}
              >
                {row.temp_password ?? "—"}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {ROLE_LABEL[row.role] ?? row.role}
                {!row.activo ? " · Baja" : ""}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: "0.875rem" }}>
                {row.empresa || "—"}
              </Typography>

              {editable && (
                <Box
                  sx={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  <ActionLink
                    onClick={() => {
                      setRolPick(
                        assignable.includes(row.role) ? row.role : assignable[0] ?? "",
                      );
                      setRolDlg(row);
                    }}
                  >
                    Cambiar rol
                  </ActionLink>
                  <ActionLink danger onClick={() => setBajaDlg(row)}>
                    Dar de baja
                  </ActionLink>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <NuevoUsuarioDialog
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        obraId={obraId}
        roles={assignable}
        onOpenEmpresas={openEmpresas}
        empresasTick={empresasTick}
        onCreated={({ fullName, email, existed }) => {
          setAvisoExistia(null);
          if (existed) {
            setAvisoExistia(
              `${fullName || email} ya tenía cuenta. Quedó en la obra; no hay contraseña nueva.`,
            );
          }
          load();
        }}
      />

      <Dialog
        open={!!rolDlg}
        onClose={() => setRolDlg(null)}
        PaperProps={{ sx: dialogPaperSx }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Cambiar rol · {rolDlg?.full_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ ...fieldSx, mt: 1 }}>
            <InputLabel>Rol</InputLabel>
            <Select
              label="Rol"
              value={rolPick}
              onChange={(e) => setRolPick(e.target.value)}
              MenuProps={selectMenuProps}
            >
              {assignable.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setRolDlg(null)}
            sx={{ color: C.muted, textTransform: "none" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmCambioRol}
            disabled={actionBusy || !rolPick}
            sx={{ color: C.accent, textTransform: "none" }}
          >
            Guardar
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
        <DialogTitle sx={{ borderBottom: 1, borderColor: C.line }}>
          Dar de baja
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ color: C.text }}>
            ¿Damos de baja a <strong>{bajaDlg?.full_name}</strong>? Queda el
            historial.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: C.line }}>
          <Button
            onClick={() => setBajaDlg(null)}
            sx={{ color: C.muted, textTransform: "none" }}
          >
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
        p: 0,
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
