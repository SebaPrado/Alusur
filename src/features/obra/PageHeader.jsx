import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Button, Divider, IconButton, Typography } from "@mui/material";
import { FiMenu } from "react-icons/fi";
import { useObraNav } from "./ObraNavContext";
import { PageActionsSlot } from "./PageActions";

/** Alto de la fila de subsecciones (= filas del sidebar). */
export const SECTION_BAR_HEIGHT = 48;

/** Compat con imports viejos. */
export const PAGE_HEADER_HEIGHT = SECTION_BAR_HEIGHT;

/** Padding con sidebar abierto. */
export const pagePadX = { xs: 2, md: 3 };

/** Más aire horizontal cuando el sidebar está cerrado. */
export const pagePadXCollapsed = { xs: 2, sm: 3, md: 5 };

/** Padding del contenido según el estado del menú lateral. */
export function usePagePadX() {
  const { collapsed } = useObraNav();
  return collapsed ? pagePadXCollapsed : pagePadX;
}

function sectionLabelFromPath(pathname) {
  if (pathname.includes("/progreso")) return "Progreso";
  if (pathname.includes("/logistica")) return "Logística";
  if (pathname.includes("/personal")) return "Personal";
  if (pathname.includes("/incidencias")) return "Incidencias";
  if (pathname.includes("/resumen")) return "Resumen";
  if (pathname.includes("/hoy")) return "Hoy";
  return null;
}

function TabIcon({ src, active }) {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      className="nav-ico"
      sx={{
        width: 16,
        height: 16,
        objectFit: "contain",
        display: "block",
        opacity: active ? 1 : 0.85,
      }}
    />
  );
}

export const tabBtnSx = {
  minHeight: 30,
  py: 0.5,
  "&.MuiButton-contained .nav-ico": { filter: "brightness(0)" },
};

/**
 * Fila de opciones: hamburguesa alineada con el logo de Inicio, luego divisor,
 * pestañas o título, y acciones a la derecha.
 * @param {{ overlay?: boolean }} props overlay = barra sobre el 3D (sin fondo propio).
 */
export default function PageHeader({
  title,
  titleIconSrc,
  base,
  tabs,
  end = null,
  maxWidth,
  overlay = false,
}) {
  const location = useLocation();
  const { collapsed, toggleNav } = useObraNav();
  const padX = usePagePadX();
  const section = sectionLabelFromPath(location.pathname);
  const showSectionCrumb = collapsed && Boolean(tabs?.length) && Boolean(section);
  const showHamburger = Boolean(toggleNav) && collapsed;

  return (
    <Box
      data-overlay-header={overlay ? "1" : undefined}
      sx={{
        height: SECTION_BAR_HEIGHT,
        minHeight: SECTION_BAR_HEIGHT,
        borderBottom: overlay ? 0 : 1,
        borderColor: "divider",
        boxSizing: "border-box",
        pl: 2,
        pr: maxWidth != null ? 0 : padX,
        display: "flex",
        alignItems: "center",
        bgcolor: "transparent",
        // Overlay: la barra no captura clics; solo los clusters interactivos.
        pointerEvents: overlay ? "none" : undefined,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          width: "100%",
          height: "100%",
          maxWidth: maxWidth ?? "none",
          mx: maxWidth != null ? "auto" : 0,
          pr: maxWidth != null ? padX : 0,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            gap: 1,
            minWidth: 0,
            pointerEvents: "auto",
          }}
        >
          {showHamburger && (
            <>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="menú"
                onClick={toggleNav}
                sx={{
                  ml: -0.75,
                  p: 0.75,
                  borderRadius: 0,
                  color: "#F2F4F7",
                  "&:hover": { bgcolor: "rgba(242, 244, 247, 0.08)" },
                }}
              >
                <FiMenu size={18} strokeWidth={1.75} aria-hidden />
              </IconButton>
              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  borderColor: "divider",
                  alignSelf: "center",
                  height: 16,
                  my: "auto",
                  mx: 0.5,
                }}
              />
            </>
          )}
          {showSectionCrumb && (
            <Typography
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                color: "text.secondary",
                fontSize: "0.875rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                mr: 0.5,
              }}
            >
              {section}
              <Box component="span" aria-hidden sx={{ color: "text.disabled" }}>
                {">"}
              </Box>
            </Typography>
          )}
          {tabs?.length
            ? tabs.map((tab) => {
                const to = `${base}/${tab.path}`;
                const active = location.pathname.includes(`/${tab.path}`);
                return (
                  <Button
                    key={tab.path}
                    size="small"
                    variant={active ? "contained" : "outlined"}
                    component={RouterLink}
                    to={to}
                    startIcon={
                      tab.iconSrc ? (
                        <TabIcon src={tab.iconSrc} active={active} />
                      ) : undefined
                    }
                    sx={tabBtnSx}
                  >
                    {tab.label}
                  </Button>
                );
              })
            : title && (
                <Typography
                  component="h1"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    lineHeight: 1,
                  }}
                >
                  {titleIconSrc ? (
                    <Box
                      component="img"
                      src={titleIconSrc}
                      alt=""
                      aria-hidden
                      sx={{
                        width: 20,
                        height: 20,
                        objectFit: "contain",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  {title}
                </Typography>
              )}
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
            pointerEvents: "auto",
          }}
        >
          <PageActionsSlot />
          {end}
        </Box>
      </Box>
    </Box>
  );
}
