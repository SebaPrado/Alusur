import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Menu, MenuItem, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthProvider";
import { destinoAlCambiarOrg, mostrarSelectorOrganizacion } from "./organizacion";
import { useOrganizacion } from "./OrganizacionProvider";

const botonSx = {
  appearance: "none",
  border: 0,
  m: 0,
  p: 0,
  background: "transparent",
  color: "text.primary",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 600,
  fontSize: "0.875rem",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  minWidth: 0,
  maxWidth: { xs: 160, sm: 280 },
};

/**
 * Nombre de la organización activa. Con más de una, menú para cambiarla.
 * La plataforma busca por nombre.
 */
export default function OrgSwitcher({ soloSiHayVarias = false }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { organizaciones, orgActiva, plataforma, setOrgActiva } = useOrganizacion();
  const [anchor, setAnchor] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const esObrero = Boolean(profile?.is_worker);
  const mostrar = mostrarSelectorOrganizacion({ organizaciones, esObrero });

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!plataforma || !q) return organizaciones;
    return organizaciones.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [organizaciones, plataforma, busqueda]);

  if (!orgActiva) return null;
  if (!mostrar && soloSiHayVarias) return null;

  function elegir(org) {
    setAnchor(null);
    setBusqueda("");
    if (!org || org.id === orgActiva.id) return;
    setOrgActiva(org.id);
    navigate(destinoAlCambiarOrg({ org, esObrero: false }));
  }

  if (!mostrar) {
    return (
      <Typography
        component="span"
        noWrap
        sx={{ fontWeight: 600, fontSize: "0.875rem", minWidth: 0 }}
      >
        {orgActiva.nombre}
      </Typography>
    );
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-label="Cambiar de organización"
        sx={botonSx}
      >
        <Box
          component="span"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {orgActiva.nombre}
        </Box>
        <Box component="span" aria-hidden sx={{ flexShrink: 0, fontSize: "0.7em" }}>
          ▾
        </Box>
      </Box>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => {
          setAnchor(null);
          setBusqueda("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {plataforma && (
          <MenuItem
            disableRipple
            sx={{ "&:hover": { bgcolor: "transparent" }, cursor: "default" }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TextField
              size="small"
              placeholder="Buscar organización"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
              fullWidth
            />
          </MenuItem>
        )}
        {visibles.length === 0 && (
          <MenuItem disabled>Ninguna coincide</MenuItem>
        )}
        {visibles.map((org) => (
          <MenuItem
            key={org.id}
            selected={org.id === orgActiva.id}
            onClick={() => elegir(org)}
          >
            {org.nombre}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function ItemPlataforma({ onPick }) {
  const { plataforma } = useOrganizacion();
  const navigate = useNavigate();
  if (!plataforma) return null;
  return (
    <MenuItem
      onClick={() => {
        onPick?.();
        navigate("/plataforma");
      }}
    >
      Plataforma
    </MenuItem>
  );
}
