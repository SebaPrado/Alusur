import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { writeTerminalId } from "./storage";
import { useAdminToast } from "./toast";
import { rpcErrorMessage } from "./rpcError";

export default function TerminalPage() {
  const { organizationId, isManager, ready } = useAdminOrg();
  const navigate = useNavigate();
  const { showError, showSuccess } = useAdminToast();
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_terminals")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name");
    if (error) {
      showError(rpcErrorMessage(error));
      setTerminals([]);
    } else {
      setTerminals(data ?? []);
    }
    setLoading(false);
  }, [organizationId, showError]);

  useEffect(() => {
    load();
  }, [load]);

  if (ready && !isManager) {
    return <Navigate to="/administracion" replace />;
  }

  function choose(id) {
    writeTerminalId(id);
    showSuccess("Caja asignada a esta PC");
    navigate("/administracion", { replace: true });
  }

  async function createCaja() {
    const n = name.trim();
    if (!n) {
      showError("Poné un nombre para la caja");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("admin_terminals").insert({
      organization_id: organizationId,
      name: n,
    });
    setCreating(false);
    if (error) {
      showError(
        error.code === "23505"
          ? "Ya hay una caja con ese nombre"
          : rpcErrorMessage(error),
      );
      return;
    }
    setName("");
    showSuccess("Caja creada");
    load();
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          Caja de esta PC
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Creá una caja y asignala a esta PC. El vendedor la ve fija en la barra.
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="Nueva caja"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createCaja();
            }}
            fullWidth
            disabled={creating}
          />
          <Button variant="contained" onClick={createCaja} disabled={creating}>
            Crear
          </Button>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : terminals.length === 0 ? (
          <Typography color="text.secondary">Todavía no hay cajas.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {terminals.map((t) => (
              <Button
                key={t.id}
                variant="outlined"
                size="large"
                onClick={() => choose(t.id)}
                sx={{ borderRadius: 0, justifyContent: "flex-start" }}
              >
                {t.name}
              </Button>
            ))}
          </Box>
        )}
        <Button
          sx={{ mt: 3 }}
          onClick={() => navigate("/administracion")}
          color="inherit"
        >
          Volver a movimientos
        </Button>
      </Paper>
    </Box>
  );
}
