import { describe, expect, it } from "vitest";
import {
  digitoControl,
  ejemploCodigoModulo,
  esCodigoContenedor,
  esCodigoModulo,
  normalizarCodigo,
  partesCodigo,
  prefijoObraValido,
} from "./codigos";

describe("normalizarCodigo", () => {
  it("con prefijo, deja el código completo", () => {
    expect(normalizarCodigo("CIP-C-0001-07-6")).toBe("CIP-C-0001-07-6");
    expect(normalizarCodigo("CIP-C-0001")).toBe("CIP-C-0001");
  });

  it("sin prefijo, asume la obra activa y no inventa uno", () => {
    expect(normalizarCodigo("C-0142-07-K")).toBe("C-0142-07-K");
    expect(normalizarCodigo("C-0142")).toBe("C-0142");
  });

  it("sin guiones, los reinserta", () => {
    expect(normalizarCodigo("CIPC0001074")).toBe("CIP-C-0001-07-4");
    expect(normalizarCodigo("C014207K")).toBe("C-0142-07-K");
    expect(normalizarCodigo("CIPC0001")).toBe("CIP-C-0001");
    expect(normalizarCodigo("C0001")).toBe("C-0001");
  });

  it("pasa a mayúsculas y saca espacios", () => {
    expect(normalizarCodigo(" cip-c-0001-07-k ")).toBe("CIP-C-0001-07-K");
    expect(normalizarCodigo("cip c 0001 07 k")).toBe("CIP-C-0001-07-K");
    expect(normalizarCodigo("c-0142-07-k")).toBe("C-0142-07-K");
  });
});

describe("partesCodigo", () => {
  it("separa prefijo, contenedor, posición y control", () => {
    expect(partesCodigo("cipc0001074")).toEqual({
      prefijo: "CIP",
      contenedor: "0001",
      posicion: "07",
      control: "4",
    });
    expect(partesCodigo("C-0142")).toEqual({
      prefijo: null,
      contenedor: "0142",
      posicion: null,
      control: null,
    });
  });
});

describe("esCodigoContenedor y esCodigoModulo", () => {
  it("aceptan contenedor con y sin prefijo", () => {
    expect(esCodigoContenedor("CIP-C-0001")).toBe(true);
    expect(esCodigoContenedor("c0001")).toBe(true);
    expect(esCodigoContenedor("CIP-C-0001-07-K")).toBe(false);
  });

  it("el dígito de control se calcula sobre todo el código", () => {
    expect(digitoControl("C-0142-07")).toBe("O");
    expect(esCodigoModulo("C-0142-07-O")).toBe(true);
    expect(esCodigoModulo("c014207o")).toBe(true);
    expect(esCodigoModulo("cipc0001016")).toBe(true);
    expect(normalizarCodigo("cip c 0001 01 6")).toBe("CIP-C-0001-01-6");
  });

  it("rechaza un dígito de control mal", () => {
    expect(esCodigoModulo("C-0142-07-K")).toBe(false);
    expect(esCodigoModulo("CIP-C-0001-07-K")).toBe(false);
    expect(esCodigoModulo("C-0142")).toBe(false);
  });
});

// Valores generados por public.luhn36_check en Postgres: el front debe coincidir
const DESDE_LA_BASE = [
  ["CIP-C-0001-01", "6"],
  ["CIP-C-0002-01", "4"],
  ["CIP-C-0002-02", "2"],
  ["CIP-C-0002-03", "0"],
  ["UCU-C-0001-01", "W"],
  ["UCU-C-0001-02", "U"],
];

describe("dígito de control contra la base", () => {
  it.each(DESDE_LA_BASE)("%s → %s", (base, digito) => {
    expect(digitoControl(base)).toBe(digito);
    expect(esCodigoModulo(`${base}-${digito}`)).toBe(true);
    const mal = digito === "0" ? "1" : "0";
    expect(esCodigoModulo(`${base}-${mal}`)).toBe(false);
  });
});

describe("prefijo de obra", () => {
  it("acepta vacío o una letra y dos letras o números", () => {
    expect(prefijoObraValido("")).toBe(true);
    expect(prefijoObraValido("cip")).toBe(true);
    expect(prefijoObraValido("U1A")).toBe(true);
    expect(prefijoObraValido("1CU")).toBe(false);
    expect(prefijoObraValido("CI")).toBe(false);
    expect(ejemploCodigoModulo("cip")).toBe("CIP-C-0142-07-K");
    expect(ejemploCodigoModulo("")).toBe("C-0142-07-K");
  });
});
