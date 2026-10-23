import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  aplicarModo,
  buildSlots,
  carasSimple,
  validateConfig,
} from "./buildSlots";

const conCaras = (caras, extra = {}) => ({
  ...structuredClone(DEFAULT_CONFIG),
  nombre: "Obra de prueba",
  caras,
  ...extra,
});

const cara = (
  codigo,
  modulos_por_piso = 10,
  secuencia = ["ventana", "panel"],
  entorno = "calle",
) => ({
  codigo,
  nombre: codigo,
  modulos_por_piso,
  secuencia,
  entorno,
});

const CONFIG_OK = { ...structuredClone(DEFAULT_CONFIG), nombre: "Obra de prueba" };

describe("buildSlots", () => {
  it("pisos 1 a 50 con 4 caras de 10 da 2.000 posiciones", () => {
    const slots = buildSlots(CONFIG_OK);
    expect(slots).toHaveLength(2000);
  });

  it("ordena por piso, después cara, después eje", () => {
    const slots = buildSlots(CONFIG_OK);
    expect(slots[0]).toEqual({ piso: 1, caraCodigo: "N", caraOrden: 1, eje: 1, tipo: "ventana" });
    expect(slots[9]).toMatchObject({ piso: 1, caraCodigo: "N", eje: 10 });
    expect(slots[10]).toMatchObject({ piso: 1, caraCodigo: "E", caraOrden: 2, eje: 1 });
    expect(slots[40]).toMatchObject({ piso: 2, caraCodigo: "N", eje: 1 });
    expect(slots.at(-1)).toEqual({ piso: 50, caraCodigo: "O", caraOrden: 4, eje: 10, tipo: "panel" });
  });

  it("incluye piso_desde y piso_hasta", () => {
    const slots = buildSlots({ ...CONFIG_OK, piso_desde: 3, piso_hasta: 3 });
    expect(slots).toHaveLength(40);
    expect(new Set(slots.map((s) => s.piso))).toEqual(new Set([3]));
  });

  it('la secuencia ["ventana","ventana","panel"] en 6 ejes da V,V,P,V,V,P', () => {
    const config = conCaras(
      [cara("N"), cara("E", 6, ["ventana", "ventana", "panel"]), cara("S"), cara("O")],
      { piso_desde: 0, piso_hasta: 0 },
    );
    const este = buildSlots(config).filter((s) => s.caraCodigo === "E");
    expect(este.map((s) => s.eje)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(este.map((s) => s.tipo)).toEqual([
      "ventana",
      "ventana",
      "panel",
      "ventana",
      "ventana",
      "panel",
    ]);
  });

  it("devuelve una lista vacía si la configuración no es válida", () => {
    expect(buildSlots({ ...CONFIG_OK, piso_desde: 10, piso_hasta: 2 })).toEqual([]);
  });

  it("en modo simple genera posiciones de una sola cara", () => {
    const config = aplicarModo(CONFIG_OK, "simple");
    config.piso_desde = 0;
    config.piso_hasta = 1;
    config.caras[0].modulos_por_piso = 4;
    const slots = buildSlots(config);
    expect(slots).toHaveLength(8);
    expect(slots.every((s) => s.caraCodigo === "F")).toBe(true);
  });
});

describe("validateConfig", () => {
  it("la configuración con nombre no tiene errores", () => {
    expect(validateConfig(CONFIG_OK)).toEqual([]);
  });

  it("exige nombre de obra", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual(["La obra necesita un nombre."]);
  });

  it("detecta pisos invertidos", () => {
    const errores = validateConfig({ ...CONFIG_OK, piso_desde: 10, piso_hasta: 2 });
    expect(errores).toEqual(["El piso desde (10) no puede ser mayor que el piso hasta (2)."]);
  });

  it("detecta una cara sin módulos", () => {
    const errores = validateConfig(conCaras([cara("N"), cara("E", 0), cara("S"), cara("O")]));
    expect(errores).toEqual(["La cara E no tiene módulos por piso."]);
  });

  it("detecta una secuencia vacía", () => {
    const errores = validateConfig(conCaras([cara("N"), cara("E"), cara("S", 10, []), cara("O")]));
    expect(errores).toEqual(["La cara S tiene la secuencia vacía."]);
  });

  it("detecta códigos de cara repetidos", () => {
    const errores = validateConfig(conCaras([cara("N"), cara("N"), cara("S"), cara("O")]));
    expect(errores).toEqual(['El código de cara "N" está repetido.']);
  });

  it("detecta una cara sin entorno válido", () => {
    const errores = validateConfig(
      conCaras([
        cara("N"),
        cara("E", 10, undefined, "montaña"),
        cara("S"),
        cara("O", 10, undefined, null),
      ]),
    );
    expect(errores).toEqual([
      "La cara E no tiene un entorno válido (mar, calle, parque o nada).",
      "La cara O no tiene un entorno válido (mar, calle, parque o nada).",
    ]);
  });

  it("acepta nada como entorno", () => {
    expect(
      validateConfig(
        conCaras([
          cara("N", 10, undefined, "nada"),
          cara("E", 10, undefined, "nada"),
          cara("S", 10, undefined, "mar"),
          cara("O", 10, undefined, "nada"),
        ]),
      ),
    ).toEqual([]);
  });

  it("en modo torre exige exactamente 4 caras", () => {
    const errores = validateConfig(
      conCaras([cara("N"), cara("E"), cara("S"), cara("O"), cara("X")]),
    );
    expect(errores).toEqual(["El modo torre necesita exactamente 4 caras (hay 5)."]);
  });

  it("en modo simple exige exactamente 1 cara", () => {
    const errores = validateConfig({
      ...CONFIG_OK,
      modo: "simple",
      vista_simple: "plano",
      caras: [cara("F"), cara("X")],
    });
    expect(errores).toEqual(["El modo simple necesita exactamente 1 cara (hay 2)."]);
  });

  it("acepta modo simple con una cara", () => {
    expect(
      validateConfig({
        ...CONFIG_OK,
        modo: "simple",
        vista_simple: "lamina",
        caras: carasSimple(),
      }),
    ).toEqual([]);
  });

  it("acumula varios errores", () => {
    const errores = validateConfig(
      conCaras([cara("N", 0), cara("N", 10, []), cara("S"), cara("O")], {
        piso_desde: 5,
        piso_hasta: 1,
      }),
    );
    expect(errores).toHaveLength(4);
  });
});

describe("aplicarModo", () => {
  it("pasa a simple con una cara Frente", () => {
    const next = aplicarModo(CONFIG_OK, "simple");
    expect(next.modo).toBe("simple");
    expect(next.caras).toHaveLength(1);
    expect(next.caras[0].codigo).toBe("F");
    expect(next.piso_desde).toBe(CONFIG_OK.piso_desde);
    expect(next.nombre).toBe(CONFIG_OK.nombre);
  });

  it("vuelve a torre con 4 caras", () => {
    const next = aplicarModo(aplicarModo(CONFIG_OK, "simple"), "torre");
    expect(next.modo).toBe("torre");
    expect(next.caras).toHaveLength(4);
  });
});
