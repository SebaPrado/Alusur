import React, { useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import {
  getWorkerCode,
  saveWorkerCode,
  workerLogin,
} from "../../lib/workerAuth";
import { safeInternalPath } from "../../app/authRedirect";
import { useAuth } from "../../auth/AuthProvider";

function normalizarCodigo(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export default function PinLogin() {
  const { session, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeInternalPath(location.state?.from, "/construccion");
  const [workerCode, setWorkerCode] = useState(() => getWorkerCode());
  const enrolled = Boolean(workerCode);

  const [codeInput, setCodeInput] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const codeHint = useMemo(
    () => (workerCode ? `Código en este celular: ${workerCode}` : null),
    [workerCode],
  );

  if (status === "ready" && session) {
    return <Navigate to={next} replace />;
  }

  function handleEnrolar(e) {
    e.preventDefault();
    setError("");
    const code = normalizarCodigo(codeInput);
    if (!/^W-\d{5}$/.test(code)) {
      setError("El código tiene el formato W-12345");
      return;
    }
    saveWorkerCode(code);
    setWorkerCode(code);
    setCodeInput("");
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
        setWorkerCode(null);
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
    navigate(next, { replace: true });
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

        {!enrolled ? (
          <>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Primera vez en este celular: escribí el código de tu tarjeta
              (también está en el QR).
            </Typography>
            <Box component="form" onSubmit={handleEnrolar} noValidate>
              <TextField
                label="Código (ej. W-36578)"
                fullWidth
                required
                margin="normal"
                autoFocus
                value={codeInput}
                onChange={(e) => setCodeInput(normalizarCodigo(e.target.value))}
                inputProps={{ maxLength: 7, autoCapitalize: "characters" }}
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
                disabled={codeInput.length < 7}
              >
                Guardar en este celular
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" mb={1}>
              {codeHint}
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
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
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
            <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
              <Link
                component="button"
                type="button"
                onClick={() => {
                  setWorkerCode(null);
                  setPin("");
                  setError("");
                  try {
                    localStorage.removeItem("alusur.worker_code");
                  } catch {
                    /* noop */
                  }
                }}
              >
                Cambiar de código / otro obrero
              </Link>
            </Typography>
          </>
        )}

        <Typography variant="body2" sx={{ mt: 3, textAlign: "center" }}>
          <Link component={RouterLink} to="/login" state={{ from: location.state?.from }}>
            Entrar con email
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
