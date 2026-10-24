import { describe, expect, it } from "vitest";
import {
  detectarColumnasPacking,
  generarReferencias,
  normalizarHeader,
  parsePackingCsvText,
  parsePackingCsvTextConCatalogo,
  validarFilasCatalogo,
  validatePackingRows,
} from "./packingList";
import { PLANTILLA_CSV } from "./estados";

const CAT = [
  { codigo: "CE10.1", pieza: "principal", categoria: "ventana" },
  { codigo: "CE10.2", pieza: "principal", categoria: "ventana" },
  { codigo: "CE10.2", pieza: "complemento", categoria: "ventana" },
  { codigo: "COL. GRC", pieza: "principal", categoria: "panel" },
];

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

describe("parsePackingCsvText (UCU / sin catálogo)", () => {
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

  it("candado: con catalogo vacío el CSV legacy sigue igual", () => {
    const r = parsePackingCsvText(PLANTILLA_CSV);
    expect(r.ok).toBe(true);
    expect(r.rows.every((row) => row.tipo === "ventana" || row.tipo === "panel")).toBe(true);
  });
});

describe("packing con catálogo", () => {
  it("normaliza encabezados con acento", () => {
    expect(normalizarHeader("Código")).toBe("codigo");
  });

  it("detecta columna Código o TIPO", () => {
    expect(detectarColumnasPacking(["referencia", "Código"]).iCodigo).toBe(1);
    expect(detectarColumnasPacking(["referencia", "TIPO"]).iCodigo).toBe(1);
    expect(detectarColumnasPacking(["referencia", "tipo", "codigo"]).iCodigo).toBe(2);
  });

  it("sin pieza asume principal", () => {
    const r = parsePackingCsvTextConCatalogo(
      "referencia,codigo\nAL-1,CE10.1\n",
      CAT,
    );
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({
      referencia: "AL-1",
      codigo_tipo: "CE10.1",
      pieza: "principal",
    });
  });

  it("marca CE10.7 en rojo y ok false", () => {
    const r = parsePackingCsvTextConCatalogo(
      "referencia,codigo\nAL-1,CE10.1\nAL-2,CE10.7\n",
      CAT,
    );
    expect(r.ok).toBe(false);
    expect(r.rows[1].desconocido).toBe(true);
    expect(r.rows[1].error).toMatch(/CE10\.7/);
  });

  it("agrupa por código en el resumen", () => {
    const r = validarFilasCatalogo(
      [
        { referencia: "A", codigo_tipo: "CE10.1", pieza: "principal" },
        { referencia: "B", codigo_tipo: "ce 10.1", pieza: "principal" },
        { referencia: "C", codigo_tipo: "COL. GRC", pieza: "principal" },
      ],
      CAT,
    );
    expect(r.ok).toBe(true);
    expect(r.resumen.porCodigo).toEqual(
      expect.arrayContaining([
        { codigo_tipo: "CE10.1", pieza: "principal", n: 2 },
        { codigo_tipo: "COL.GRC", pieza: "principal", n: 1 },
      ]),
    );
  });

  it("acepta pieza complemento", () => {
    const r = parsePackingCsvTextConCatalogo(
      "referencia,codigo,pieza\nAL-1,CE10.2,complemento\n",
      CAT,
    );
    expect(r.ok).toBe(true);
    expect(r.rows[0].pieza).toBe("complemento");
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

  it("con catálogo genera codigo_tipo y pieza", () => {
    const rows = generarReferencias({
      prefijo: "AL-",
      desde: 1,
      cantidad: 2,
      digitos: 4,
      codigo_tipo: "CE10.1",
      pieza: "principal",
    });
    expect(rows).toEqual([
      { referencia: "AL-0001", codigo_tipo: "CE10.1", pieza: "principal" },
      { referencia: "AL-0002", codigo_tipo: "CE10.1", pieza: "principal" },
    ]);
  });
});
