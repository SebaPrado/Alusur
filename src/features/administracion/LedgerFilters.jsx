import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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

const EVENT_OPTIONS = [
  ["apertura_caja", LEDGER_EVENT_LABEL.apertura_caja],
  ["cierre_caja", LEDGER_EVENT_LABEL.cierre_caja],
  ["venta", "venta"],
  ["devolucion", "devolucion"],
  ["cobranza", "cobranza"],
  ["retiro_socio", "retiro_socio"],
  ["pago_proveedor", "pago_proveedor"],
  ["flete", "flete"],
  ["sueldo_adelanto", "sueldo_adelanto"],
  ["gastos", "gastos"],
  ["ingreso_manual", "ingreso_manual"],
  ["otro", "otro"],
].map(([value, label]) => ({ value, label }));

function MultiFilter({ label, emptyLabel, value, options, onChange, minWidth }) {
  const selected = value ?? [];
  return (
    <FormControl size="small" sx={{ minWidth, maxWidth: 280 }}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        multiple
        displayEmpty
        label={label}
        value={selected}
        onChange={(e) => {
          const next = e.target.value;
          onChange(typeof next === "string" ? next.split(",") : next);
        }}
        renderValue={(picked) => {
          if (!picked.length) return emptyLabel;
          return picked
            .map((id) => options.find((o) => o.value === id)?.label ?? id)
            .join(", ");
        }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            <Checkbox
              size="small"
              checked={selected.includes(o.value)}
              sx={{ p: 0.25, mr: 1 }}
            />
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function LedgerFilters({ value, onChange, onExport, exporting }) {
  const { organizationId } = useAdminOrg();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const active =
    value.preset !== "todo" ||
    (value.eventTypes?.length ?? 0) > 0 ||
    (value.userIds?.length ?? 0) > 0 ||
    (value.terminalIds?.length ?? 0) > 0;

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

      <MultiFilter
        label="Tipo"
        emptyLabel="Todos"
        minWidth={160}
        value={value.eventTypes}
        options={EVENT_OPTIONS}
        onChange={(eventTypes) => patch({ eventTypes })}
      />
      <MultiFilter
        label="Usuario"
        emptyLabel="Todos"
        minWidth={180}
        value={value.userIds}
        options={users.map((u) => ({ value: u.user_id, label: u.display_name }))}
        onChange={(userIds) => patch({ userIds })}
      />
      <MultiFilter
        label="Caja"
        emptyLabel="Todas"
        minWidth={150}
        value={value.terminalIds}
        options={terminals.map((t) => ({ value: t.id, label: t.name }))}
        onChange={(terminalIds) => patch({ terminalIds })}
      />

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
