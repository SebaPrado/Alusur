import { describe, expect, it } from "vitest";
import { buildLedgerCsv } from "./ledgerCsv";

describe("buildLedgerCsv", () => {
  it("abre en columnas de Excel (separador ; y montos con coma)", () => {
    const csv = buildLedgerCsv([
      {
        created_at: "2026-10-27T19:32:47.000Z",
        event_type: "venta",
        number: 7,
        customer_name: "Solita",
        detail: "Racion Engorde x1",
        currency: "UYU",
        amount: 3000,
        payment_methods: "efectivo UYU",
        cash_delta_uyu: 3000,
        cash_delta_usd: 0,
        cash_balance_uyu: -124.9,
        cash_balance_usd: 400,
        user_name: "Matias",
        terminal_name: "Caja 1",
        status: "completada",
      },
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith("\uFEFFsep=;")).toBe(true);

    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("sep=;");
    const headers = lines[1].split(";");
    expect(headers).toHaveLength(15);
    expect(headers[0]).toBe("fecha_hora");
    expect(headers[6]).toBe("importe");

    const cells = lines[2].split(";");
    expect(cells).toHaveLength(15);
    expect(cells[1]).toBe("venta");
    expect(cells[3]).toBe("Solita");
    expect(cells[6]).toMatch(/3\.000,00/);
    expect(cells[14]).toBe("completada");
  });

  it("no parte un detalle que trae punto y coma", () => {
    const csv = buildLedgerCsv([
      {
        created_at: "2026-10-27T19:32:47.000Z",
        event_type: "venta",
        number: 1,
        customer_name: "A; B",
        detail: 'dice "hola"',
        currency: "UYU",
        amount: 10,
        payment_methods: "",
        cash_delta_uyu: null,
        cash_delta_usd: null,
        cash_balance_uyu: 0,
        cash_balance_usd: 0,
        user_name: "",
        terminal_name: "",
        status: "completada",
      },
    ]);
    const data = csv.replace(/^\uFEFF/, "").split("\r\n")[2];
    expect(data).toContain('"A; B"');
    expect(data).toContain('"dice ""hola"""');
  });
});
