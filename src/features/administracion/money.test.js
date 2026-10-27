import { describe, expect, it } from "vitest";
import { formatCents, formatMoney, roundMoneyCents, signedMoney } from "./money";

describe("escala de moneda", () => {
  it("pesos sin decimales, medio peso hacia arriba", () => {
    expect(formatCents(122305n, "UYU")).toBe("$ 1.223");
    expect(formatCents(122350n, "UYU")).toBe("$ 1.224");
    expect(formatMoney(3000, "UYU")).toBe("$ 3.000");
    expect(formatMoney(0, "UYU")).toBe("$ 0");
    expect(roundMoneyCents(1050n, "UYU")).toBe(1100n);
  });

  it("dólares con un decimal", () => {
    expect(formatCents(3050n, "USD")).toBe("U$S 30,5");
    expect(formatCents(3055n, "USD")).toBe("U$S 30,6");
    expect(formatCents(0n, "USD")).toBe("U$S 0,0");
    expect(formatMoney(400, "USD")).toBe("U$S 400,0");
    expect(roundMoneyCents(3054n, "USD")).toBe(3050n);
  });

  it("el signo queda fuera del monto", () => {
    expect(signedMoney(-124.9, "UYU")).toBe("−$ 125");
    expect(signedMoney(30.54, "USD")).toBe("+U$S 30,5");
  });
});
