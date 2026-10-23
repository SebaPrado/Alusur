import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  List,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
} from "@mui/material";
import { useMisObras } from "../../obras/MisObrasProvider";

/** Legado: el flujo actual usa `/obras`. Se mantiene por si se abre la ruta. */
export default function ElegirObra() {
  const { obras, ready } = useMisObras();
  const navigate = useNavigate();

  if (ready && obras.length === 0) {
    return <Navigate to="/sin-obras" replace />;
  }

  if (ready && obras.length === 1) {
    return <Navigate to={`/obra/${obras[0].id}`} replace />;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 520, mx: "auto" }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Elegí una obra
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Pertenecés a varias obras.
      </Typography>
      <List>
        {obras.map((o) => (
          <ListItemButton
            key={o.id}
            onClick={() => navigate(`/obra/${o.id}`)}
            divider
          >
            <ListItemText
              primary={o.nombre}
              secondary={[o.ubicacion, o.mi_rol].filter(Boolean).join(" · ") || null}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
