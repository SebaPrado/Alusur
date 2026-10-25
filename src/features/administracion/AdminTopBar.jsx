import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { formatDateTime, isRateStale } from "./money";
import { rpcErrorMessage } from "./rpcError";
import { useAdminToast } from "./toast";

export const ADMIN_TOPBAR_HEIGHT = 48;

export default function AdminTopBar({ terminalName, rate, onRateSaved }) {
  const { organizationId, organizationName, displayName, role, isManager } =
    useAdminOrg();
  const { showError, showSuccess } = useAdminToast();
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
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          overflowX: "auto",
        }}
      >
        <Typography
          component={RouterLink}
          to="/"
          sx={{
            fontWeight: 700,
            color: "primary.main",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Alusur
        </Typography>
        <Typography variant="body2" noWrap sx={{ flexShrink: 0 }}>
          {organizationName}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {terminalName ?? "Sin terminal"}
          {isManager && (
            <>
              {" · "}
              <Typography
                component={RouterLink}
                to="/administracion/terminal"
                variant="body2"
                sx={{ color: "primary.main" }}
              >
                {terminalName ? "Cambiar" : "Asignar"}
              </Typography>
            </>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {displayName}
          {role ? ` · ${role}` : ""}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: stale ? "error.main" : "text.primary",
              fontWeight: stale ? 700 : 500,
            }}
          >
            {rate
              ? `U$S 1 = $ ${Number(rate.rate).toLocaleString("es-UY", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })} · ${formatDateTime(rate.valid_from)}`
              : "Sin cotización"}
          </Typography>
          {isManager && (
            <Button size="small" onClick={() => setRateDialog(true)}>
              Nueva
            </Button>
          )}
        </Box>
      </Box>

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
