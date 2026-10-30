import React, { useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import { PageActionsProvider } from "../obra/PageActions";
import PageHeader, { usePagePadX } from "../obra/PageHeader";
import VincularEmpresasDialog from "./VincularEmpresasDialog";

function usePersonalTabs() {
  const { can } = useObra();
  const canMembers = can("members.manage");
  const canEquipo = can("equipo.manage");
  const canMaquina = can("maquina.manage");
  const canTrabEquipos = canMembers || canEquipo;

  return useMemo(() => {
    const tabs = [];
    if (canTrabEquipos) {
      tabs.push({
        path: "trabajadores",
        label: "Trabajadores",
        iconSrc: "/personal.png",
      });
      tabs.push({
        path: "equipos",
        label: "Equipos",
        iconSrc: "/usuario.png",
      });
    }
    if (canMembers) {
      tabs.push({
        path: "usuarios",
        label: "Administradores",
        iconSrc: "/admin.png",
      });
    }
    if (canMaquina) {
      tabs.push({
        path: "maquinas",
        label: "Máquinas",
        iconSrc: "/maquinas.png",
      });
    }
    return tabs;
  }, [canTrabEquipos, canMembers, canMaquina]);
}

export default function PersonalPage() {
  const location = useLocation();
  const { obraId, can, mi_rol, ready, known } = useObra();
  const controlTotal = controlTotalEnObra(mi_rol);
  const padX = usePagePadX();
  const [empresasOpen, setEmpresasOpen] = useState(false);
  const [empresasTick, setEmpresasTick] = useState(0);
  const tabs = usePersonalTabs();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  const canVer =
    can("members.manage") || can("equipo.manage") || can("maquina.manage");
  if (!canVer) {
    return (
      <Box sx={{ p: padX }}>
        <Typography color="text.secondary">Sin acceso</Typography>
      </Box>
    );
  }

  // Misma base viva que el sidebar; `/obra/...` remonta ObraLayout vía LegacyToConstruccion.
  const base = `/construccion/obra/${obraId}/personal`;
  const active = tabs.find((t) => location.pathname.includes(`/${t.path}`));

  // Index `/personal` o pestaña no permitida → primera pestaña permitida
  const onIndex =
    location.pathname === base ||
    location.pathname === `${base}/` ||
    location.pathname.endsWith("/personal") ||
    location.pathname.endsWith("/personal/");
  if (onIndex && tabs[0]) {
    return <Navigate to={`${base}/${tabs[0].path}`} replace />;
  }
  if (!active && tabs[0]) {
    return <Navigate to={`${base}/${tabs[0].path}`} replace />;
  }

  return (
    <PageActionsProvider>
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <PageHeader
          base={base}
          tabs={tabs}
          maxWidth={1200}
          end={
            controlTotal ? (
              <Button
                onClick={() => setEmpresasOpen(true)}
                variant="outlined"
                color="primary"
                size="small"
                sx={{ textTransform: "none", borderRadius: 0 }}
              >
                Empresas de la obra
              </Button>
            ) : null
          }
        />

        <Box
          sx={{
            maxWidth: 1200,
            width: "100%",
            mx: "auto",
            boxSizing: "border-box",
            px: padX,
            py: padX,
          }}
        >
          <Outlet
            context={{
              obraId,
              openEmpresas: controlTotal ? () => setEmpresasOpen(true) : null,
              empresasTick,
            }}
          />
        </Box>

        {controlTotal && (
          <VincularEmpresasDialog
            open={empresasOpen}
            onClose={() => setEmpresasOpen(false)}
            obraId={obraId}
            onChanged={() => setEmpresasTick((n) => n + 1)}
          />
        )}
      </Box>
    </PageActionsProvider>
  );
}
