import { describe, expect, it } from "vitest";
import { buildSlots, DEFAULT_CONFIG } from "./buildSlots";
import { avisoCorte, medidasDesdeSlots, slotsDesdeTorre } from "./slotsDesdeTorre";

const CARAS = [
  { codigo: "N", nombre: "Norte", modulos_por_piso: 10 },
  { codigo: "E", nombre: "Este", modulos_por_piso: 10 },
  { codigo: "S", nombre: "Sur", modulos_por_piso: 10 },
  { codigo: "O", nombre: "Oeste", modulos_por_piso: 10 },
];

function fila({
  cara = "N",
  piso = 1,
  eje = 1,
  nivel = "principal",
  categoria = "ventana",
  codigo = "CE10.1",
  posicion_id = `${cara}-${piso}-${eje}-${nivel}`,
  modulo_id = null,
} = {}) {
  return {
    posicion_id,
    obra_id: "obra",
    cara_codigo: cara,
    piso,
    nivel,
    eje,
    cota_m: null,
    codigo,
    categoria,
    descripcion: null,
    partida: null,
    valor_unitario: null,
    modulo_id,
    modulo_codigo: null,
    modulo_estado: null,
    estado_celda: modulo_id ? "instalado" : "vacia",
    requiere_complemento: false,
    tiene_complemento: false,
  };
}

/** 2.545 filas: 2.449 principal + 96 de otros niveles. */
function filasCiprianiSinteticas() {
  const filas = [];
  const caras = ["N", "E", "S", "O"];
  for (let i = 0; i < 2449; i++) {
    const cara = caras[i % 4];
    const piso = Math.floor(i / 48) + 1; // ~52 pisos × 4 caras × 12 ≈ 2.496
    const eje = (i % 12) + 1;
    filas.push(
      fila({
        cara,
        piso,
        eje,
        codigo: eje === 4 || eje === 10 ? "CE10.3" : "CE10.1",
        posicion_id: `p-${i}`,
      }),
    );
  }
  for (let i = 0; i < 96; i++) {
    filas.push(
      fila({
        cara: caras[i % 4],
        piso: 20 + (i % 2),
        eje: (i % 12) + 1,
        nivel: i % 2 === 0 ? "cubrelosa" : "coronacion",
        posicion_id: `extra-${i}`,
      }),
    );
  }
  return filas;
}

describe("slotsDesdeTorre", () => {
  it("2.545 filas de entrada dan 2.449 slots principal", () => {
    const slots = slotsDesdeTorre(filasCiprianiSinteticas(), CARAS);
    expect(slots).toHaveLength(2449);
    expect(slots.every((s) => s.nivel === "principal")).toBe(true);
  });

  it("mapea campos y caraOrden desde caras ordenadas", () => {
    const slots = slotsDesdeTorre(
      [
        fila({ cara: "E", piso: 23, eje: 4, codigo: "CE10.3", categoria: "ventana" }),
        fila({ cara: "S", piso: 1, eje: 1, nivel: "cubrelosa" }),
      ],
      CARAS,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      piso: 23,
      caraCodigo: "E",
      caraOrden: 2,
      eje: 4,
      tipo: "ventana",
      codigo: "CE10.3",
      nivel: "principal",
    });
  });

  it("ignora cara que no está en fachada_caras", () => {
    const slots = slotsDesdeTorre([fila({ cara: "X" })], CARAS);
    expect(slots).toEqual([]);
  });
});

describe("medidasDesdeSlots", () => {
  it("una cara con eje máximo 12 da ancho 12", () => {
    const slots = Array.from({ length: 12 }, (_, i) => ({
      piso: 10,
      caraCodigo: "N",
      eje: i + 1,
    }));
    const { anchos } = medidasDesdeSlots(slots, CARAS);
    expect(anchos[0]).toBe(12);
    expect(anchos[1]).toBe(10); // sin slots → modulos_por_piso
  });

  it("candado: buildSlots uniforme da los mismos anchos y rango de pisos que la config", () => {
    const config = {
      ...structuredClone(DEFAULT_CONFIG),
      nombre: "UCU",
      piso_desde: 1,
      piso_hasta: 20,
      caras: [
        { codigo: "N", nombre: "Norte", modulos_por_piso: 8, secuencia: ["ventana", "panel"], entorno: "nada" },
        { codigo: "E", nombre: "Este", modulos_por_piso: 6, secuencia: ["ventana", "panel"], entorno: "nada" },
        { codigo: "S", nombre: "Sur", modulos_por_piso: 8, secuencia: ["ventana", "panel"], entorno: "nada" },
        { codigo: "O", nombre: "Oeste", modulos_por_piso: 6, secuencia: ["ventana", "panel"], entorno: "nada" },
      ],
    };
    const slots = buildSlots(config);
    const { anchos, pisoMin, pisoMax, pisos } = medidasDesdeSlots(slots, config.caras);
    expect(anchos).toEqual([8, 6, 8, 6]);
    expect(pisoMin).toBe(1);
    expect(pisoMax).toBe(20);
    expect(pisos[0]).toBe(20);
    expect(pisos.at(-1)).toBe(1);
    expect(pisos).toHaveLength(20);
  });
});

describe("avisoCorte", () => {
  it("1.000 filas exactas dispara la guarda", () => {
    const filas = Array.from({ length: 1000 }, (_, i) => fila({ eje: (i % 12) + 1, posicion_id: i }));
    expect(avisoCorte(filas, "N")).toMatch(/1\.000/);
  });

  it("999 o 1.001 no disparan la guarda", () => {
    expect(avisoCorte(Array(999).fill(fila()), "N")).toBeNull();
    expect(avisoCorte(Array(1001).fill(fila()), "S")).toBeNull();
  });
});
