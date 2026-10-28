import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/AuthProvider";
import { readOrgId, writeOrgId } from "./storage";

const AdminOrgContext = createContext(null);

export function AdminOrgProvider({ children }) {
  const { user, status: authStatus, isCeo } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authStatus === "loading") return;
      if (!user?.id) {
        setMemberships([]);
        setOrganizationId(null);
        setReady(true);
        return;
      }
      setReady(false);
      const { data, error: err } = await supabase
        .from("admin_members")
        .select(
          "organization_id, role, display_name, active, admin_organizations(id, name)",
        )
        .eq("user_id", user.id)
        .eq("active", true);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setMemberships([]);
        setOrganizationId(null);
        setReady(true);
        return;
      }
      const rows = (data ?? []).map((m) => ({
        organizationId: m.organization_id,
        role: m.role,
        displayName: m.display_name,
        organizationName: m.admin_organizations?.name ?? "",
      }));
      setMemberships(rows);
      setError(null);

      const stored = readOrgId();
      if (rows.length === 1) {
        setOrganizationId(rows[0].organizationId);
        writeOrgId(rows[0].organizationId);
      } else if (stored && rows.some((r) => r.organizationId === stored)) {
        setOrganizationId(stored);
      } else {
        setOrganizationId(null);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, authStatus]);

  const setOrganization = useCallback((id) => {
    setOrganizationId(id || null);
    writeOrgId(id || null);
  }, []);

  const current = memberships.find((m) => m.organizationId === organizationId);

  const value = useMemo(
    () => ({
      ready,
      error,
      memberships,
      organizationId,
      organizationName: current?.organizationName ?? null,
      role: current?.role ?? null,
      displayName: current?.displayName ?? null,
      setOrganization,
      isManager: current?.role === "dueno" || current?.role === "admin",
      // Dueño, o CEO de plataforma que ya es miembro de la org actual.
      canManageMembers: Boolean(
        current && (current.role === "dueno" || isCeo),
      ),
    }),
    [ready, error, memberships, organizationId, current, setOrganization, isCeo],
  );

  return (
    <AdminOrgContext.Provider value={value}>{children}</AdminOrgContext.Provider>
  );
}

export function useAdminOrg() {
  const ctx = useContext(AdminOrgContext);
  if (!ctx) throw new Error("useAdminOrg debe usarse dentro de AdminOrgProvider");
  return ctx;
}
