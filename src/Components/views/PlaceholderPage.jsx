import React from "react";
import { Alert, Paper, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

/**
 * Pantalla hueco para los pasos 2–6.
 * Si el menú no lista esta ruta para el rol actual, se muestra una nota
 * (no se redirige: la seguridad la impone la RLS).
 */
export default function PlaceholderPage({ title, paso, menuVisible }) {
  const { obraActiva, isCeo, profile } = useAuth();
  const role = obraActiva?.role ?? (isCeo ? "ceo" : null);
  const visible = typeof menuVisible === "function" ? menuVisible({ role, isCeo, profile }) : true;

  return (
    <Paper sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" paragraph>
        Paso {paso} — esta pantalla se llenará en el siguiente trabajo.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Obra: {obraActiva?.nombre ?? "ninguna"} · Rol: {role ?? "—"}
      </Typography>
      {!visible && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Esta ruta no está en el menú de tu rol. La pantalla se monta igual; la
          base de datos no devolverá datos ni permitirá escribir si no tienes
          permiso (RLS).
        </Alert>
      )}
    </Paper>
  );
}
