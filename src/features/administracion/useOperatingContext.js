import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { readTerminalId } from "./storage";

/**
 * Contexto de operación (no bloquea mirar).
 * canOperate = terminal asignada + caja abierta en esa terminal.
 */
export function useOperatingContext() {
  const { organizationId } = useAdminOrg();
  const [terminalId, setTerminalIdState] = useState(() => readTerminalId());
  const [terminalName, setTerminalName] = useState(null);
  const [openSession, setOpenSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const tid = readTerminalId();
    setTerminalIdState(tid);
    if (!organizationId) {
      setTerminalName(null);
      setOpenSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    if (!tid) {
      setTerminalName(null);
      setOpenSession(null);
      setLoading(false);
      return;
    }

    const { data: term } = await supabase
      .from("admin_terminals")
      .select("id, name, active")
      .eq("id", tid)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!term || !term.active) {
      setTerminalName(null);
      setOpenSession(null);
      setLoading(false);
      return;
    }
    setTerminalName(term.name);

    const { data: session } = await supabase
      .from("admin_cash_sessions")
      .select("id, opened_at, opening_uyu, opening_usd, opened_by, status")
      .eq("organization_id", organizationId)
      .eq("terminal_id", tid)
      .eq("status", "abierta")
      .maybeSingle();

    setOpenSession(session ?? null);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canOperate = Boolean(terminalId && terminalName && openSession);

  return useMemo(
    () => ({
      terminalId: terminalName ? terminalId : null,
      terminalName,
      openSession,
      canOperate,
      loading,
      refresh,
    }),
    [terminalId, terminalName, openSession, canOperate, loading, refresh],
  );
}
