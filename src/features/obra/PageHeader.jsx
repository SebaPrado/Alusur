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
 *   titleIconSrc?: string,
 *   base?: string,
 *   tabs?: Array<{ path: string, label: string, iconSrc?: string }>,
 *   end?: React.ReactNode,
 *   maxWidth?: number | string,
 * }} props
 */
export default function PageHeader({
  title,
  titleIconSrc,
  base,
  tabs,
  end = null,
  maxWidth,
}) {
  const location = useLocation();

  return (
    <Box
      sx={{
        height: PAGE_HEADER_HEIGHT,
        minHeight: PAGE_HEADER_HEIGHT,
        borderBottom: 1,
        borderColor: "divider",
        boxSizing: "border-box",
        px: maxWidth != null ? 0 : pagePadX,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          gap: 2,
          height: "100%",
          width: "100%",
          maxWidth: maxWidth ?? "none",
          mx: maxWidth != null ? "auto" : 0,
          px: maxWidth != null ? pagePadX : 0,
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
                      gap: 0.75,
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
                    {tab.iconSrc ? (
                      <Box
                        component="img"
                        src={tab.iconSrc}
                        alt=""
                        aria-hidden
                        sx={{
                          width: 18,
                          height: 18,
                          objectFit: "contain",
                          flexShrink: 0,
                          opacity: active ? 1 : 0.75,
                        }}
                      />
                    ) : null}
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
          }}
        >
          <PageActionsSlot />
          {end}
        </Box>
      </Box>
    </Box>
  );
}
