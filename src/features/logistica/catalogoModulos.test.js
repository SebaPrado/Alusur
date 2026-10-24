import { describe, expect, it } from "vitest";
import {
  claveCatalogo,
  etiquetaOpcion,
  existeEnCatalogo,
  normalizarCodigoTipo,
  opcionesDeCatalogo,
} from "./catalogoModulos";

describe("normalizarCodigoTipo", () => {
  it("quita espacios y pasa a mayúsculas", () => {
    expect(normalizarCodigoTipo("ce 10.1")).toBe("CE10.1");
    expect(normalizarCodigoTipo(" COL. GRC ")).toBe("COL.GRC");
  });
});

describe("etiquetaOpcion", () => {
  it("arma etiqueta principal y complemento", () => {
    expect(
      etiquetaOpcion({
        codigo: "CE10.2",
        pieza: "principal",
        descripcion: "Módulo vidriado terraza",
      }),
    ).toBe("CE10.2 · Módulo vidriado terraza");
    expect(
      etiquetaOpcion({
        codigo: "CE10.2",
        pieza: "complemento",
        descripcion: "Ventana corrediza 3H",
      }),
    ).toBe("CE10.2 · Ventana corrediza 3H (complemento)");
  });
});

describe("opcionesDeCatalogo / existeEnCatalogo", () => {
  const cat = [
    { codigo: "CE10.1", pieza: "principal", categoria: "ventana", descripcion: "Fijo" },
    { codigo: "CE10.2", pieza: "complemento", categoria: "ventana", descripcion: "Corrediza" },
  ];

  it("genera opciones con key y filterText", () => {
    const ops = opcionesDeCatalogo(cat);
    expect(ops).toHaveLength(2);
    expect(ops[0].key).toBe(claveCatalogo("CE10.1", "principal"));
    expect(ops[0].filterText).toContain("10.1");
  });

  it("existeEnCatalogo normaliza código y pieza", () => {
    expect(existeEnCatalogo(cat, "ce 10.1", "principal")).toBe(true);
    expect(existeEnCatalogo(cat, "CE10.2", "complemento")).toBe(true);
    expect(existeEnCatalogo(cat, "CE10.7", "principal")).toBe(false);
  });
});
