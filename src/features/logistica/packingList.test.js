import { describe, expect, it } from "vitest";
import {
  generarReferencias,
  parsePackingCsvText,
  validatePackingRows,
} from "./packingList";
import { PLANTILLA_CSV } from "./estados";

describe("validatePackingRows", () => {
  it("acepta filas válidas", () => {
    const r = validatePackingRows([
      { referencia: "AL-0001", tipo: "ventana" },
      { referencia: "AL-0002", tipo: "panel" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.resumen).toEqual({ total: 2, ventana: 1, panel: 1 });
    expect(r.errors).toEqual([]);
  });

  it("rechaza archivo vacío", () => {
    const r = validatePackingRows([]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/vacío/i);
  });

  it("rechaza referencia repetida", () => {
    const r = validatePackingRows([
      { referencia: "AL-0001", tipo: "ventana" },
      { referencia: "AL-0001", tipo: "panel" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.rows[1].error).toMatch(/repetida/i);
  });

  it("rechaza tipo inválido", () => {
    const r = validatePackingRows([{ referencia: "AL-0001", tipo: "puerta" }]);
    expect(r.ok).toBe(false);
    expect(r.rows[0].error).toMatch(/inválido/i);
  });

  it("rechaza más de 99 módulos", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      referencia: `AL-${String(i).padStart(4, "0")}`,
      tipo: "ventana",
    }));
    const r = validatePackingRows(rows);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/99/);
  });
});

describe("parsePackingCsvText", () => {
  it("parsea la plantilla de ejemplo", () => {
    const r = parsePackingCsvText(PLANTILLA_CSV);
    expect(r.ok).toBe(true);
    expect(r.resumen.total).toBe(3);
    expect(r.resumen.ventana).toBe(2);
    expect(r.resumen.panel).toBe(1);
  });

  it("exige columnas referencia y tipo", () => {
    const r = parsePackingCsvText("foo,bar\n1,2\n");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/columnas/i);
  });

  it("normaliza tipo a minúsculas", () => {
    const r = parsePackingCsvText("referencia,tipo\nAL-1,Ventana\n");
    expect(r.ok).toBe(true);
    expect(r.rows[0].tipo).toBe("ventana");
  });
});

describe("generarReferencias", () => {
  it("arma prefijo + números con padding", () => {
    const rows = generarReferencias({
      prefijo: "AL-",
      desde: 1,
      cantidad: 3,
      digitos: 4,
      tipo: "ventana",
    });
    expect(rows).toEqual([
      { referencia: "AL-0001", tipo: "ventana" },
      { referencia: "AL-0002", tipo: "ventana" },
      { referencia: "AL-0003", tipo: "ventana" },
    ]);
  });

  it("respeta el tipo panel", () => {
    const rows = generarReferencias({
      prefijo: "P-",
      desde: 10,
      cantidad: 2,
      digitos: 3,
      tipo: "panel",
    });
    expect(rows[0]).toEqual({ referencia: "P-010", tipo: "panel" });
    expect(rows[1]).toEqual({ referencia: "P-011", tipo: "panel" });
  });
});
