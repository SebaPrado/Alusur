import React from "react";
import { useNavigate } from "react-router-dom";
import {
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

export default function ElegirObra() {
  const { availableObras, setObraActiva } = useAuth();
  const navigate = useNavigate();

  function choose(id) {
    setObraActiva(id);
    navigate("/", { replace: true });
  }

  return (
    <Paper sx={{ p: 3, maxWidth: 520 }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Elige una obra
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Perteneces a varias obras. La elegida se recordará en este dispositivo.
      </Typography>
      <List>
        {availableObras.map((o) => (
          <ListItemButton key={o.id} onClick={() => choose(o.id)} divider>
            <ListItemText
              primary={o.nombre}
              secondary={
                [o.ubicacion, o.role].filter(Boolean).join(" · ") || null
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
