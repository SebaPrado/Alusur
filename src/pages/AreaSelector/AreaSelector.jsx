import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ButtonBase, Menu, MenuItem } from "@mui/material";
import { entryTarget } from "../../app/authRedirect";
import { useAuth } from "../../auth/AuthProvider";
import {
  clearOrgId,
  clearTerminalId,
} from "../../features/administracion/storage";
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
  const [menuEl, setMenuEl] = useState(null);
  const [memberDisplayName, setMemberDisplayName] = useState(null);

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
    clearOrgId();
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="area-selector-page">
      <div className="area-selector-user">
        {session ? (
          <>
            <ButtonBase
              className="area-selector-user__btn"
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
            </ButtonBase>
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
        {AREAS.map((area) => (
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
        ))}
      </main>
    </div>
  );
}
