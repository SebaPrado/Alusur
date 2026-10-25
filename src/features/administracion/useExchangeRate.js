import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";

export function useExchangeRate() {
  const { organizationId } = useAdminOrg();
  const [rate, setRate] = useState(null);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setRate(null);
      return;
    }
    const { data, error } = await supabase
      .from("admin_exchange_rates")
      .select("rate, valid_from")
      .eq("organization_id", organizationId)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("exchange_rates:", error.message);
      return;
    }
    setRate(data);
  }, [organizationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rate, refresh };
}
