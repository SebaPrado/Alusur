import React, { useState } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import { FiMenu } from "react-icons/fi";
import { useAuth } from "../../auth/AuthProvider";
import { useMisObras } from "../../obras/MisObrasProvider";

const BAR_HEIGHT = 48;

/** Misma caja tipográfica para que marca y obra compartan el eje horizontal. */
const headerLabelSx = {
  fontFamily: "inherit",
  fontSize: "0.875rem",
  lineHeight: 1,
  letterSpacing: 0,
  display: "inline-flex",
  alignItems: "center",
  height: 20,
};

const headerButtonSx = {
  ...headerLabelSx,
  appearance: "none",
  border: 0,
  m: 0,
  p: 0,
  background: "transparent",
  color: "text.primary",
  cursor: "pointer",
  gap: 0.5,
  minWidth: 0,
};

const ROL_LABEL = {
  ceo: "CEO",
  superadmin: "SuperAdmin",
  admin: "Admin",
  owner: "Owner",
  obrero: "Obrero",
};

function NombreObra({ nombre, prefijo }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 0,
        maxWidth: "100%",
        lineHeight: 1,
      }}
    >
      <Box
        component="span"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          lineHeight: 1,
        }}
      >
        {nombre}
      </Box>
      {prefijo ? (
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            color: "text.secondary",
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          {prefijo}
        </Box>
      ) : null}
    </Box>
  );
}

function sectionAfterObra(pathname, obraId) {
  const prefix = `/obra/${obraId}`;
  if (!pathname.startsWith(prefix)) return "hoy";
  const rest = pathname.slice(prefix.length).replace(/^\//, "");
  return rest || "hoy";
}

export default function TopBar({
  showObraSwitcher = false,
  mi_rol = null,
  onOpenNav = null,
}) {
  const { profile, isCeo, signOut } = useAuth();
  const { obras } = useMisObras();
  const { obraId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [obraMenu, setObraMenu] = useState(null);
  const [userMenu, setUserMenu] = useState(null);

  const obraActual = obraId ? obras.find((o) => o.id === obraId) : null;
  const showObraMenu =
    showObraSwitcher &&
    obraActual &&
    (isCeo || obras.length > 1);

  const rolLabel =
    ROL_LABEL[mi_rol] ?? (isCeo ? "CEO" : null);
  const userName = profile?.full_name || "Usuario";

  function switchObra(nextId) {
    setObraMenu(null);
    if (!nextId || nextId === obraId) return;
    const section = sectionAfterObra(location.pathname, obraId);
    navigate(`/obra/${nextId}/${section}`);
  }

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
        height: BAR_HEIGHT,
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: `${BAR_HEIGHT}px !important`,
          height: BAR_HEIGHT,
          px: 2,
          gap: 1,
        }}
      >
        {onOpenNav && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menú"
            onClick={onOpenNav}
            sx={{
              mr: 0.5,
              p: 0.75,
              borderRadius: 0,
              color: "#F2F4F7",
              "&:hover": { bgcolor: "rgba(242, 244, 247, 0.08)" },
            }}
          >
            <FiMenu size={18} strokeWidth={1.75} aria-hidden />
          </IconButton>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Box
            component={RouterLink}
            to="/"
            aria-label="Inicio"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              lineHeight: 0,
            }}
          >
            <Box
              component="img"
              src="/iconalusur2.png"
              alt=""
              sx={{ display: "block", height: 28, width: "auto" }}
            />
          </Box>

          {showObraSwitcher && obraActual && (
            <>
              <Divider
                orientation="vertical"
                sx={{
                  borderColor: "divider",
                  alignSelf: "center",
                  height: 16,
                }}
              />
              {showObraMenu ? (
                <Box
                  component="button"
                  type="button"
                  onClick={(e) => setObraMenu(e.currentTarget)}
                  sx={{
                    ...headerButtonSx,
                    fontWeight: 600,
                    maxWidth: { xs: 200, sm: 360 },
                  }}
                >
                  <NombreObra nombre={obraActual.nombre} prefijo={obraActual.prefijo} />
                  <Box
                    component="span"
                    aria-hidden
                    sx={{ flexShrink: 0, fontSize: "0.7em", lineHeight: 1 }}
                  >
                    ▾
                  </Box>
                </Box>
              ) : (
                <Typography
                  component="span"
                  sx={{
                    ...headerLabelSx,
                    fontWeight: 600,
                    maxWidth: { xs: 180, sm: 320 },
                  }}
                >
                  <NombreObra nombre={obraActual.nombre} prefijo={obraActual.prefijo} />
                </Typography>
              )}
            </>
          )}
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box
          component="button"
          type="button"
          onClick={(e) => setUserMenu(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(userMenu)}
          aria-label="Menú de usuario"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            m: 0,
            border: 0,
            background: "transparent",
            color: "#f2f4f7",
            font: "inherit",
            fontSize: "0.8125rem",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "normal",
            padding: "6px 10px",
            cursor: "pointer",
            opacity: 0.88,
            maxWidth: { xs: 160, sm: 260 },
            minWidth: 0,
            "&:hover": { opacity: 1 },
            "&:hover img": { opacity: 1 },
          }}
        >
          <Box
            component="img"
            src="/usuario.png"
            alt=""
            width={22}
            height={22}
            sx={{
              display: "block",
              width: 22,
              height: 22,
              objectFit: "contain",
              flexShrink: 0,
              opacity: 0.9,
            }}
          />
          <Box
            component="span"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {userName}
          </Box>
        </Box>
      </Toolbar>

      <Menu
        anchorEl={obraMenu}
        open={Boolean(obraMenu)}
        onClose={() => setObraMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {obras.map((o) => (
          <MenuItem
            key={o.id}
            selected={o.id === obraId}
            onClick={() => switchObra(o.id)}
          >
            {o.prefijo ? `${o.nombre} · ${o.prefijo}` : o.nombre}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={userMenu}
        open={Boolean(userMenu)}
        onClose={() => setUserMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem disabled sx={{ opacity: "1 !important", cursor: "default" }}>
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {userName}
            </Typography>
            {rolLabel && (
              <Typography variant="caption" color="text.secondary">
                {rolLabel}
              </Typography>
            )}
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserMenu(null);
            signOut();
          }}
        >
          Cerrar sesión
        </MenuItem>
      </Menu>
    </AppBar>
  );
}

export { BAR_HEIGHT };
