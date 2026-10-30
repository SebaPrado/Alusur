import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
} from "@mui/material";
import { FiChevronDown, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import NuevoMiembroDialog from "./NuevoMiembroDialog";
import { useAdminToast } from "./toast";

const ROLE_LABEL = {
  dueno: "Dueño",
  admin: "Admin",
  vendedor: "Vendedor",
};

const ROLE_OPTIONS = ["dueno", "admin", "vendedor"];

const ROLE_HELP = [
  {
    role: "Dueño",
    text: "Operación completa, datos de la organización y este equipo.",
  },
  {
    role: "Admin",
    text: "Productos, cajas, cotización, turnos de todos, stock y anulaciones. No cambia el equipo.",
  },
  {
    role: "Vendedor",
    text: "Ventas, cobranzas y clientes. Ve solo sus cajas.",
  },
];

function supabaseErrorMessage(error) {
  if (!error) return "Error desconocido";
  const msg = String(error.message ?? "").trim();
  return msg || "Error desconocido";
}

export default function EquipoPage() {
  const { user } = useAuth();
  const { organizationId, canManageMembers } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [credencial, setCredencial] = useState(null);
  const [avisoExistia, setAvisoExistia] = useState(null);

  const [rolDlg, setRolDlg] = useState(null);
  const [rolPick, setRolPick] = useState("");
  const [bajaDlg, setBajaDlg] = useState(null);
  const [reactivarDlg, setReactivarDlg] = useState(null);
  const [eliminarDlg, setEliminarDlg] = useState(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc("admin_list_members", {
      p_organization_id: organizationId,
    });
    if (error) {
      setLoadError(supabaseErrorMessage(error));
      setRows([]);
    } else {
      setLoadError(null);
      setRows(data ?? []);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canManageMembers) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Sin acceso. Solo el dueño (o el CEO) puede gestionar el equipo.
        </Typography>
      </Box>
    );
  }

  async function confirmCambioRol() {
    if (!rolDlg || !rolPick) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_set_member_role", {
        p_organization_id: organizationId,
        p_user_id: rolDlg.user_id,
        p_role: rolPick,
      });
      if (error) throw error;
      setRolDlg(null);
      showSuccess("Rol actualizado");
      await load();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      setActionError(msg);
      showError(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmBaja() {
    if (!bajaDlg) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_set_member_active", {
        p_organization_id: organizationId,
        p_user_id: bajaDlg.user_id,
        p_active: false,
      });
      if (error) throw error;
      setBajaDlg(null);
      showSuccess("Miembro dado de baja");
      await load();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      setActionError(msg);
      showError(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmEliminar() {
    if (!eliminarDlg) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_delete_member", {
        p_organization_id: organizationId,
        p_user_id: eliminarDlg.user_id,
      });
      if (error) throw error;
      setEliminarDlg(null);
      showSuccess("Miembro eliminado");
      await load();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      setActionError(msg);
      showError(msg);
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmReactivar() {
    if (!reactivarDlg) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("admin_set_member_active", {
        p_organization_id: organizationId,
        p_user_id: reactivarDlg.user_id,
        p_active: true,
      });
      if (error) throw error;
      setReactivarDlg(null);
      showSuccess("Miembro reactivado");
      await load();
    } catch (e) {
      const msg = supabaseErrorMessage(e);
      setActionError(msg);
      showError(msg);
    } finally {
      setActionBusy(false);
    }
  }

  const counterLabel = loading
    ? "Cargando…"
    : loadError
      ? "Error al cargar"
      : `${rows.length} miembro${rows.length === 1 ? "" : "s"}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box sx={{ display: "flex", gap: 1, py: 1, alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {counterLabel}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" onClick={() => setNuevoOpen(true)}>
          + Nuevo miembro
        </Button>
      </Box>

      <Box sx={{ mb: 1 }}>
        <Button
          size="small"
          onClick={() => setRolesOpen((open) => !open)}
          aria-expanded={rolesOpen}
          endIcon={
            <FiChevronDown
              size={14}
              style={{
                transform: rolesOpen ? "rotate(180deg)" : undefined,
                transition: "transform 150ms ease",
              }}
            />
          }
          sx={{
            px: 0,
            minWidth: 0,
            color: "text.secondary",
            fontWeight: 500,
            fontSize: 12,
            textTransform: "none",
            "&:hover": { bgcolor: "transparent", color: "text.primary" },
          }}
        >
          Permisos por rol (fijos)
        </Button>
        <Collapse in={rolesOpen}>
          <Box
            sx={{
              mt: 0.5,
              mb: 0.5,
              px: 1.5,
              py: 1,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            {ROLE_HELP.map((h) => (
              <Typography key={h.role} variant="body2" sx={{ fontSize: 12.5, lineHeight: 1.45 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {h.role}:
                </Box>{" "}
                {h.text}
              </Typography>
            ))}
          </Box>
        </Collapse>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 1.5, borderRadius: 0 }}>
          {loadError}
        </Alert>
      )}

      {actionError && (
        <Alert
          severity="error"
          sx={{ mb: 1.5, borderRadius: 0 }}
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      )}

      {avisoExistia && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {avisoExistia}
        </Typography>
      )}

      {loadError ? null : (
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table stickyHeader size="small" sx={{ "& td, & th": { fontSize: 13 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No hay miembros en esta organización.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => {
                const isSelf = row.user_id === user?.id;
                const canEdit = !isSelf;
                return (
                  <TableRow
                    key={row.user_id}
                    hover
                    sx={{ opacity: row.active ? 1 : 0.55 }}
                  >
                    <TableCell>{row.display_name || "—"}</TableCell>
                    <TableCell sx={{ wordBreak: "break-all" }}>
                      {row.email || "—"}
                    </TableCell>
                    <TableCell>{ROLE_LABEL[row.role] ?? row.role}</TableCell>
                    <TableCell>{row.active ? "Activo" : "Baja"}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {canEdit && (
                        <>
                          <IconButton
                            size="small"
                            aria-label="Cambiar rol"
                            title="Cambiar rol"
                            onClick={() => {
                              setRolPick(
                                ROLE_OPTIONS.includes(row.role)
                                  ? row.role
                                  : "vendedor",
                              );
                              setRolDlg(row);
                            }}
                          >
                            <FiEdit2 size={16} />
                          </IconButton>
                          {row.active ? (
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Dar de baja"
                              title="Dar de baja"
                              onClick={() => setBajaDlg(row)}
                            >
                              <FiTrash2 size={16} />
                            </IconButton>
                          ) : (
                            <>
                              <Button
                                size="small"
                                onClick={() => setReactivarDlg(row)}
                              >
                                Reactivar
                              </Button>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label="Eliminar"
                                title="Eliminar"
                                onClick={() => setEliminarDlg(row)}
                              >
                                <FiTrash2 size={16} />
                              </IconButton>
                            </>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <NuevoMiembroDialog
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreated={({ fullName, email, temporaryPassword, existed }) => {
          setAvisoExistia(null);
          setActionError(null);
          if (existed) {
            setAvisoExistia(
              `${fullName || email} ya tenía cuenta. Quedó en la organización; no hay contraseña nueva.`,
            );
          } else if (temporaryPassword) {
            setCredencial({
              fullName,
              email,
              password: temporaryPassword,
            });
          }
          load();
        }}
      />

      <Dialog
        open={Boolean(credencial)}
        onClose={() => setCredencial(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Contraseña temporal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {credencial?.fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {credencial?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Mostrada una sola vez
          </Typography>
          <Typography
            sx={{
              fontFamily: "monospace",
              fontSize: "1.15rem",
              fontWeight: 600,
              letterSpacing: 1,
              wordBreak: "break-all",
              my: 1,
            }}
          >
            {credencial?.password}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            En el primer ingreso le va a pedir elegir una contraseña nueva.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCredencial(null)}>
            Listo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(rolDlg)}
        onClose={() => setRolDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Cambiar rol · {rolDlg?.display_name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Rol</InputLabel>
            <Select
              label="Rol"
              value={rolPick}
              onChange={(e) => setRolPick(e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRolDlg(null)} disabled={actionBusy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={confirmCambioRol}
            disabled={actionBusy || !rolPick}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(bajaDlg)}
        onClose={() => setBajaDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Dar de baja</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Damos de baja a <strong>{bajaDlg?.display_name}</strong>? Queda el
            historial.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBajaDlg(null)} disabled={actionBusy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmBaja}
            disabled={actionBusy}
          >
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(eliminarDlg)}
        onClose={() => setEliminarDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Eliminar para siempre</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Eliminamos a <strong>{eliminarDlg?.display_name}</strong> del
            equipo? No se puede reactivar: para volver hay que darlo de alta
            de nuevo. Las ventas y cajas quedan, pero su nombre deja de
            mostrarse en el libro.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEliminarDlg(null)} disabled={actionBusy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmEliminar}
            disabled={actionBusy}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reactivarDlg)}
        onClose={() => setReactivarDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reactivar</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Reactivamos a <strong>{reactivarDlg?.display_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReactivarDlg(null)} disabled={actionBusy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={confirmReactivar}
            disabled={actionBusy}
          >
            Reactivar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
