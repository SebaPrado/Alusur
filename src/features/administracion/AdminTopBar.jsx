import React, { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Popper,
  TextField,
  Typography,
} from "@mui/material";
import { FiEdit2 } from "react-icons/fi";
import { useAuth } from "../../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatDateTime, formatRateLabel, isRateStale } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { rateToTenThousandths } from "./saleMath";
import { writeTerminalId } from "./storage";
import { useAdminToast } from "./toast";

export const ADMIN_TOPBAR_HEIGHT = 48;
/** Mismo aire a los costados en la barra y en el cuerpo. */
export const ADMIN_GUTTER = { xs: 2, sm: 3, md: 5 };

const ROLE_LABEL = {
  dueno: "Dueño",
  admin: "Admin",
  vendedor: "Vendedor",
};

/** Misma caja tipográfica para la terminal y la cotización. */
const headerValueSx = {
  flexShrink: 0,
  color: "text.primary",
  fontFamily: "inherit",
  fontSize: "0.875rem",
  fontWeight: 500,
  lineHeight: 1.43,
  letterSpacing: "0.01071em",
};

function CajaSwitcher({ name, terminalId, onChanged }) {
  const { organizationId, isManager } = useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [terminals, setTerminals] = useState([]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!isManager || !organizationId) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("admin_terminals")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (error) {
        showError(rpcErrorMessage(error));
        setTerminals([]);
        return;
      }
      setTerminals(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isManager, organizationId, showError]);

  function cancelClose() {
    clearTimeout(closeTimer.current);
  }

  function armClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }

  function choose(id) {
    setOpen(false);
    if (id === terminalId) return;
    writeTerminalId(id);
    showSuccess("Terminal asignada a esta PC");
    onChanged?.();
  }

  const label = name ?? "Sin terminal";

  if (!isManager) {
    return (
      <Typography variant="body2" noWrap sx={headerValueSx}>
        {label}
      </Typography>
    );
  }

  return (
    <>
      <Typography
        ref={anchorRef}
        component="button"
        type="button"
        variant="body2"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={armClose}
        onClick={() => setOpen(true)}
        sx={{
          ...headerValueSx,
          alignSelf: "stretch",
          display: "inline-flex",
          alignItems: "center",
          m: 0,
          p: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        sx={{ zIndex: 1300 }}
      >
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper
            onMouseEnter={cancelClose}
            onMouseLeave={armClose}
            sx={{
              position: "relative",
              minWidth: 180,
              borderRadius: 0,
              border: 1,
              borderColor: "divider",
              py: 0.5,
              "&::before": {
                content: '""',
                position: "absolute",
                top: -10,
                left: 0,
                right: 0,
                height: 10,
              },
            }}
          >
            {terminals.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                No hay cajas
              </Typography>
            ) : (
              terminals.map((t) => (
                <MenuItem
                  key={t.id}
                  selected={t.id === terminalId}
                  onClick={() => choose(t.id)}
                >
                  {t.name}
                </MenuItem>
              ))
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}

export default function AdminTopBar({
  terminalName,
  terminalId,
  rate,
  onRateSaved,
  onTerminalChanged,
}) {
  const { organizationId, organizationName, displayName, role, isManager } =
    useAdminOrg();
  const { signOut } = useAuth();
  const { showError, showSuccess } = useAdminToast();
  const [userMenu, setUserMenu] = useState(null);
  const [rateDialog, setRateDialog] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveRate() {
    const n = Number(String(rateInput).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      showError("Cotización inválida");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_exchange_rate", {
      p_organization_id: organizationId,
      p_rate: n,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    showSuccess("Cotización actualizada");
    setRateDialog(false);
    setRateInput("");
    onRateSaved?.();
  }

  const stale = isRateStale(rate?.valid_from);
  const rateTt = rate?.rate == null ? null : rateToTenThousandths(rate.rate);
  const rateLabel = rateTt != null ? `U$S 1 = ${formatRateLabel(rateTt)}` : null;
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <>
      <Box
        component="header"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          height: ADMIN_TOPBAR_HEIGHT,
          px: ADMIN_GUTTER,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          overflowX: "auto",
        }}
      >
        <Box
          component={RouterLink}
          to="/"
          aria-label="Inicio"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
            lineHeight: 0,
          }}
        >
          <Box
            component="img"
            src="/iconv4.png"
            alt=""
            sx={{ display: "block", height: 18, width: "auto", opacity: 0.45 }}
          />
        </Box>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
          {organizationName}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 16 }} />
        <CajaSwitcher
          name={terminalName}
          terminalId={terminalId}
          onChanged={onTerminalChanged}
        />
        <Typography
          variant="body2"
          noWrap
          title={rate?.valid_from ? formatDateTime(rate.valid_from) : undefined}
          sx={{
            ...headerValueSx,
            ...(stale ? { color: "error.main", fontWeight: 700 } : null),
          }}
        >
          {rateLabel ?? "Sin cotización"}
        </Typography>
        {isManager && (
          <IconButton
            size="small"
            aria-label="Editar cotización"
            onClick={() => setRateDialog(true)}
            sx={{ flexShrink: 0, color: "text.secondary" }}
          >
            <FiEdit2 size={16} />
          </IconButton>
        )}
        <Divider orientation="vertical" flexItem sx={{ my: 1.25 }} />
        <Box
          component="button"
          type="button"
          aria-label="Menú de usuario"
          aria-haspopup="menu"
          aria-expanded={Boolean(userMenu)}
          title={roleLabel ? `${displayName} · ${roleLabel}` : displayName}
          onClick={(e) => setUserMenu(e.currentTarget)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            m: 0,
            p: 0,
            border: 0,
            background: "transparent",
            color: "#f2f4f7",
            font: "inherit",
            fontSize: "0.8125rem",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "normal",
            cursor: "pointer",
            opacity: 0.88,
            minWidth: 0,
            flexShrink: 1,
            "&:hover": { opacity: 1 },
          }}
        >
          <Box
            component="img"
            src="/usuario.png"
            alt=""
            width={22}
            height={22}
            sx={{
              display: "block",
              width: 22,
              height: 22,
              objectFit: "contain",
              flexShrink: 0,
              opacity: 0.9,
            }}
          />
          <Box
            component="span"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              maxWidth: { xs: 96, sm: 180 },
            }}
          >
            {displayName}
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={userMenu}
        open={Boolean(userMenu)}
        onClose={() => setUserMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem disabled sx={{ opacity: "1 !important", cursor: "default" }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {displayName}
            </Typography>
            {roleLabel && (
              <Typography variant="caption" color="text.secondary">
                {roleLabel}
              </Typography>
            )}
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserMenu(null);
            signOut();
          }}
        >
          Cerrar sesión
        </MenuItem>
      </Menu>

      <Dialog
        open={rateDialog}
        onClose={() => setRateDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Nueva cotización</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Pesos por 1 dólar (UYU por USD).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Cotización"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            inputProps={{ inputMode: "decimal" }}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateDialog(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveRate} disabled={busy}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
