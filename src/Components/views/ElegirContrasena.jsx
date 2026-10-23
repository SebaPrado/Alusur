import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

export default function ElegirContrasena() {
  const { session, status } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mustChange =
    session?.user?.app_metadata?.must_change_password === true;

  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!mustChange) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw new Error(updErr.message);

      const { data, error: fnErr } = await supabase.functions.invoke(
        "admin-users",
        { body: { action: "clear_must_change_password" } },
      );
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

      await supabase.auth.refreshSession();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "No se pudo guardar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400, borderRadius: 0 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          Elegí tu contraseña
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Es tu primer ingreso. Elegí una contraseña nueva para seguir.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Nueva contraseña"
            type="password"
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <TextField
            label="Repetí la contraseña"
            type="password"
            fullWidth
            required
            margin="normal"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 0 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, borderRadius: 0 }}
            disabled={busy}
          >
            {busy ? <CircularProgress size={24} color="inherit" /> : "Guardar"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
