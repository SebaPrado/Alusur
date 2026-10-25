import React, { useState } from "react";
import { Link as RouterLink, Outlet } from "react-router-dom";
import { Alert, Box, Button, Stack } from "@mui/material";
import AdminTopBar, { ADMIN_TOPBAR_HEIGHT } from "./AdminTopBar";
import { useAdminOrg } from "./AdminOrgProvider";
import { useOperatingContext } from "./useOperatingContext";
import { useExchangeRate } from "./useExchangeRate";
import { useAdminRealtime } from "./useAdminRealtime";
import OpenCashDialog from "./OpenCashDialog";
import CloseCashDialog from "./CloseCashDialog";

const DISABLED_ACTIONS = [
  { key: "venta", label: "Venta" },
  { key: "productos", label: "Productos" },
  { key: "clientes", label: "Clientes" },
  { key: "cobranza", label: "Cobranza" },
  { key: "retiro", label: "Retiro" },
  { key: "imprimir", label: "Imprimir" },
];

export default function AdminShell() {
  const { isManager } = useAdminOrg();
  const ops = useOperatingContext();
  const { rate, refresh: refreshRate } = useExchangeRate();
  const [openCash, setOpenCash] = useState(false);
  const [closeCash, setCloseCash] = useState(false);

  useAdminRealtime({
    onTick: () => {
      ops.refresh();
      refreshRate();
    },
  });

  let banner = null;
  if (!ops.terminalId) {
    banner = (
      <Alert
        severity="info"
        sx={{ borderRadius: 0 }}
        action={
          isManager ? (
            <Button
              color="inherit"
              size="small"
              component={RouterLink}
              to="/administracion/terminal"
            >
              Asignar terminal
            </Button>
          ) : null
        }
      >
        Esta PC no tiene terminal asignada. Podés mirar la planilla; para vender
        u operar caja hace falta una terminal
        {isManager ? "" : " (pedile al dueño o admin)"}.
      </Alert>
    );
  } else if (!ops.openSession) {
    banner = (
      <Alert
        severity="warning"
        sx={{ borderRadius: 0 }}
        action={
          <Button color="inherit" size="small" onClick={() => setOpenCash(true)}>
            Abrir caja
          </Button>
        }
      >
        Caja cerrada — podés mirar la planilla. Abrí caja para operar en esta
        terminal.
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AdminTopBar
        terminalName={ops.terminalName}
        rate={rate}
        onRateSaved={refreshRate}
      />
      <Box
        sx={{
          pt: `${ADMIN_TOPBAR_HEIGHT}px`,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {banner}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            flexWrap: "wrap",
            gap: 1,
            flexShrink: 0,
          }}
        >
          {DISABLED_ACTIONS.map((a) => (
            <Button
              key={a.key}
              size="small"
              variant="outlined"
              disabled
              title="Próxima entrega"
            >
              {a.label}
            </Button>
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={!ops.canOperate}
            onClick={() => setCloseCash(true)}
          >
            Cerrar caja
          </Button>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Outlet />
        </Box>
      </Box>

      {ops.terminalId && (
        <OpenCashDialog
          open={openCash}
          onClose={() => setOpenCash(false)}
          terminalId={ops.terminalId}
          onOpened={ops.refresh}
        />
      )}
      {ops.openSession && (
        <CloseCashDialog
          open={closeCash}
          onClose={() => setCloseCash(false)}
          cashSessionId={ops.openSession.id}
          onClosed={ops.refresh}
        />
      )}
    </Box>
  );
}
