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
          <Typography
            component={RouterLink}
            to="/"
            sx={{
              ...headerLabelSx,
              color: "text.primary",
              textDecoration: "none",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Alusur
          </Typography>

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
                    maxWidth: { xs: 140, sm: 280 },
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                    }}
                  >
                    {obraActual.nombre}
                  </Box>
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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: { xs: 140, sm: 280 },
                  }}
                >
                  {obraActual.nombre}
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
          sx={{
            ...headerButtonSx,
            fontWeight: 500,
            maxWidth: { xs: 120, sm: 220 },
          }}
        >
          <Box
            component="span"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1,
            }}
          >
            {userName}
          </Box>
          <Box
            component="span"
            aria-hidden
            sx={{ flexShrink: 0, fontSize: "0.7em", lineHeight: 1 }}
          >
            ▾
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
            {o.nombre}
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
