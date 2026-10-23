import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { PageActionsSlot } from "./PageActions";

export const PAGE_HEADER_HEIGHT = 44;

/** 16 px móvil / 24 px desktop */
export const pagePadX = { xs: 2, md: 3 };

/**
 * Fila de 44 px: pestañas o título a la izquierda, acciones a la derecha.
 * @param {{
 *   title?: string,
 *   base?: string,
 *   tabs?: Array<{ path: string, label: string }>,
 *   end?: React.ReactNode,
 * }} props
 */
export default function PageHeader({ title, base, tabs, end = null }) {
  const location = useLocation();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        gap: 2,
        height: PAGE_HEADER_HEIGHT,
        minHeight: PAGE_HEADER_HEIGHT,
        px: pagePadX,
        borderBottom: 1,
        borderColor: "divider",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          gap: 2.5,
          minWidth: 0,
          overflowX: "auto",
        }}
      >
        {tabs?.length
          ? tabs.map((tab) => {
              const to = `${base}/${tab.path}`;
              const active = location.pathname.includes(`/${tab.path}`);
              return (
                <Typography
                  key={tab.path}
                  component={RouterLink}
                  to={to}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    textDecoration: "none",
                    color: active ? "primary.main" : "text.secondary",
                    borderBottom: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {tab.label}
                </Typography>
              );
            })
          : title && (
              <Typography
                component="h1"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "1.125rem",
                  lineHeight: 1,
                }}
              >
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
        }}
      >
        <PageActionsSlot />
        {end}
      </Box>
    </Box>
  );
}
