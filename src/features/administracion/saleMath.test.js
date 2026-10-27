import { describe, expect, it } from "vitest";
import { faltaLabel } from "./money";
import {
  buildPayments,
  convertCents,
  lineTotalCents,
  parseMoneyToCents,
  quoteSale,
  rateToTenThousandths,
} from "./saleMath";

describe("convertCents", () => {
  it("cotización 40,1 y precio 30,5 USD → 1.223 UYU", () => {
    const rate = rateToTenThousandths("40,1");
    expect(rate).toBe(401000n);
    const cents = convertCents(parseMoneyToCents("30.50"), "USD", "UYU", rate);
    expect(cents).toBe(122300n);
    expect(faltaLabel(3050n, "USD", cents, "UYU")).toBe(
      "Falta: U$S 30,5 (= $ 1.223)",
    );
  });

  it("misma moneda ajusta a la escala (pesos enteros) y no convierte", () => {
    expect(convertCents(100000n, "UYU", "UYU", 401000n)).toBe(100000n);
    expect(convertCents(1050n, "UYU", "UYU", 401000n)).toBe(1100n);
    expect(convertCents(3055n, "USD", "USD", 401000n)).toBe(3060n);
  });

  it("sin cotización no convierte", () => {
    expect(convertCents(1000n, "USD", "UYU", null)).toBeNull();
  });
});

describe("subtotal", () => {
  it("redondea precio × cantidad una sola vez", () => {
    expect(lineTotalCents(1000n, 1005n)).toBe(1005n);
    expect(lineTotalCents(100n, 1005n)).toBe(101n);
  });
});

describe("p_payments", () => {
  const rate40 = rateToTenThousandths("40");
  const rate401 = rateToTenThousandths("40.1");

  it("ejemplo 1: contado, vuelto en la misma moneda", () => {
    const quote = quoteSale({
      lines: [{ unitPriceCents: 150000n, qtyThousandths: 1000n }],
      payments: [{ method: "efectivo", currency: "UYU", amountCents: 200000n }],
      saleCurrency: "UYU",
      rateTt: rate40,
      changeCurrency: "UYU",
    });
    expect(quote.netCents).toBe(quote.totalCents);
    expect(quote.changeAmountCents).toBe(50000n);
    expect(
      buildPayments(
        [{ method: "efectivo", currency: "UYU", amountCents: 200000n }],
        { currency: "UYU", amountCents: quote.changeAmountCents },
      ),
    ).toEqual([
      { method: "efectivo", currency: "UYU", amount: "2000.00" },
      { method: "efectivo", currency: "UYU", amount: "500.00", change: true },
    ]);
  });

  it("ejemplo 2: paga dólares, vuelto en pesos", () => {
    const quote = quoteSale({
      lines: [{ unitPriceCents: 100000n, qtyThousandths: 1000n }],
      payments: [{ method: "efectivo", currency: "USD", amountCents: 3000n }],
      saleCurrency: "UYU",
      rateTt: rate40,
      changeCurrency: "UYU",
    });
    expect(quote.paidCents).toBe(120000n);
    expect(quote.changeAmountCents).toBe(20000n);
    expect(quote.netCents).toBe(100000n);
    expect(
      buildPayments(
        [{ method: "efectivo", currency: "USD", amountCents: 3000n }],
        { currency: "UYU", amountCents: 20000n },
      ),
    ).toEqual([
      { method: "efectivo", currency: "USD", amount: "30.00" },
      { method: "efectivo", currency: "UYU", amount: "200.00", change: true },
    ]);
  });

  it("ejemplo 3: vuelto en la otra moneda no cierra; en pesos sí", () => {
    const base = {
      lines: [{ unitPriceCents: 100000n, qtyThousandths: 1000n }],
      payments: [{ method: "efectivo", currency: "USD", amountCents: 2500n }],
      saleCurrency: "UYU",
      rateTt: rate401,
    };
    const usd = quoteSale({ ...base, changeCurrency: "USD" });
    expect(usd.paidCents).toBe(100300n);
    expect(usd.changeAmountCents).toBe(10n);
    expect(usd.changeAppliedCents).toBe(400n);
    expect(usd.netCents).toBe(99900n);
    expect(usd.netCents === usd.totalCents).toBe(false);

    const uyu = quoteSale({ ...base, changeCurrency: "UYU" });
    expect(uyu.changeAmountCents).toBe(300n);
    expect(uyu.netCents).toBe(100000n);
  });

  it("ejemplo 4: crédito, falta 60 dólares", () => {
    const quote = quoteSale({
      lines: [{ unitPriceCents: 10000n, qtyThousandths: 1000n }],
      payments: [
        {
          method: "transferencia",
          currency: "USD",
          amountCents: 4000n,
          reference: "1234",
        },
      ],
      saleCurrency: "USD",
      rateTt: rate40,
      changeCurrency: "USD",
    });
    expect(quote.hasChange).toBe(false);
    expect(quote.faltaCents).toBe(6000n);
    expect(quote.netCents < quote.totalCents).toBe(true);
    expect(
      buildPayments([
        {
          method: "transferencia",
          currency: "USD",
          amountCents: 4000n,
          reference: "1234",
        },
      ]),
    ).toEqual([
      {
        method: "transferencia",
        currency: "USD",
        amount: "40.00",
        reference: "1234",
      },
    ]);
  });

  it("ejemplo 5: contado mixto sin vuelto", () => {
    const pays = [
      { method: "efectivo", currency: "UYU", amountCents: 40000n },
      {
        method: "pos_debito",
        currency: "UYU",
        amountCents: 60000n,
        reference: "voucher",
      },
    ];
    const quote = quoteSale({
      lines: [{ unitPriceCents: 100000n, qtyThousandths: 1000n }],
      payments: pays,
      saleCurrency: "UYU",
      rateTt: rate40,
      changeCurrency: "UYU",
    });
    expect(quote.hasChange).toBe(false);
    expect(quote.netCents).toBe(quote.totalCents);
    expect(buildPayments(pays)).toEqual([
      { method: "efectivo", currency: "UYU", amount: "400.00" },
      {
        method: "pos_debito",
        currency: "UYU",
        amount: "600.00",
        reference: "voucher",
      },
    ]);
  });

  it("un POS que se pasa no genera vuelto", () => {
    const quote = quoteSale({
      lines: [{ unitPriceCents: 100000n, qtyThousandths: 1000n }],
      payments: [{ method: "pos_debito", currency: "UYU", amountCents: 150000n }],
      saleCurrency: "UYU",
      rateTt: null,
      changeCurrency: "UYU",
    });
    expect(quote.hasChange).toBe(false);
    expect(quote.netCents).toBe(150000n);
    expect(quote.sobraCents).toBe(50000n);
  });
});
