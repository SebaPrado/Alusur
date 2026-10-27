import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import { PageActionsProvider } from "./PageActions";
import PageHeader, { usePagePadX } from "./PageHeader";
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
 *   noPadPaths: subrutas sin padding; el contenido llena el alto e invade la fila de tabs.
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
  const padX = usePagePadX();
  const bare = noPadPaths.some((p) => location.pathname.includes(`/${p}`));
  const shellH = `calc(100vh - ${BAR_HEIGHT}px)`;

  return (
    <PageActionsProvider>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          ...(fillHeight
            ? { height: shellH, overflow: "hidden" }
            : { minHeight: shellH }),
        }}
      >
        {bare ? (
          <>
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 2,
              }}
            >
              <PageHeader base={base} tabs={tabs} end={headerEnd} overlay />
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                pb: 0.5,
                boxSizing: "border-box",
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                <Outlet />
              </Box>
            </Box>
          </>
        ) : (
          <>
            <PageHeader base={base} tabs={tabs} end={headerEnd} />
            <Box
              sx={{
                flex: fillHeight ? 1 : undefined,
                minHeight: fillHeight ? 0 : undefined,
                overflow: fillHeight ? "auto" : undefined,
                ...(fillHeight
                  ? {
                      display: "flex",
                      flexDirection: "column",
                    }
                  : {}),
                px: padX,
                py: padX,
                ...(maxWidth === false
                  ? {}
                  : {
                      maxWidth,
                      width: "100%",
                      mx: "auto",
                      boxSizing: "border-box",
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
          </>
        )}
      </Box>
    </PageActionsProvider>
  );
}
