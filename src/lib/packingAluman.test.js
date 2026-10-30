import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  clasificarLineas,
  filasDesdeFixture,
  normalizarRotulo,
  parseFechaAluman,
  parsePackingAluman,
} from "./packingAluman";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = JSON.parse(
  readFileSync(
    join(root, "fixtures/fixture_packing_hotel_soho_envio6.json"),
    "utf8",
  ),
);

function miniFixture(overrides = {}) {
  return {
    numero_envio: 6,
    fecha_carga: "2026-10-13",
    bultos_declarados: 2,
    peso_declarado_kg: 962,
    matricula: null,
    contenedor_iso: null,
    archivo_origen: "test.xlsx",
    bultos: [
      {
        numero: 5,
        peso_bruto_kg: 662,
        dimensiones: "4050 X 570 X 360",
        lineas: [
          {
            lote: "13",
            referencia: "MONTANTES L=3794 CON MECHA",
            cantidad: 20,
            descripcion: "montante",
            hoja: "2",
            hs_code: "76109090",
          },
          {
            lote: "13",
            referencia: "MONTANTES L=3253 CON MECHA",
            cantidad: 8,
            descripcion: "montante",
            hoja: "2",
            hs_code: "76109090",
          },
        ],
      },
      {
        numero: 6,
        peso_bruto_kg: 300,
        dimensiones: "1200 X 800 X 600",
        lineas: [
          {
            lote: "13",
            referencia: "Aux. Obra-001",
            cantidad: 40,
            descripcion: "aux",
            hoja: "2",
            hs_code: "76109090",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("parsePackingAluman · fixture real", () => {
  it("ida y vuelta: 13 bultos, 119 líneas, 5153 kg, sin avisos", () => {
    const filas = filasDesdeFixture(fixture);
    const { data, errores, avisos } = parsePackingAluman(
      filas,
      fixture.archivo_origen,
    );
    expect(errores).toEqual([]);
    expect(avisos).toEqual([]);
    expect(data.bultos).toHaveLength(13);
    expect(data.bultos.reduce((a, b) => a + b.lineas.length, 0)).toBe(119);
    expect(data.peso_declarado_kg).toBe(5153);
    expect(data.bultos_declarados).toBe(13);
    expect(data.numero_envio).toBe(6);
    expect(data.fecha_carga).toBe("2026-10-13");
    expect(data).toEqual(fixture);
  });
});

describe("parsePackingAluman · tolerancia de layout", () => {
  it("ignora el encabezado de tabla repetido (salto de página)", () => {
    const filas = filasDesdeFixture(miniFixture());
    const headerIdx = filas.findIndex(
      (r) =>
        String(r[0] ?? "")
          .toLowerCase()
          .includes("bulto") &&
        String(r[4] ?? "")
          .toLowerCase()
          .includes("referencia"),
    );
    const header = filas[headerIdx];
    // Insertar encabezado repetido entre bultos.
    const mid = headerIdx + 1 + 2; // después de las 2 líneas del bulto 5
    filas.splice(mid, 0, [...header]);
    const { data, errores } = parsePackingAluman(filas, "t.xlsx");
    expect(errores).toEqual([]);
    expect(data.bultos).toHaveLength(2);
    expect(data.bultos.reduce((a, b) => a + b.lineas.length, 0)).toBe(3);
  });

  it("ignora el pie NIMF15 y filas vacías", () => {
    const filas = filasDesdeFixture(miniFixture(), { conPie: true });
    filas.push([]);
    filas.push(["", "", "", "", "", "", "", "", ""]);
    const { data, errores } = parsePackingAluman(filas, "t.xlsx");
    expect(errores).toEqual([]);
    expect(data.bultos).toHaveLength(2);
  });

  it('PESO TOTAL (KG) = "5153 Kg" → 5153; fechas a ISO', () => {
    const filas = filasDesdeFixture(miniFixture({ peso_declarado_kg: 5153 }), {
      pesoComoTexto: true,
    });
    const { data } = parsePackingAluman(filas, "t.xlsx");
    expect(data.peso_declarado_kg).toBe(5153);

    expect(parseFechaAluman("13/10/2026")).toBe("2026-10-13");
    expect(parseFechaAluman(new Date(Date.UTC(2026, 9, 13)))).toBe(
      "2026-10-13",
    );

    const filasFecha = filasDesdeFixture(miniFixture(), { fechaNativa: true });
    const parsed = parsePackingAluman(filasFecha, "t.xlsx");
    expect(parsed.data.fecha_carga).toBe("2026-10-13");
  });

  it("rótulos con y sin acento, con º y con ° → mismo resultado", () => {
    const base = miniFixture();
    const a = parsePackingAluman(
      filasDesdeFixture(base, {
        cabeceraLabels: {
          obra: "OBRA",
          numeroEnvio: "Nº ENVÍO",
          bultos: "Nº BULTOS",
          peso: "PESO TOTAL (KG)",
          fecha: "FECHA DE CARGA",
          matricula: "MATRÍCULA TRANS",
        },
        headers: [
          "Nº BULTO",
          "PESO BRUTO (kg)",
          "DIMENSIONES (MM)",
          "LOTE",
          "REFERENCIA",
          "U.C.",
          "DESCRIPCIÓN",
          "HOJA",
          "HS CODE",
        ],
      }),
      "a.xlsx",
    );
    const b = parsePackingAluman(
      filasDesdeFixture(base, {
        cabeceraLabels: {
          obra: "OBRA",
          numeroEnvio: "N° ENVIO",
          bultos: "N° BULTOS",
          peso: "PESO TOTAL (KG)",
          fecha: "FECHA DE CARGA",
          matricula: "MATRICULA TRANS",
        },
        headers: [
          "N° BULTO",
          "PESO BRUTO (kg)",
          "DIMENSIONES (MM)",
          "LOTE",
          "REFERENCIA",
          "U.C.",
          "DESCRIPCION",
          "HOJA",
          "HS CODE",
        ],
      }),
      "b.xlsx",
    );
    expect(a.errores).toEqual([]);
    expect(b.errores).toEqual([]);
    expect(a.data.bultos).toEqual(b.data.bultos);
    expect(a.data.numero_envio).toBe(b.data.numero_envio);
    expect(normalizarRotulo("Nº ENVÍO")).toBe(normalizarRotulo("N° ENVIO"));
  });

  it("línea antes del primer número de bulto → error", () => {
    const filas = filasDesdeFixture(miniFixture());
    const headerIdx = filas.findIndex(
      (r) =>
        String(r[0] ?? "")
          .toLowerCase()
          .includes("bulto") &&
        String(r[4] ?? "")
          .toLowerCase()
          .includes("referencia"),
    );
    filas.splice(headerIdx + 1, 0, [
      "",
      "",
      "",
      "13",
      "SIN BULTO AUN",
      1,
      "x",
      "1",
      "76109090",
    ]);
    const { data, errores } = parsePackingAluman(filas, "t.xlsx");
    expect(data).toBeNull();
    expect(errores.some((e) => /antes del primer número de bulto/i.test(e))).toBe(
      true,
    );
  });

  it("peso declarado 5000 → aviso, no error", () => {
    const { data, errores, avisos } = parsePackingAluman(
      filasDesdeFixture(miniFixture({ peso_declarado_kg: 5000 })),
      "t.xlsx",
    );
    expect(errores).toEqual([]);
    expect(data).not.toBeNull();
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0]).toMatch(/5000/);
  });

  it("lote y hs_code que llegan como número → salen como texto", () => {
    const filas = filasDesdeFixture(miniFixture());
    const headerIdx = filas.findIndex(
      (r) =>
        String(r[0] ?? "")
          .toLowerCase()
          .includes("bulto") &&
        String(r[4] ?? "")
          .toLowerCase()
          .includes("referencia"),
    );
    // Primera fila de datos: forzar lote y hs_code numéricos.
    const row = filas[headerIdx + 1];
    row[3] = 13;
    row[8] = 76109090;
    const { data, errores } = parsePackingAluman(filas, "t.xlsx");
    expect(errores).toEqual([]);
    expect(data.bultos[0].lineas[0].lote).toBe("13");
    expect(typeof data.bultos[0].lineas[0].lote).toBe("string");
    expect(data.bultos[0].lineas[0].hs_code).toBe("76109090");
    expect(typeof data.bultos[0].lineas[0].hs_code).toBe("string");
  });
});

describe("clasificarLineas", () => {
  it("usa referencias_proveedor y después el catálogo", () => {
    const data = {
      bultos: [
        {
          numero: 1,
          lineas: [
            { referencia: "CE 10.1", cantidad: 2 },
            { referencia: "SOLO MATERIAL", cantidad: 5 },
            { referencia: "MAPEADA", cantidad: 3 },
            { referencia: "YA MATERIAL", cantidad: 1 },
          ],
        },
      ],
    };
    const catalogo = [
      { id: "t1", codigo: "CE10.1", pieza: "principal" },
      { id: "t2", codigo: "CE20", pieza: "principal" },
    ];
    const mapeos = [
      { referencia_norm: "MAPEADA", tipo_modulo_id: "t2" },
      { referencia_norm: "YAMATERIAL", tipo_modulo_id: null },
    ];
    const r = clasificarLineas(data, mapeos, catalogo);
    expect(r.lineasMaterial).toBe(2);
    expect(r.porCodigo).toEqual([
      { codigo: "CE10.1", cantidad: 2 },
      { codigo: "CE20", cantidad: 3 },
    ]);
    expect(r.totalModulos).toBe(5);
  });
});
