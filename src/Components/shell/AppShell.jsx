import React, { useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";

const DRAWER_WIDTH = 260;

function useNavItems() {
  const { isCeo, can, obraActiva } = useAuth();
  const role = obraActiva?.role;

  const items = [];

  if (isCeo) {
    items.push({ to: "/obras", label: "Obras" });
  }

  if (isCeo || can("members.manage")) {
    items.push({ to: "/equipo", label: "Equipo y logística" });
  }

  if (isCeo || can("incidencia.revisar")) {
    items.push({ to: "/incidencias", label: "Incidencias" });
  }

  if (role === "obrero") {
    items.push({ to: "/campo", label: "Campo" });
  }

  if (
    isCeo ||
    role === "owner" ||
    role === "admin" ||
    role === "superadmin"
  ) {
    items.push({ to: "/avance", label: "Avance" });
  }

  return items;
}

export default function AppShell() {
  const {
    profile,
    obraActiva,
    availableObras,
    setObraActiva,
    signOut,
    needsObraPick,
    loadError,
  } = useAuth();
  const navItems = useNavItems();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (needsObraPick && location.pathname !== "/elegir-obra") {
    return <Navigate to="/elegir-obra" replace />;
  }

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2, py: 2.5 }}>
        <Typography variant="h6" fontWeight={700} color="primary">
          ALUSUR
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {profile?.full_name || "Usuario"}
          {obraActiva?.role ? ` · ${obraActiva.role}` : ""}
        </Typography>
      </Box>
      <Divider />
      {availableObras.length > 0 && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Obra activa
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={obraActiva?.id ?? ""}
              displayEmpty
              onChange={(e) => setObraActiva(e.target.value || null)}
            >
              {availableObras.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      <Divider />
      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={location.pathname === item.to}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="outlined" color="inherit" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: "primary.main",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            sx={{ mr: 1, display: { sm: "none" } }}
            onClick={() => setMobileOpen(true)}
            aria-label="menú"
          >
            ☰
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {obraActiva?.nombre ?? "ALUSUR"}
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" }, opacity: 0.85 }}>
            {profile?.full_name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
        }}
      >
        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            No se pudo cargar el perfil o las obras: {loadError}
          </Alert>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
