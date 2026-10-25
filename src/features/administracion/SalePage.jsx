import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { supabase } from "../../lib/supabase";
import { useAdminOrg } from "./AdminOrgProvider";
import { faltaLabel, formatCents, formatRateLabel } from "./money";
import { rpcErrorMessage } from "./rpcError";
import {
  buildPayments,
  buildSaleItems,
  canConfirmSale,
  centsToInput,
  convertCents,
  lineTotalCents,
  otherCurrency,
  parseMoneyToCents,
  parseQtyThousandths,
  qtyToInput,
  quoteSale,
  rateToTenThousandths,
} from "./saleMath";
import CustomerDialog from "./CustomerDialog";
import { useAdminToast } from "./toast";
import { useAdminRealtime } from "./useAdminRealtime";
import { useExchangeRate } from "./useExchangeRate";
import { useOperatingContext } from "./useOperatingContext";

const RATE_TABLES = ["admin_exchange_rates"];
const LIST_SLOTS = 6;
const rowShadow = "0 10px 28px rgba(0, 0, 0, 0.28), 0 1px 0 rgba(242, 244, 247, 0.07)";
const PRODUCT_COLS = "id, name, sku, barcode, unit, currency, price, active";
const METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "pos_debito", label: "POS débito" },
  { value: "pos_credito", label: "POS crédito" },
];

function newKey() {
  return crypto.randomUUID();
}

function emptyPayment(currency) {
  return {
    key: newKey(),
    method: "efectivo",
    currency,
    amountText: "",
    reference: "",
  };
}

function rateKey(rate) {
  if (rate?.rate == null || rate.rate === "") return null;
  const tt = rateToTenThousandths(rate.rate);
  return tt == null ? null : tt.toString();
}

export default function SalePage() {
  const { organizationId } = useAdminOrg();
  const ops = useOperatingContext();
  const { rate, refresh: refreshRate } = useExchangeRate();
  const { showError, showSuccess, showInfo } = useAdminToast();
  const searchRef = useRef(null);
  const saleCurrencyRef = useRef("UYU");
  const cartLenRef = useRef(0);
  const rateKeyRef = useRef(undefined);
  const searchSeq = useRef(0);

  const [saleCurrency, setSaleCurrency] = useState("UYU");
  const [changeCurrency, setChangeCurrency] = useState("UYU");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [condition, setCondition] = useState("contado");
  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [payments, setPayments] = useState(() => [emptyPayment("UYU")]);
  const [busy, setBusy] = useState(false);

  saleCurrencyRef.current = saleCurrency;
  cartLenRef.current = cart.length;

  useAdminRealtime({ onTick: refreshRate, tables: RATE_TABLES });

  useEffect(() => {
    const next = rateKey(rate);
    if (rateKeyRef.current === undefined) {
      rateKeyRef.current = next;
      return;
    }
    if (rateKeyRef.current === next) return;
    rateKeyRef.current = next;
    if (next == null || cartLenRef.current === 0) return;
    const tt = BigInt(next);
    const currency = saleCurrencyRef.current;
    setCart((lines) =>
      lines.map((line) => {
        if (line.priceEdited) return line;
        const unit = convertCents(line.listPriceCents, line.listCurrency, currency, tt);
        if (unit == null) return line;
        return { ...line, unitPriceText: centsToInput(unit) };
      }),
    );
    showInfo(`Cambió la cotización: U$S 1 = ${formatRateLabel(tt)}`);
  }, [rate, showInfo]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    supabase
      .from("admin_customers")
      .select("id, name, doc_type, doc_number")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) showError(rpcErrorMessage(error));
        else setCustomers(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, showError]);

  function handleCustomerCreated(saved) {
    if (!saved?.id) return;
    setCustomers((list) => {
      if (list.some((c) => c.id === saved.id)) return list;
      return [...list, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setCustomerId(saved.id);
    setCustomerQuery(saved.name);
  }

  useEffect(() => {
    const q = query.trim();
    if (!q || !organizationId) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("admin_global_search", {
        p_organization_id: organizationId,
        p_query: q,
        p_limit: 20,
      });
      if (searchSeq.current !== seq) return;
      if (error) {
        showError(rpcErrorMessage(error));
        setResults([]);
        return;
      }
      const hits = (data ?? []).filter((row) => row.kind === "producto");
      if (hits.length === 0) {
        setResults([]);
        return;
      }
      const { data: products, error: prodError } = await supabase
        .from("admin_products")
        .select(PRODUCT_COLS)
        .in(
          "id",
          hits.map((row) => row.id),
        );
      if (searchSeq.current !== seq) return;
      if (prodError) {
        showError(rpcErrorMessage(prodError));
        setResults([]);
        return;
      }
      const byId = new Map((products ?? []).filter((p) => p.active).map((p) => [p.id, p]));
      setResults(hits.map((row) => byId.get(row.id)).filter(Boolean));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, organizationId, showError]);

  const rateTt = rate?.rate == null ? null : rateToTenThousandths(rate.rate);

  async function addFromSearch(id) {
    const { data, error } = await supabase
      .from("admin_products")
      .select(PRODUCT_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    addProduct(data);
  }

  function addProduct(row) {
    if (!row) {
      showError("Producto no encontrado");
      return;
    }
    if (!row.active) {
      showError("Producto inactivo");
      return;
    }
    const listPriceCents = parseMoneyToCents(row.price);
    if (listPriceCents == null) {
      showError("Precio inválido");
      return;
    }
    const unit = convertCents(listPriceCents, row.currency, saleCurrency, rateTt);
    if (unit == null) {
      showError("No hay cotización del dólar cargada");
      return;
    }
    setCart((lines) => {
      const idx = lines.findIndex((line) => line.productId === row.id);
      if (idx >= 0) {
        const copy = lines.slice();
        const qty = (parseQtyThousandths(copy[idx].qtyText) ?? 0n) + 1000n;
        copy[idx] = { ...copy[idx], qtyText: qtyToInput(qty) };
        return copy;
      }
      return [
        ...lines,
        {
          productId: row.id,
          name: row.name,
          listPriceCents,
          listCurrency: row.currency,
          unitPriceText: centsToInput(unit),
          priceEdited: false,
          qtyText: "1",
        },
      ];
    });
    setQuery("");
    setResults([]);
    searchSeq.current += 1;
    searchRef.current?.focus();
  }

  async function onSearchKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const q = query.trim();
    if (!q || !organizationId) return;
    searchSeq.current += 1;
    const [bySku, byBarcode] = await Promise.all([
      supabase
        .from("admin_products")
        .select(PRODUCT_COLS)
        .eq("organization_id", organizationId)
        .eq("sku", q)
        .maybeSingle(),
      supabase
        .from("admin_products")
        .select(PRODUCT_COLS)
        .eq("organization_id", organizationId)
        .eq("barcode", q)
        .maybeSingle(),
    ]);
    if (bySku.error) {
      showError(rpcErrorMessage(bySku.error));
      return;
    }
    if (byBarcode.error) {
      showError(rpcErrorMessage(byBarcode.error));
      return;
    }
    const row = bySku.data ?? byBarcode.data;
    if (!row) return;
    if (!row.active) {
      showError("Producto inactivo");
      setQuery("");
      setResults([]);
      return;
    }
    addProduct(row);
  }

  function setSaleCurrencyTo(next) {
    if (next === saleCurrency) return;
    const blocked = cart.some((line) => {
      if (parseMoneyToCents(line.unitPriceText) == null) return false;
      return convertCents(line.listPriceCents, line.listCurrency, next, rateTt) == null;
    });
    if (blocked) {
      showError("No hay cotización del dólar cargada");
      return;
    }
    setSaleCurrency(next);
    setChangeCurrency(next);
    setCart((lines) =>
      lines.map((line) => {
        const unit = convertCents(line.listPriceCents, line.listCurrency, next, rateTt);
        if (unit == null) return line;
        return { ...line, unitPriceText: centsToInput(unit), priceEdited: false };
      }),
    );
  }

  const parsed = useMemo(() => {
    const lines = cart.map((line) => ({
      ...line,
      unitPriceCents: parseMoneyToCents(line.unitPriceText),
      qtyThousandths: parseQtyThousandths(line.qtyText),
    }));
    const linesOk = lines.every(
      (line) =>
        line.unitPriceCents != null &&
        line.qtyThousandths != null &&
        line.qtyThousandths > 0n,
    );
    const payRows = payments.map((pay) => {
      const text = pay.amountText.trim();
      return {
        ...pay,
        amountCents: text === "" ? 0n : parseMoneyToCents(text),
      };
    });
    const paymentsOk = payRows.every((pay) => pay.amountCents != null);
    const quote = quoteSale({
      lines: lines.filter(
        (line) => line.unitPriceCents != null && line.qtyThousandths != null,
      ),
      payments: payRows.filter((pay) => pay.amountCents != null),
      saleCurrency,
      rateTt,
      changeCurrency,
    });
    return { lines, linesOk, payRows, paymentsOk, quote };
  }, [cart, payments, saleCurrency, rateTt, changeCurrency]);

  const { lines, linesOk, payRows, paymentsOk, quote } = parsed;
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const canConfirm =
    !busy &&
    paymentsOk &&
    canConfirmSale({
      condition,
      quote,
      itemCount: cart.length,
      canOperate: ops.canOperate,
      hasCustomer: Boolean(customerId),
      linesOk,
    });

  const filteredCustomers = customers.filter((c) => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.doc_number ?? "").toLowerCase().includes(q)
    );
  });

  async function confirm() {
    if (!canConfirm) return;
    const validLines = lines.filter(
      (line) => line.unitPriceCents != null && line.qtyThousandths != null && line.qtyThousandths > 0n,
    );
    const change =
      quote.hasChange && quote.changeAmountCents > 0n
        ? { currency: changeCurrency, amountCents: quote.changeAmountCents }
        : null;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_sale", {
      p_organization_id: organizationId,
      p_terminal_id: ops.terminalId,
      p_condition: condition,
      p_currency: saleCurrency,
      p_items: buildSaleItems(validLines),
      p_payments: buildPayments(
        payRows.map((pay) => ({
          method: pay.method,
          currency: pay.currency,
          amountCents: pay.amountCents,
          reference: pay.method === "efectivo" ? "" : pay.reference,
        })),
        change,
      ),
      p_customer_id: condition === "credito" ? customerId : null,
      p_notes: null,
    });
    setBusy(false);
    if (error) {
      showError(rpcErrorMessage(error));
      return;
    }
    const totalCents = parseMoneyToCents(data?.total);
    const shown =
      totalCents == null
        ? String(data?.total ?? "")
        : formatCents(totalCents, data?.currency ?? saleCurrency);
    showSuccess(`Venta Nº ${data?.number} — ${shown}`);
    setSaleCurrency("UYU");
    setChangeCurrency("UYU");
    setCondition("contado");
    setCustomerId(null);
    setCustomerQuery("");
    setCart([]);
    setPayments([emptyPayment("UYU")]);
    setQuery("");
    setResults([]);
    searchRef.current?.focus();
  }

  function paymentEquivalent(pay) {
    if (pay.amountCents == null || pay.amountCents <= 0n) return null;
    return convertCents(pay.amountCents, pay.currency, saleCurrency, rateTt);
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        py: 2,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(500px, 1.08fr)" },
        gap: 3,
        alignItems: "stretch",
      }}
    >
      <Box sx={{ minWidth: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={saleCurrency}
        onChange={(_, value) => value && setSaleCurrencyTo(value)}
      >
        <ToggleButton value="UYU">UYU ($)</ToggleButton>
        <ToggleButton value="USD">USD (U$S)</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ position: "relative", maxWidth: 480 }}>
        <TextField
          inputRef={searchRef}
          autoFocus
          fullWidth
          size="small"
          label="Buscar producto"
          placeholder="Nombre, SKU o código de barras"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        {results.length > 0 && (
          <Paper
            variant="outlined"
            sx={{ position: "absolute", zIndex: 2, left: 0, right: 0, mt: 0.5 }}
          >
            {results.map((row) => {
              const cents = parseMoneyToCents(row.price);
              return (
                <Button
                  key={row.id}
                  fullWidth
                  onClick={() => addFromSearch(row.id)}
                  sx={{ justifyContent: "space-between", textTransform: "none" }}
                >
                  <span>
                    {row.name}
                    {row.sku ? ` · ${row.sku}` : ""}
                  </span>
                  <span>{cents == null ? "" : formatCents(cents, row.currency)}</span>
                </Button>
              );
            })}
          </Paper>
        )}
      </Box>

      <Stack spacing={1.25}>
        {lines.map((line) => {
          const sub =
            line.unitPriceCents != null && line.qtyThousandths != null
              ? lineTotalCents(line.unitPriceCents, line.qtyThousandths)
              : null;
          return (
            <Stack
              key={line.productId}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 1.5, py: 1, borderRadius: 1, boxShadow: rowShadow }}
            >
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {line.name}
              </Typography>
              <TextField
                size="small"
                label="Cant."
                value={line.qtyText}
                onChange={(e) =>
                  setCart((rows) =>
                    rows.map((item) =>
                      item.productId === line.productId
                        ? { ...item, qtyText: e.target.value }
                        : item,
                    ),
                  )
                }
                inputProps={{ inputMode: "decimal" }}
                sx={{ width: 88 }}
              />
              <TextField
                size="small"
                label="Precio"
                value={line.unitPriceText}
                onChange={(e) =>
                  setCart((rows) =>
                    rows.map((item) =>
                      item.productId === line.productId
                        ? {
                            ...item,
                            unitPriceText: e.target.value,
                            priceEdited: true,
                          }
                        : item,
                    ),
                  )
                }
                inputProps={{ inputMode: "decimal" }}
                sx={{ width: 110 }}
              />
              <Typography variant="body2" sx={{ width: 96, textAlign: "right", flexShrink: 0 }}>
                {sub == null ? "—" : formatCents(sub, saleCurrency)}
              </Typography>
              <Button
                size="small"
                aria-label="Quitar"
                onClick={() =>
                  setCart((rows) => rows.filter((item) => item.productId !== line.productId))
                }
                sx={{ minWidth: 0, px: 1, fontSize: 18, lineHeight: 1 }}
              >
                ×
              </Button>
            </Stack>
          );
        })}
        {Array.from({ length: Math.max(0, LIST_SLOTS - lines.length) }, (_, i) => (
          <Box
            key={`slot-${i}`}
            aria-hidden
            sx={{ height: 52, borderRadius: 1, boxShadow: rowShadow }}
          />
        ))}
      </Stack>
      </Box>

      <Box
        sx={{
          minWidth: 0,
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Pago
      </Typography>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={condition}
        onChange={(_, value) => value && setCondition(value)}
      >
        <ToggleButton value="contado">Contado</ToggleButton>
        <ToggleButton value="credito">Crédito</ToggleButton>
      </ToggleButtonGroup>

      {condition === "credito" && (
        <Box sx={{ maxWidth: 420 }}>
          <TextField
            size="small"
            fullWidth
            label="Cliente"
            placeholder="Nombre o documento"
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setCustomerId(null);
            }}
          />
          <Paper variant="outlined" sx={{ mt: 0.5, maxHeight: 180, overflow: "auto" }}>
            <Button
              fullWidth
              onClick={() => setNewCustomerOpen(true)}
              sx={{ justifyContent: "flex-start", textTransform: "none", fontWeight: 600 }}
            >
              + Nuevo cliente
            </Button>
            {filteredCustomers.slice(0, 30).map((c) => (
              <Button
                key={c.id}
                fullWidth
                onClick={() => {
                  setCustomerId(c.id);
                  setCustomerQuery(c.name);
                }}
                sx={{
                  justifyContent: "flex-start",
                  textTransform: "none",
                  bgcolor: c.id === customerId ? "action.selected" : undefined,
                }}
              >
                {c.name}
                {c.doc_number ? ` · ${c.doc_type ?? ""} ${c.doc_number}` : ""}
              </Button>
            ))}
            {filteredCustomers.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No hay clientes
              </Typography>
            )}
          </Paper>
          {customer && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {customer.name}
            </Typography>
          )}
        </Box>
      )}

      <Stack spacing={1.5}>
        {payments.map((pay) => {
          const parsedPay = payRows.find((row) => row.key === pay.key);
          const equiv = parsedPay ? paymentEquivalent(parsedPay) : null;
          return (
            <Stack key={pay.key} spacing={1} sx={{ pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  size="small"
                  label="Medio"
                  value={pay.method}
                  onChange={(e) =>
                    setPayments((rows) =>
                      rows.map((item) =>
                        item.key === pay.key ? { ...item, method: e.target.value } : item,
                      ),
                    )
                  }
                  sx={{ flex: 1, minWidth: 140, maxWidth: 220 }}
                >
                  {METHODS.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Moneda"
                  value={pay.currency}
                  onChange={(e) =>
                    setPayments((rows) =>
                      rows.map((item) =>
                        item.key === pay.key ? { ...item, currency: e.target.value } : item,
                      ),
                    )
                  }
                  sx={{ width: 96, flexShrink: 0 }}
                >
                  <MenuItem value="UYU">$</MenuItem>
                  <MenuItem value="USD">U$S</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  label="Importe"
                  value={pay.amountText}
                  onChange={(e) =>
                    setPayments((rows) =>
                      rows.map((item) =>
                        item.key === pay.key ? { ...item, amountText: e.target.value } : item,
                      ),
                    )
                  }
                  inputProps={{ inputMode: "decimal" }}
                  sx={{ width: 120, flexShrink: 0 }}
                />
                <Button
                  size="small"
                  aria-label="Quitar"
                  onClick={() => setPayments((rows) => rows.filter((item) => item.key !== pay.key))}
                  sx={{ flexShrink: 0, minWidth: 0, px: 1, fontSize: 18, lineHeight: 1 }}
                >
                  ×
                </Button>
              </Stack>
              {pay.method !== "efectivo" && (
                <TextField
                  size="small"
                  fullWidth
                  label="Referencia"
                  value={pay.reference}
                  onChange={(e) =>
                    setPayments((rows) =>
                      rows.map((item) =>
                        item.key === pay.key ? { ...item, reference: e.target.value } : item,
                      ),
                    )
                  }
                />
              )}
              {equiv != null && (
                <Typography variant="body2" color="text.secondary">
                  {formatCents(equiv, saleCurrency)}
                </Typography>
              )}
            </Stack>
          );
        })}
        <Box>
          <Button size="small" onClick={() => setPayments((rows) => [...rows, emptyPayment(saleCurrency)])}>
            Agregar pago
          </Button>
        </Box>
      </Stack>

      <Stack spacing={0.5}>
        <Typography>Total: {formatCents(quote.totalCents, saleCurrency)}</Typography>
        <Typography>Pagado: {formatCents(quote.paidCents, saleCurrency)}</Typography>
        {quote.hasChange && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>
              Vuelto: {formatCents(quote.changeAmountCents, changeCurrency)}
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={changeCurrency}
              onChange={(_, value) => value && setChangeCurrency(value)}
            >
              <ToggleButton value="UYU">$</ToggleButton>
              <ToggleButton value="USD">U$S</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        )}
        {quote.faltaCents > 0n && (
          <Typography>
            {faltaLabel(
              quote.faltaCents,
              saleCurrency,
              quote.faltaOtherCents,
              otherCurrency(saleCurrency),
            )}
          </Typography>
        )}
        {quote.sobraCents > 0n && (
          <Typography>Sobran: {formatCents(quote.sobraCents, saleCurrency)}</Typography>
        )}
      </Stack>

      <Box>
        <Button variant="contained" disabled={!canConfirm} onClick={confirm}>
          Confirmar
        </Button>
      </Box>
      </Box>

      <CustomerDialog
        open={newCustomerOpen}
        customer={null}
        onClose={() => setNewCustomerOpen(false)}
        onSaved={handleCustomerCreated}
      />
    </Box>
  );
}
