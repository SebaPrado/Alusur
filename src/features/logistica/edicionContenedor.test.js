import { describe, expect, it } from "vitest";
import {
  confirmacionCoincide,
  estadosAlcanzables,
  puedeEliminar,
} from "./edicionContenedor";

describe("puedeEliminar", () => {
  it("solo en nivel libre", () => {
    expect(puedeEliminar("libre")).toBe(true);
    expect(puedeEliminar("con_motivo")).toBe(false);
    expect(puedeEliminar("bloqueado")).toBe(false);
    expect(puedeEliminar("anulado")).toBe(false);
    expect(puedeEliminar(null)).toBe(false);
  });

  it("el CEO también borra contenedores de prueba que ya salieron de producción", () => {
    expect(puedeEliminar("con_motivo", true)).toBe(true);
    expect(puedeEliminar("bloqueado", true)).toBe(true);
    expect(puedeEliminar("anulado", true)).toBe(false);
    expect(puedeEliminar(null, true)).toBe(false);
  });
});

describe("estadosAlcanzables", () => {
  const transiciones = [
    { from_state: "en_produccion", to_state: "en_camino" },
    { from_state: "en_camino", to_state: "en_produccion" },
    { from_state: "en_camino", to_state: "en_puerto" },
    { from_state: "en_obra", to_state: "descargado" },
  ];

  it("lista avance y corrección desde el estado actual", () => {
    expect(estadosAlcanzables("en_camino", transiciones)).toEqual([
      "en_produccion",
      "en_puerto",
    ]);
    expect(estadosAlcanzables("en_produccion", transiciones)).toEqual(["en_camino"]);
    expect(estadosAlcanzables("descargado", transiciones)).toEqual([]);
  });
});

describe("confirmacionCoincide", () => {
  it("exige el código completo", () => {
    expect(confirmacionCoincide("cip-c-0007", "CIP-C-0007")).toBe(true);
    expect(confirmacionCoincide("CIP C 0007", "CIP-C-0007")).toBe(true);
    expect(confirmacionCoincide("C-0007", "CIP-C-0007")).toBe(false);
    expect(confirmacionCoincide("", "CIP-C-0007")).toBe(false);
  });
});
