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

function pct(instalados, total) {
  if (!total) return 0;
  return Math.round((instalados / total) * 100);
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
          maxWidth: 1200,
          width: "100%",
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

      {!error &&
        ready &&
        obras.map((o) => {
          const p = pct(o.modulos_instalados, o.modulos_total);
          const sinModulos = !o.modulos_total;
          return (
            <Box
              key={o.id}
              sx={{
                position: "relative",
                py: 2,
                borderBottom: 1,
                borderColor: "divider",
                "&:hover": { bgcolor: "rgba(36, 149, 150, 0.06)" },
                "&:hover .editar-obra": { opacity: 1 },
              }}
            >
              <Box
                component={RouterLink}
                to={`/obra/${o.id}`}
                sx={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  pr: isCeo ? 14 : 0,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 2,
                    mb: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {o.nombre}
                    </Typography>
                    {o.ubicacion && (
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: "0.875rem" }}
                      >
                        {o.ubicacion}
                      </Typography>
                    )}
                  </Box>
                  {!isCeo && (
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: "0.875rem", flexShrink: 0 }}
                    >
                      {ROL_LABEL[o.mi_rol] ?? o.mi_rol}
                    </Typography>
                  )}
                </Box>

                {sinModulos ? (
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.8125rem" }}
                  >
                    Sin módulos cargados
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={p}
                      sx={{
                        flex: 1,
                        height: 4,
                        bgcolor: "divider",
                        "& .MuiLinearProgress-bar": {
                          bgcolor: "primary.main",
                        },
                      }}
                    />
                    <Typography
                      color="text.secondary"
                      sx={{
                        fontSize: "0.8125rem",
                        minWidth: "2.5rem",
                        textAlign: "right",
                      }}
                    >
                      {p} %
                    </Typography>
                  </Box>
                )}

                {o.incidencias_abiertas > 0 && (
                  <Typography
                    sx={{
                      color: "warning.main",
                      fontSize: "0.8125rem",
                      mt: 0.75,
                    }}
                  >
                    ⚠ {o.incidencias_abiertas} incidencia
                    {o.incidencias_abiertas === 1 ? "" : "s"} abierta
                    {o.incidencias_abiertas === 1 ? "" : "s"}
                  </Typography>
                )}
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
                    top: 16,
                    right: 0,
                    color: "primary.main",
                    fontWeight: 600,
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
        })}
      </Box>
    </PageActionsProvider>
  );
}
