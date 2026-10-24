import React from "react";
import { Link as RouterLink, Navigate } from "react-router-dom";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useMisObras } from "../../obras/MisObrasProvider";
import { PageActionsProvider } from "../obra/PageActions";
import PageHeader, { pagePadX } from "../obra/PageHeader";

const ROL_LABEL = {
  ceo: "CEO",
  superadmin: "SuperAdmin",
  admin: "Admin",
  owner: "Owner",
  obrero: "Obrero",
};

/** Ancho de la columna de obras (header + cards). */
const OBRAS_COL_MAX = 640;

function pct(instalados, total) {
  if (!total) return 0;
  return Math.round((instalados / total) * 100);
}

function ObraCard({ obra, isCeo }) {
  const p = pct(obra.modulos_instalados, obra.modulos_total);
  const sinModulos = !obra.modulos_total;
  const abiertas = obra.incidencias_abiertas ?? 0;

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "inset 2px 0 0 transparent",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: "rgba(36, 149, 150, 0.06)",
          boxShadow: "inset 2px 0 0 #249596",
        },
        "&:hover .editar-obra": { opacity: 1 },
      }}
    >
      <Box
        component={RouterLink}
        to={`/obra/${obra.id}`}
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: 1.5,
          p: 2,
          pr: isCeo ? 13 : 2,
          textDecoration: "none",
          color: "inherit",
          "&:focus-visible": {
            outline: "1px solid",
            outlineColor: "primary.main",
            outlineOffset: -1,
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 1.5,
            }}
          >
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "1rem",
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
              }}
            >
              {obra.nombre}
            </Typography>
            {!isCeo && (
              <Typography
                sx={{
                  flexShrink: 0,
                  pt: 0.25,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {ROL_LABEL[obra.mi_rol] ?? obra.mi_rol}
              </Typography>
            )}
          </Box>
          {obra.ubicacion && (
            <Typography
              color="text.secondary"
              sx={{ fontSize: "0.8125rem", mt: 0.5, lineHeight: 1.4 }}
            >
              {obra.ubicacion}
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: "auto" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 1.5,
              mb: 0.75,
            }}
          >
            <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
              {sinModulos
                ? "Sin módulos"
                : `${obra.modulos_instalados} / ${obra.modulos_total} módulos`}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {sinModulos ? "—" : `${p} %`}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={sinModulos ? 0 : p}
            sx={{
              height: 3,
              borderRadius: 0,
              bgcolor: "divider",
              "& .MuiLinearProgress-bar": {
                borderRadius: 0,
                bgcolor: "primary.main",
              },
            }}
          />
          {abiertas > 0 && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                mt: 1.25,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  flexShrink: 0,
                  bgcolor: "warning.main",
                }}
              />
              <Typography sx={{ color: "warning.main", fontSize: "0.75rem" }}>
                {abiertas} incidencia{abiertas === 1 ? "" : "s"} abierta
                {abiertas === 1 ? "" : "s"}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {isCeo && (
        <Button
          className="editar-obra"
          type="button"
          variant="text"
          disableRipple
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Edición de obra: próxima tarea
          }}
          sx={{
            position: "absolute",
            top: 14,
            right: 16,
            color: "primary.main",
            fontWeight: 600,
            fontSize: "0.8125rem",
            minWidth: 0,
            p: 0,
            opacity: { xs: 1, md: 0 },
            transition: "opacity 0.15s",
            "@media (hover: none)": { opacity: 1 },
            "&:hover": {
              bgcolor: "transparent",
              textDecoration: "underline",
            },
          }}
        >
          Editar obra
        </Button>
      )}
    </Box>
  );
}

export default function MisObrasPage() {
  const { isCeo, profile, status: authStatus } = useAuth();
  const { obras, ready, loading, error, refresh } = useMisObras();

  if (authStatus === "ready" && profile?.is_worker) {
    return <Navigate to="/" replace />;
  }

  // No CEO + exactamente 1 obra → entrar directo (HomeRedirect ya lo hace;
  // esto cubre acceso directo a /obras)
  if (ready && !error && !isCeo && obras.length === 1 && obras[0]?.id) {
    return <Navigate to={`/obra/${obras[0].id}`} replace />;
  }

  const showNueva = isCeo || obras?.some((o) => o.mi_rol === "ceo");

  return (
    <PageActionsProvider>
      <PageHeader
        title="Obras"
        maxWidth={OBRAS_COL_MAX}
        end={
          showNueva ? (
            <Button
              component={RouterLink}
              to="/obras/nueva"
              variant="text"
              disableRipple
              size="small"
              sx={{
                color: "primary.main",
                fontWeight: 600,
                minWidth: 0,
                textTransform: "none",
                "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
              }}
            >
              + Nueva obra
            </Button>
          ) : null
        }
      />
      <Box
        sx={{
          maxWidth: OBRAS_COL_MAX,
          width: "100%",
          mx: "auto",
          boxSizing: "border-box",
          px: pagePadX,
          py: pagePadX,
        }}
      >
      {(loading || !ready) && !error && (
        <Typography color="text.secondary">Cargando…</Typography>
      )}

      {error && (
        <Box>
          <Typography color="warning.main" sx={{ mb: 1 }}>
            {error}
          </Typography>
          <Button
            onClick={() => refresh()}
            variant="text"
            disableRipple
            sx={{
              color: "primary.main",
              p: 0,
              minWidth: 0,
              "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
            }}
          >
            Reintentar
          </Button>
        </Box>
      )}

      {!error && ready && obras.length === 0 && (
        <Typography color="text.secondary">
          {isCeo ? (
            <>
              Todavía no hay obras ·{" "}
              <Box
                component={RouterLink}
                to="/obras/nueva"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Crear la primera
              </Box>
            </>
          ) : (
            "Todavía no tenés obras asignadas."
          )}
        </Typography>
      )}

      {!error && ready && obras.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          {obras.map((o) => (
            <ObraCard key={o.id} obra={o} isCeo={isCeo} />
          ))}
        </Box>
      )}
      </Box>
    </PageActionsProvider>
  );
}
