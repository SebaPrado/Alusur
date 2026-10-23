import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import { PageActionsProvider } from "./PageActions";
import PageHeader, { pagePadX } from "./PageHeader";
import { BAR_HEIGHT } from "../../Components/shell/TopBar";

/**
 * Layout con pestañas como encabezado (Progreso, Logística).
 * @param {{
 *   base: string,
 *   tabs: Array<{ path: string, label: string }>,
 *   maxWidth?: number | false,
 *   fillHeight?: boolean,
 *   noPadPaths?: string[],
 * }} props
 *   maxWidth: tope del cuerpo; false = sin tope (Progreso).
 *   fillHeight: alto fijo bajo las pestañas, sin scroll de página.
 *   noPadPaths: subrutas sin padding (p. ej. "torre").
 */
export default function SectionTabs({
  base,
  tabs,
  maxWidth = 1200,
  fillHeight = false,
  noPadPaths = [],
  headerEnd = null,
}) {
  const location = useLocation();
  const bare = noPadPaths.some((p) => location.pathname.includes(`/${p}`));
  // Bajo la barra fija: el encabezado de 44 px vive dentro de este alto.
  const shellH = `calc(100vh - ${BAR_HEIGHT}px)`;

  return (
    <PageActionsProvider>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          ...(fillHeight
            ? { height: shellH, overflow: "hidden" }
            : { minHeight: shellH }),
        }}
      >
        <PageHeader base={base} tabs={tabs} end={headerEnd} />

        <Box
          sx={{
            flex: fillHeight ? 1 : undefined,
            minHeight: fillHeight ? 0 : undefined,
            // Zona bajo pestañas: calc(100vh - 48px - 44px) vía flex.
            overflow: fillHeight ? (bare ? "hidden" : "auto") : undefined,
            ...(fillHeight
              ? {
                  display: "flex",
                  flexDirection: "column",
                  minHeight: bare ? 0 : undefined,
                }
              : {}),
            ...(bare
              ? {}
              : {
                  px: pagePadX,
                  py: pagePadX,
                  ...(maxWidth === false
                    ? {}
                    : { maxWidth, width: "100%", boxSizing: "border-box" }),
                }),
          }}
        >
          <Box
            sx={{
              flex: fillHeight ? 1 : undefined,
              minHeight: fillHeight ? 0 : undefined,
              display: fillHeight ? "flex" : undefined,
              flexDirection: fillHeight ? "column" : undefined,
              width: "100%",
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </PageActionsProvider>
  );
}
