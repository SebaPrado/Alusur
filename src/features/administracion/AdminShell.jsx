import React, { useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { Alert, Box, Button, Stack } from "@mui/material";
import { FiLock, FiPrinter } from "react-icons/fi";
import AdminTopBar, { ADMIN_GUTTER, ADMIN_TOPBAR_HEIGHT } from "./AdminTopBar";
import { useAdminOrg } from "./AdminOrgProvider";
import { useOperatingContext } from "./useOperatingContext";
import { useExchangeRate } from "./useExchangeRate";
import { useAdminRealtime } from "./useAdminRealtime";
import CashOutDialog from "./CashOutDialog";
import CloseCashDialog from "./CloseCashDialog";
import CollectionDialog from "./CollectionDialog";
import OpenCashDialog from "./OpenCashDialog";

function NavImage({ src }) {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      className="nav-ico"
      sx={{ width: 16, height: 16, objectFit: "contain", display: "block" }}
    />
  );
}

function NavSign({ children }) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        textAlign: "center",
        fontWeight: 700,
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}

const navBtnSx = {
  "&.MuiButton-contained .nav-ico": { filter: "brightness(0)" },
  "&.Mui-disabled .nav-ico": { opacity: 0.4 },
};

export default function AdminShell() {
  const { isManager } = useAdminOrg();
  const ops = useOperatingContext();
  const { pathname } = useLocation();
  const { rate, refresh: refreshRate } = useExchangeRate();
  const [openCash, setOpenCash] = useState(false);
  const [closeCash, setCloseCash] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);

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
        Esta PC no tiene terminal asignada. Podés mirar los movimientos; para vender
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
        Caja cerrada — podés mirar los movimientos. Abrí caja para operar en esta
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
        terminalId={ops.terminalId}
        rate={rate}
        onRateSaved={refreshRate}
        onTerminalChanged={ops.refresh}
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
        {banner && (
          <Box sx={{ px: ADMIN_GUTTER, pt: 1.5 }}>
            {banner}
          </Box>
        )}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: ADMIN_GUTTER,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            flexWrap: "wrap",
            gap: 1,
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <Button
            size="small"
            variant={pathname === "/administracion" ? "contained" : "outlined"}
            component={RouterLink}
            to="/administracion"
            startIcon={<NavImage src="/calendario.png" />}
            sx={{
              "&.Mui-disabled .nav-ico": { opacity: 0.4 },
              "&.MuiButton-contained": {
                bgcolor: "background.paper",
                color: "text.primary",
                border: "1px solid #249596",
                "&:hover": { bgcolor: "background.paper" },
              },
            }}
          >
            Movimientos
          </Button>
          <Button
            size="small"
            variant={pathname.startsWith("/administracion/productos") ? "contained" : "outlined"}
            component={RouterLink}
            to="/administracion/productos"
            startIcon={<NavImage src="/agregar-producto.png" />}
            sx={navBtnSx}
          >
            Productos
          </Button>
          <Button
            size="small"
            variant={pathname.startsWith("/administracion/venta") ? "contained" : "outlined"}
            disabled={!ops.canOperate}
            component={ops.canOperate ? RouterLink : "button"}
            to={ops.canOperate ? "/administracion/venta" : undefined}
            title={ops.canOperate ? undefined : "Abrí la caja para vender"}
            startIcon={<NavSign>+</NavSign>}
          >
            Venta
          </Button>
          <Button
            size="small"
            variant={pathname.startsWith("/administracion/clientes") ? "contained" : "outlined"}
            component={RouterLink}
            to="/administracion/clientes"
            startIcon={<NavImage src="/cliente-nuevo.png" />}
            sx={navBtnSx}
          >
            Clientes
          </Button>
          <Button
            size="small"
            variant={pathname.startsWith("/administracion/cajas") ? "contained" : "outlined"}
            component={RouterLink}
            to="/administracion/cajas"
            startIcon={<NavImage src="/recibo-de-caja.png" />}
            sx={navBtnSx}
          >
            Cajas
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            disabled={!ops.canOperate}
            title={ops.canOperate ? undefined : "Abrí la caja para cobrar"}
            onClick={() => setCollectionOpen(true)}
            startIcon={<NavSign>+</NavSign>}
          >
            Cobranza
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!ops.canOperate}
            title={ops.canOperate ? undefined : "Abrí la caja para retirar"}
            onClick={() => setCashOutOpen(true)}
            startIcon={<NavSign>−</NavSign>}
          >
            Retiro
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled
            title="Próxima entrega"
            startIcon={<FiPrinter size={16} />}
          >
            Imprimir
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={!ops.canOperate}
            onClick={() => setCloseCash(true)}
            startIcon={<FiLock size={16} />}
          >
            Cerrar caja
          </Button>
        </Stack>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            px: ADMIN_GUTTER,
          }}
        >
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
      <CollectionDialog
        open={collectionOpen}
        customer={null}
        onClose={() => setCollectionOpen(false)}
      />
      <CashOutDialog
        open={cashOutOpen}
        onClose={() => setCashOutOpen(false)}
      />
    </Box>
  );
}
