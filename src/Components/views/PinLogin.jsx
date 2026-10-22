import React, { useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { getWorkerCode, workerLogin } from "../../lib/workerAuth";
import { useAuth } from "../../auth/AuthProvider";

export default function PinLogin() {
  const { session, status } = useAuth();
  const navigate = useNavigate();
  const workerCode = useMemo(() => getWorkerCode(), []);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "ready" && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("El PIN tiene 4 dígitos");
      return;
    }
    setBusy(true);
    const result = await workerLogin(pin);
    setBusy(false);

    if (!result.ok) {
      if (result.reason === "not_enrolled") {
        setError("Este dispositivo no está enrolado");
      } else if (result.reason === "locked") {
        const until = result.lockedUntil
          ? new Date(result.lockedUntil).toLocaleString()
          : "";
        setError(`Demasiados intentos. Bloqueado hasta ${until}`);
      } else {
        setError("PIN incorrecto");
      }
      return;
    }
    navigate("/", { replace: true });
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
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          ALUSUR · Campo
        </Typography>

        {!workerCode ? (
          <>
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              Este dispositivo aún no está enrolado. El alta de obreros con QR
              es el paso 3 (SuperAdmin).
            </Alert>
            <Typography variant="body2" textAlign="center">
              <Link component={RouterLink} to="/login">
                Volver al login con email
              </Link>
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Código de dispositivo: <strong>{workerCode}</strong>
            </Typography>
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                label="PIN (4 dígitos)"
                type="password"
                inputMode="numeric"
                inputProps={{ maxLength: 4, pattern: "[0-9]*", inputMode: "numeric" }}
                fullWidth
                required
                margin="normal"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3 }}
                disabled={busy || pin.length !== 4}
              >
                {busy ? <CircularProgress size={24} color="inherit" /> : "Entrar"}
              </Button>
            </Box>
            <Typography variant="body2" sx={{ mt: 3, textAlign: "center" }}>
              <Link component={RouterLink} to="/login">
                Entrar con email
              </Link>
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
