import React, { useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { writeNavCollapsed } from "../../obras/storage";
import { ObraNavProvider } from "../../features/obra/ObraNavContext";
import { supabase } from "../../lib/supabase";
import { NavToggleIcon, SECTION_BAR_HEIGHT } from "../../features/obra/PageHeader";
import TopBar, { BAR_HEIGHT } from "./TopBar";

const DRAWER_WIDTH = 200;
const NAV_TRANSITION = "width 150ms ease, margin 150ms ease";

/** Estado de incidencias pendientes según el rol (count, sin traer filas). */
function incidenciasEstadoParaRol(mi_rol) {
  if (controlTotalEnObra(mi_rol) || mi_rol === "superadmin") return "en_revision";
  if (mi_rol === "admin") return "abierta";
  return null;
}

function useIncidenciasPendientes(obraId, mi_rol) {
  const [count, setCount] = useState(0);
  const estado = incidenciasEstadoParaRol(mi_rol);

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
  const { obraId, mi_rol, can } = useObra();
  const role = mi_rol;
  const controlTotal = controlTotalEnObra(role);
  // Misma base que la ruta viva (`/construccion/obra/...`). Links a `/obra/...`
  // disparan LegacyToConstruccion, remontan ObraLayout y reabren el sidebar.
  const base = `/construccion/obra/${obraId}`;
  const items = [];

  items.push({
    to: `${base}/progreso/torre`,
    label: "Progreso",
    match: "/progreso",
    iconSrc: "/calendario.png",
  });

  if (role === "owner" && !controlTotal) {
    items.push({
      to: `${base}/resumen`,
      label: "Resumen",
      match: "/resumen",
      iconSrc: "/calendario.png",
    });
  }

  if (controlTotal || role !== "owner") {
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
    controlTotal ||
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

function NavItemLabel({ item, selected }) {
  return (
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
  );
}

const navItemSx = {
  py: 0,
  height: SECTION_BAR_HEIGHT,
  bgcolor: "transparent",
  "&.Mui-selected": { bgcolor: "transparent" },
  "&.Mui-selected:hover": { bgcolor: "rgba(36, 149, 150, 0.06)" },
  "&:hover": { bgcolor: "rgba(36, 149, 150, 0.06)" },
};

function NavList({ onNavigate, onCollapse, incidenciasCount }) {
  const items = useObraNavItems(incidenciasCount);
  const location = useLocation();

  return (
    <List sx={{ py: 1 }}>
      {items.map((item, index) => {
        const selected = location.pathname.includes(item.match);
        const firstWithCollapse = index === 0 && onCollapse;

        if (firstWithCollapse) {
          return (
            <Box
              key={item.to}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                pr: 0.5,
                borderLeft: 3,
                borderColor: selected ? "primary.main" : "transparent",
              }}
            >
              <ListItemButton
                component={RouterLink}
                to={item.to}
                selected={selected}
                onClick={() => onNavigate?.(item)}
                sx={{ ...navItemSx, flex: 1, minWidth: 0, pl: 2, borderLeft: 0 }}
              >
                <ListItemText
                  primary={<NavItemLabel item={item} selected={selected} />}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: selected ? 600 : 400,
                    color: selected ? "text.primary" : "text.secondary",
                    component: "div",
                  }}
                />
              </ListItemButton>
              <IconButton
                size="small"
                aria-label="Cerrar menú"
                onClick={onCollapse}
                sx={{
                  p: 0.75,
                  borderRadius: 0,
                  color: "text.secondary",
                  flexShrink: 0,
                  "&:hover": {
                    color: "text.primary",
                    bgcolor: "rgba(36, 149, 150, 0.06)",
                  },
                }}
              >
                <NavToggleIcon />
              </IconButton>
            </Box>
          );
        }

        return (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={selected}
            onClick={() => onNavigate?.(item)}
            sx={{
              ...navItemSx,
              pl: 2,
              borderLeft: 3,
              borderColor: selected ? "primary.main" : "transparent",
            }}
          >
            <ListItemText
              primary={<NavItemLabel item={item} selected={selected} />}
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
  // Al entrar a una obra (p. ej. desde /) el sidebar arranca abierto.
  const [navCollapsed, setNavCollapsed] = useState(false);
  const { loadError } = useAuth();
  const { mi_rol, ready, known, obraId: ctxObraId } = useObra();
  const { obraId } = useParams();
  const incidenciasCount = useIncidenciasPendientes(ctxObraId ?? obraId, mi_rol);

  const desktopOpen = !navCollapsed;
  const navWidth = desktopOpen ? DRAWER_WIDTH : 0;

  function setCollapsed(next) {
    setNavCollapsed(next);
    writeNavCollapsed(next);
  }

  function handleNavButton() {
    if (isNarrow) {
      setMobileOpen(true);
      return;
    }
    setCollapsed(!navCollapsed);
  }

  function handleSidebarNavigate() {
    setMobileOpen(false);
    if (!isNarrow) setCollapsed(true);
  }

  function handleCollapseSidebar() {
    setMobileOpen(false);
    if (!isNarrow) setCollapsed(true);
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
        onNavigate={handleSidebarNavigate}
        onCollapse={handleCollapseSidebar}
        incidenciasCount={incidenciasCount}
      />
    </Box>
  );

  return (
    <ObraNavProvider
      collapsed={navCollapsed}
      setCollapsed={setCollapsed}
      toggleNav={handleNavButton}
    >
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <TopBar showObraSwitcher mi_rol={mi_rol} />

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
                minWidth: 0,
                boxSizing: "border-box",
                bgcolor: "background.default",
                borderRight: navWidth ? 1 : 0,
                borderColor: "divider",
                backgroundImage: "none",
                overflow: "hidden",
                transition: NAV_TRANSITION,
              },
            }}
          >
            <Box
              sx={{
                width: DRAWER_WIDTH,
                minWidth: desktopOpen ? DRAWER_WIDTH : 0,
              }}
            >
              {drawer}
            </Box>
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
    </ObraNavProvider>
  );
}
