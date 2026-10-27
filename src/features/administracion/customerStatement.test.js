import { describe, expect, it } from "vitest";
import {
  buildCustomerStatement,
  customerDocErrorMessage,
} from "./customerStatement";

describe("buildCustomerStatement", () => {
  it("venta en UYU va a debe $", () => {
    const rows = buildCustomerStatement(
      [
        {
          id: "s1",
          kind: "venta",
          number: 12,
          currency: "UYU",
          total: 1000,
          status: "completada",
          created_at: "2026-01-02T10:00:00Z",
        },
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].concept).toBe("Venta Nº 12");
    expect(rows[0].debeUyu).toBe(1000);
    expect(rows[0].haberUyu).toBeNull();
    expect(rows[0].debeUsd).toBeNull();
  });

  it("pago en pesos que cancela dólares usa applied (haber U$S)", () => {
    const rows = buildCustomerStatement(
      [],
      [
        {
          id: "p1",
          kind: "cobranza",
          currency: "UYU",
          amount: 1000,
          applied_currency: "USD",
          applied_amount: 25,
          status: "vigente",
          created_at: "2026-01-03T10:00:00Z",
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].concept).toBe("Cobranza");
    expect(rows[0].haberUsd).toBe(25);
    expect(rows[0].haberUyu).toBeNull();
    expect(rows[0].debeUyu).toBeNull();
  });

  it("pago de venta, vuelto y reintegro mapean bien", () => {
    const rows = buildCustomerStatement(
      [],
      [
        {
          id: "a",
          kind: "venta",
          applied_currency: "UYU",
          applied_amount: 500,
          status: "vigente",
          created_at: "2026-01-01T10:00:00Z",
        },
        {
          id: "b",
          kind: "vuelto",
          applied_currency: "UYU",
          applied_amount: 50,
          status: "vigente",
          created_at: "2026-01-01T10:01:00Z",
        },
        {
          id: "c",
          kind: "reintegro",
          applied_currency: "USD",
          applied_amount: 10,
          status: "vigente",
          created_at: "2026-01-01T10:02:00Z",
        },
      ],
    );
    expect(rows.map((r) => [r.concept, r.haberUyu, r.debeUyu, r.debeUsd])).toEqual([
      ["Reintegro", null, null, 10],
      ["Vuelto", null, 50, null],
      ["Pago de venta", 500, null, null],
    ]);
  });

  it("anulados quedan marcados y ordena del más reciente al más antiguo", () => {
    const rows = buildCustomerStatement(
      [
        {
          id: "s1",
          kind: "venta",
          number: 1,
          currency: "USD",
          total: 30,
          status: "anulada",
          created_at: "2026-01-05T10:00:00Z",
        },
      ],
      [
        {
          id: "p1",
          kind: "cobranza",
          applied_currency: "USD",
          applied_amount: 10,
          status: "anulado",
          created_at: "2026-01-04T10:00:00Z",
        },
      ],
    );
    expect(rows[0].voided).toBe(true);
    expect(rows[0].concept).toBe("Venta Nº 1");
    expect(rows[1].voided).toBe(true);
    expect(rows[1].concept).toBe("Cobranza");
  });
});

describe("customerDocErrorMessage", () => {
  it("detecta el índice de documento duplicado", () => {
    expect(
      customerDocErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "admin_customers_doc_uq"',
      }),
    ).toBe("Ya existe un cliente con ese documento");
  });

  it("ignora otros errores", () => {
    expect(customerDocErrorMessage({ code: "23505", message: "other" })).toBeNull();
  });
});
