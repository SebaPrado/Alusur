import { useEffect, useId, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";

const TABLES = [
  "admin_sales",
  "admin_payments",
  "admin_cash_movements",
  "admin_cash_sessions",
  "admin_exchange_rates",
];

/**
 * Suscripción realtime con debounce 300 ms.
 * Cada instancia usa un topic único: dos hooks (shell + planilla) no
 * reutilizan un canal ya suscrito (error de supabase-js).
 */
export function useAdminRealtime({ onTick, enabled = true, tables = TABLES }) {
  const { organizationId } = useAdminOrg();
  const instanceId = useId().replace(/:/g, "");
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const tablesKey = tables.join(",");

  useEffect(() => {
    if (!enabled || !organizationId) return;

    let timer = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onTickRef.current?.();
      }, 300);
    };

    let channel = supabase.channel(`admin-${organizationId}-${instanceId}`);
    for (const table of tablesKey.split(",")) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${organizationId}`,
        },
        schedule,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [organizationId, enabled, instanceId, tablesKey]);
}
