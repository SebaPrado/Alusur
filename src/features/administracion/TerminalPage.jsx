import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organizationId) return;
      setLoading(true);
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
      } else {
        setTerminals(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, showError]);

  if (ready && !isManager) {
    return <Navigate to="/administracion" replace />;
  }

  function choose(id) {
    writeTerminalId(id);
    showSuccess("Terminal asignada a esta PC");
    navigate("/administracion", { replace: true });
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
          Terminal de esta PC
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Solo dueño o admin pueden asignar o cambiar la terminal. El vendedor
          la ve fija en la barra.
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : terminals.length === 0 ? (
          <Typography color="text.secondary">
            No hay terminales activas. Creálas en la base antes de operar.
          </Typography>
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
