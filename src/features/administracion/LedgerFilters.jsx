import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { FiFilter } from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import { LEDGER_EVENT_LABEL } from "./ledgerQuery";
import { C } from "../personal/theme";
import { useAdminOrg } from "./AdminOrgProvider";

const PRESETS = [
  { value: "todo", label: "Todo" },
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "7d", label: "7 días" },
  { value: "mes", label: "Mes" },
  { value: "rango", label: "Rango" },
];

export default function LedgerFilters({ value, onChange, onExport, exporting }) {
  const { organizationId } = useAdminOrg();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const active =
    value.preset !== "todo" ||
    Boolean(value.eventType) ||
    Boolean(value.userId) ||
    Boolean(value.terminalId);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const [u, t] = await Promise.all([
        supabase
          .from("admin_members")
          .select("user_id, display_name")
          .eq("organization_id", organizationId)
          .eq("active", true)
          .order("display_name"),
        supabase
          .from("admin_terminals")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("active", true)
          .order("name"),
      ]);
      setUsers(u.data ?? []);
      setTerminals(t.data ?? []);
    })();
  }, [organizationId]);

  function patch(partial) {
    onChange({ ...value, ...partial });
  }

  return (
    <Box sx={{ py: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          size="small"
          startIcon={<FiFilter size={16} />}
          onClick={() => setOpen((o) => !o)}
          sx={{
            borderRadius: 0,
            textTransform: "none",
            color: active || open ? C.accent : C.muted,
            borderBottom: 1,
            borderColor: active || open ? C.accent : "transparent",
            px: 0.5,
            minWidth: 0,
            "&:hover": { color: C.text, bgcolor: "transparent" },
          }}
        >
          Filtrar
          {active ? " · activo" : ""}
        </Button>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "center",
            mt: 1.25,
            pt: 1.25,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.preset}
        onChange={(_, v) => v && patch({ preset: v })}
      >
        {PRESETS.map((p) => (
          <ToggleButton key={p.value} value={p.value}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {value.preset === "rango" && (
        <>
          <TextField
            type="date"
            size="small"
            label="Desde"
            InputLabelProps={{ shrink: true }}
            value={value.rangeFrom}
            onChange={(e) => patch({ rangeFrom: e.target.value })}
          />
          <TextField
            type="date"
            size="small"
            label="Hasta"
            InputLabelProps={{ shrink: true }}
            value={value.rangeTo}
            onChange={(e) => patch({ rangeTo: e.target.value })}
          />
        </>
      )}

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Tipo</InputLabel>
        <Select
          label="Tipo"
          value={value.eventType || ""}
          onChange={(e) => patch({ eventType: e.target.value || null })}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="apertura_caja">{LEDGER_EVENT_LABEL.apertura_caja}</MenuItem>
          <MenuItem value="cierre_caja">{LEDGER_EVENT_LABEL.cierre_caja}</MenuItem>
          <MenuItem value="venta">venta</MenuItem>
          <MenuItem value="devolucion">devolucion</MenuItem>
          <MenuItem value="cobranza">cobranza</MenuItem>
          <MenuItem value="retiro_socio">retiro_socio</MenuItem>
          <MenuItem value="pago_proveedor">pago_proveedor</MenuItem>
          <MenuItem value="flete">flete</MenuItem>
          <MenuItem value="sueldo_adelanto">sueldo_adelanto</MenuItem>
          <MenuItem value="gastos">gastos</MenuItem>
          <MenuItem value="ingreso_manual">ingreso_manual</MenuItem>
          <MenuItem value="otro">otro</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Usuario</InputLabel>
        <Select
          label="Usuario"
          value={value.userId || ""}
          onChange={(e) => patch({ userId: e.target.value || null })}
        >
          <MenuItem value="">Todos</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.user_id} value={u.user_id}>
              {u.display_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Caja</InputLabel>
        <Select
          label="Caja"
          value={value.terminalId || ""}
          onChange={(e) => patch({ terminalId: e.target.value || null })}
        >
          <MenuItem value="">Todas</MenuItem>
          {terminals.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        variant="outlined"
        onClick={onExport}
        disabled={exporting}
      >
        Exportar CSV
      </Button>
    </Box>
      </Collapse>
    </Box>
  );
}
