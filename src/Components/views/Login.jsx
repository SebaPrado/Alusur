import React, { useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { safeInternalPath, sectionLabel } from "../../app/authRedirect";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";

const floatingLabelProps = {
  sx: {
    "&.MuiInputLabel-shrink": {
      bgcolor: "background.paper",
      px: 0.75,
      zIndex: 1,
    },
  },
};

export default function Login() {
  const { session, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeInternalPath(location.state?.from);
  const section = sectionLabel(location.state?.from);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "ready" && session) {
    return <Navigate to={next} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : err.message);
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
          ALUSUR
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={section ? 1 : 3}>
          Acceso con email
        </Typography>
        {section && (
          <Typography variant="body2" color="text.secondary" mb={3}>
            Vas a entrar a {section}
          </Typography>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            margin="normal"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputLabelProps={floatingLabelProps}
          />
          <TextField
            label="Contraseña"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            margin="normal"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={floatingLabelProps}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                    size="small"
                    sx={{ color: "text.secondary" }}
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
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
            disabled={busy}
          >
            {busy ? <CircularProgress size={24} color="inherit" /> : "Entrar"}
          </Button>
        </Box>

        <Typography variant="body2" sx={{ mt: 3, textAlign: "center" }}>
          <Link component={RouterLink} to="/">
            Elegir otra sección
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
