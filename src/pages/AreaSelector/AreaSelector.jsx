import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Menu, MenuItem } from "@mui/material";
import { entryTarget } from "../../app/authRedirect";
import { useAuth } from "../../auth/AuthProvider";
import { clearTerminalId } from "../../features/administracion/storage";
import { clearStoredOrgId } from "../../org/OrganizacionProvider";
import OrgSwitcher, { ItemPlataforma } from "../../org/OrgSwitcher";
import { useOrganizacion } from "../../org/OrganizacionProvider";
import { areasVisibles, destinoAlCambiarOrg } from "../../org/organizacion";
import { supabase } from "../../lib/supabase";
import "./AreaSelector.css";

const AREAS = [
  {
    key: "construccion",
    title: "Construcción",
    subtitle: "Obras, contenedores, módulos e inspecciones",
    image: "/inicio.jpg",
    path: "/construccion",
  },
  {
    key: "administracion",
    title: "Administración",
    subtitle: "Facturas, compras, pagos y productos",
    image: "/adminlanding.jpg",
    path: "/administracion",
  },
];

export default function AreaSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, session, user, profile, signOut } = useAuth();
  const { ready: orgReady, orgActiva } = useOrganizacion();
  const [menuEl, setMenuEl] = useState(null);
  const [memberDisplayName, setMemberDisplayName] = useState(null);
  const esObrero = Boolean(profile?.is_worker);
  const areas = areasVisibles({ org: orgActiva, esObrero });
  const paneles = session ? AREAS.filter((a) => areas.includes(a.key)) : AREAS;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setMemberDisplayName(null);
        return;
      }
      const { data } = await supabase
        .from("admin_members")
        .select("display_name")
        .eq("user_id", user.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setMemberDisplayName(data?.display_name?.trim() || null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const displayName =
    memberDisplayName || profile?.full_name?.trim() || "Usuario";

  function enter(area) {
    if (status !== "ready") return;
    const dest = entryTarget(area.path, location.state?.from);
    if (session) {
      navigate(dest);
      return;
    }
    navigate("/login", { state: { from: dest } });
  }

  async function switchUser() {
    setMenuEl(null);
    clearTerminalId();
    clearStoredOrgId();
    await signOut();
    navigate("/login", { replace: true });
  }

  if (session && (status !== "ready" || !orgReady)) {
    return <div className="area-selector-page" />;
  }

  if (session && paneles.length === 1) {
    return (
      <Navigate to={destinoAlCambiarOrg({ org: orgActiva, esObrero })} replace />
    );
  }

  return (
    <div className="area-selector-page">
      <img className="area-selector-logo" src="/logo.png" alt="Alusur" />
      <div className="area-selector-user">
        {session ? (
          <>
            <OrgSwitcher soloSiHayVarias />
            <button
              type="button"
              className="area-selector-user__login"
              onClick={(e) => setMenuEl(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={Boolean(menuEl)}
              aria-label="Menú de usuario"
            >
              <img
                className="area-selector-user__icon"
                src="/usuario.png"
                alt=""
                width={22}
                height={22}
              />
              <span className="area-selector-user__name">{displayName}</span>
            </button>
            <Menu
              anchorEl={menuEl}
              open={Boolean(menuEl)}
              onClose={() => setMenuEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              slotProps={{
                paper: { sx: { borderRadius: 0, mt: 1, minWidth: 180 } },
              }}
            >
              <ItemPlataforma onPick={() => setMenuEl(null)} />
              <MenuItem onClick={switchUser}>Cambiar de usuario</MenuItem>
            </Menu>
          </>
        ) : (
          <button
            type="button"
            className="area-selector-user__login"
            onClick={() => navigate("/login")}
          >
            <img
              className="area-selector-user__icon"
              src="/usuario.png"
              alt=""
              width={22}
              height={22}
            />
            Iniciar sesión
          </button>
        )}
      </div>

      <main className="area-selector" aria-label="Elegir área de trabajo">
        {paneles.length === 0 ? (
          <p className="area-panel__subtitle">Esta organización no tiene áreas habilitadas.</p>
        ) : (
          paneles.map((area) => (
          <button
            key={area.key}
            type="button"
            className="area-panel"
            style={{ "--bg": `url(${area.image})` }}
            onClick={() => enter(area)}
          >
            <div className="area-panel__content">
              <h2 className="area-panel__title">{area.title}</h2>
              <p className="area-panel__subtitle">{area.subtitle}</p>
              <span className="area-panel__cta">Entrar →</span>
            </div>
          </button>
          ))
        )}
      </main>
    </div>
  );
}
