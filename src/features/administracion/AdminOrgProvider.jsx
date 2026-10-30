import React, { useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useOrganizacion } from "../../org/OrganizacionProvider";
import { esManagerAdmin, puedeGestionarEquipoAdmin } from "../../org/organizacion";

const AdminOrgContext = React.createContext(null);

/**
 * La organización de Administración es la misma que el resto de la app.
 */
export function AdminOrgProvider({ children }) {
  const { profile } = useAuth();
  const { ready, error, plataforma, orgActiva, organizaciones, setOrgActiva } =
    useOrganizacion();

  const value = useMemo(() => {
    const org = orgActiva;
    return {
      ready,
      error,
      memberships: organizaciones.map((o) => ({
        organizationId: o.id,
        role: o.rol,
        displayName: profile?.full_name ?? "",
        organizationName: o.nombre,
      })),
      organizationId: org?.id ?? null,
      organizationName: org?.nombre ?? null,
      role: org?.rol ?? null,
      areas: org?.areas ?? [],
      displayName: profile?.full_name ?? null,
      setOrganization: setOrgActiva,
      isManager: esManagerAdmin({ plataforma, org }),
      canManageMembers: puedeGestionarEquipoAdmin({ plataforma, org }),
    };
  }, [ready, error, plataforma, orgActiva, organizaciones, setOrgActiva, profile?.full_name]);

  return <AdminOrgContext.Provider value={value}>{children}</AdminOrgContext.Provider>;
}

export function useAdminOrg() {
  const ctx = React.useContext(AdminOrgContext);
  if (!ctx) throw new Error("useAdminOrg debe usarse dentro de AdminOrgProvider");
  return ctx;
}
