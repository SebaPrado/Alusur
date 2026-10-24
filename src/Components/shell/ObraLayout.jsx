import React, { useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { readNavCollapsed, writeNavCollapsed } from "../../obras/storage";
import { supabase } from "../../lib/supabase";
import TopBar, { BAR_HEIGHT } from "./TopBar";

const DRAWER_WIDTH = 200;
const NAV_TRANSITION = "width 150ms ease, margin 150ms ease";

/** Estado de incidencias pendientes según el rol (count, sin traer filas). */
function incidenciasEstadoParaRol(isCeo, mi_rol) {
  if (isCeo || mi_rol === "ceo" || mi_rol === "superadmin") return "en_revision";
  if (mi_rol === "admin") return "abierta";
  return null;
}

function useIncidenciasPendientes(obraId, isCeo, mi_rol) {
  const [count, setCount] = useState(0);
  const estado = incidenciasEstadoParaRol(isCeo, mi_rol);

  useEffect(() => {
    if (!obraId || !estado) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count: n, error } = await supabase
        .from("incidencias")
        .select("id", { count: "exact", head: true })
        .eq("obra_id", obraId)
        .eq("estado", estado);
      if (cancelled) return;
      if (error) {
        console.error("incidencias count:", error.message);
        setCount(0);
        return;
      }
      setCount(n ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [obraId, estado]);

  return estado ? count : 0;
}

function useObraNavItems(incidenciasCount) {
  const { isCeo } = useAuth();
  const { obraId, mi_rol, can } = useObra();
  const role = mi_rol;
  const base = `/obra/${obraId}`;
  const items = [];

  // Hoy ↔ Resumen: mutuamente excluyentes. Owner ve Resumen; el resto (y CEO) ve Hoy.
  if (role === "owner" && !isCeo) {
    items.push({
      to: `${base}/resumen`,
      label: "Resumen",
      match: "/resumen",
      iconSrc: "/calendario.png",
    });
  } else {
    items.push({
      to: `${base}/hoy`,
      label: "Hoy",
      match: "/hoy",
      iconSrc: "/calendario.png",
    });
  }

  items.push({
    to: `${base}/progreso/torre`,
    label: "Progreso",
    match: "/progreso",
    iconSrc: "/progress.png",
  });

  if (isCeo || role !== "owner") {
    items.push({
      to: `${base}/logistica/contenedores`,
      label: "Logística",
      match: "/logistica",
      iconSrc: "/contenedor.png",
    });
    items.push({
      to: `${base}/incidencias`,
      label: "Incidencias",
      match: "/incidencias",
      iconSrc: "/advertencia.png",
      badge: incidenciasCount > 0 ? incidenciasCount : null,
    });
  }

  if (
    isCeo ||
    can("members.manage") ||
    can("equipo.manage") ||
    can("maquina.manage")
  ) {
    items.push({
      to: `${base}/personal`,
      label: "Personal",
      match: "/personal",
      iconSrc: "/personal.png",
    });
  }

  return items;
}

function NavList({ onNavigate, incidenciasCount }) {
  const items = useObraNavItems(incidenciasCount);
  const location = useLocation();

  return (
    <List sx={{ py: 1 }}>
      {items.map((item) => {
        const selected = location.pathname.includes(item.match);
        return (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={selected}
            onClick={onNavigate}
            sx={{
              pl: 2,
              py: 0,
              height: 40,
              borderLeft: 3,
              borderColor: selected ? "primary.main" : "transparent",
              bgcolor: "transparent",
              "&.Mui-selected": {
                bgcolor: "transparent",
              },
              "&.Mui-selected:hover": {
                bgcolor: "rgba(36, 149, 150, 0.06)",
              },
              "&:hover": {
                bgcolor: "rgba(36, 149, 150, 0.06)",
              },
            }}
          >
            <ListItemText
              primary={
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {item.iconSrc ? (
                    <Box
                      component="img"
                      src={item.iconSrc}
                      alt=""
                      aria-hidden
                      sx={{
                        width: 18,
                        height: 18,
                        objectFit: "contain",
                        flexShrink: 0,
                        opacity: selected ? 1 : 0.75,
                      }}
                    />
                  ) : null}
                  <Box
                    component="span"
                    sx={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}
                  >
                    {item.label}
                    {item.badge != null ? (
                      <Box
                        component="span"
                        sx={{
                          color: selected ? "text.primary" : "text.secondary",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                        }}
                      >
                        {item.badge}
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              }
              primaryTypographyProps={{
                fontSize: "0.875rem",
                fontWeight: selected ? 600 : 400,
                color: selected ? "text.primary" : "text.secondary",
                component: "div",
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

/** Layout con menú lateral: `/obra/:obraId/*`. */
export default function ObraLayout() {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md")); // < 900
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed);
  const { loadError, isCeo } = useAuth();
  const { mi_rol, ready, known, obraId: ctxObraId } = useObra();
  const { obraId } = useParams();
  const incidenciasCount = useIncidenciasPendientes(ctxObraId ?? obraId, isCeo, mi_rol);

  const desktopOpen = !navCollapsed;
  const navWidth = desktopOpen ? DRAWER_WIDTH : 0;

  function handleNavButton() {
    if (isNarrow) {
      setMobileOpen(true);
      return;
    }
    setNavCollapsed((prev) => {
      const next = !prev;
      writeNavCollapsed(next);
      return next;
    });
  }

  const drawer = (
    <Box
      sx={{
        height: "100%",
        bgcolor: "background.default",
        borderRight: 1,
        borderColor: "divider",
        pt: `${BAR_HEIGHT}px`,
        overflow: "hidden",
      }}
    >
      <NavList
        onNavigate={() => setMobileOpen(false)}
        incidenciasCount={incidenciasCount}
      />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar
        showObraSwitcher
        mi_rol={mi_rol}
        onOpenNav={handleNavButton}
      />

      <Box
        component="nav"
        sx={{
          width: { md: navWidth },
          flexShrink: { md: 0 },
          transition: { md: NAV_TRANSITION },
          overflow: "hidden",
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              bgcolor: "background.default",
              borderRight: 1,
              borderColor: "divider",
              backgroundImage: "none",
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            width: navWidth,
            flexShrink: 0,
            transition: NAV_TRANSITION,
            "& .MuiDrawer-paper": {
              width: navWidth,
              boxSizing: "border-box",
              bgcolor: "background.default",
              borderRight: navWidth ? 1 : 0,
              borderColor: "divider",
              backgroundImage: "none",
              overflowX: "hidden",
              transition: NAV_TRANSITION,
            },
          }}
        >
          <Box sx={{ width: DRAWER_WIDTH, minWidth: DRAWER_WIDTH }}>{drawer}</Box>
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${navWidth}px)` },
          pt: `${BAR_HEIGHT}px`,
          minHeight: "100vh",
          minWidth: 0,
          transition: { md: NAV_TRANSITION },
        }}
      >
        {loadError && (
          <Alert severity="error" sx={{ m: 2 }}>
            No se pudo cargar el perfil: {loadError}
          </Alert>
        )}
        {ready && !known && (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              No tenés acceso a esta obra ({obraId}).
            </Typography>
          </Box>
        )}
        {(!ready || known) && <Outlet />}
      </Box>
    </Box>
  );
}
