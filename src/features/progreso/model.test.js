import { describe, expect, it } from "vitest";
import {
  conteos,
  equipoEnFecha,
  esCorreccion,
  estadoVisual,
  fechasModulo,
  pisoInicial,
  seguimiento,
} from "./model";

const pos = (moduloId) => ({ modulo_id: moduloId });
const mod = (estado, contenedor_estado) => ({ estado, contenedor_estado });

describe("estadoVisual", () => {
  it("sin módulo", () => {
    expect(estadoVisual({ modulo_id: null }, null, null)).toBe("sin_modulo");
  });

  it("en producción", () => {
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "en_produccion" })).toBe(
      "produccion",
    );
  });

  it("en camino, puerto y depósito se ven distintos", () => {
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "en_camino" })).toBe("camino");
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "en_puerto" })).toBe("puerto");
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "en_deposito" })).toBe("deposito");
  });

  it("en obra: descargado, o contenedor en obra o descargado", () => {
    expect(estadoVisual(pos("m"), mod("descargado"), { estado: "en_camino" })).toBe("obra");
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "en_obra" })).toBe("obra");
    expect(estadoVisual(pos("m"), mod("en_contenedor"), { estado: "descargado" })).toBe("obra");
  });

  it("usa contenedor_estado del módulo si no hay contenedor aparte", () => {
    expect(estadoVisual(pos("m"), mod("en_contenedor", "en_camino"), null)).toBe("camino");
  });

  it("instalado y terminado", () => {
    expect(estadoVisual(pos("m"), mod("instalado"), null)).toBe("instalado");
    expect(estadoVisual(pos("m"), mod("terminado"), { estado: "en_produccion" })).toBe("terminado");
  });
});

describe("fechasModulo", () => {
  const evC = [
    { id: "1", to_state: "en_camino", created_at: "2026-03-02T12:00:00Z" },
    { id: "2", to_state: "en_camino", created_at: "2026-03-01T12:00:00Z" },
    { id: "3", to_state: "en_obra", created_at: "2026-04-01T12:00:00Z" },
    { id: "4", to_state: "en_puerto", created_at: "2026-03-20T12:00:00Z" },
  ];
  const evM = [
    { id: "a", to_state: "instalado", created_at: "2026-05-01T12:00:00Z" },
    { id: "b", to_state: "descargado", created_at: "2026-05-10T12:00:00Z" },
    { id: "c", to_state: "instalado", created_at: "2026-06-01T12:00:00Z" },
    { id: "d", to_state: "terminado", created_at: "2026-07-01T12:00:00Z" },
  ];

  it("salio es el primero en camino y llego el primero en obra", () => {
    const f = fechasModulo({ estado: "terminado" }, evM, evC);
    expect(f.salio.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(f.llego.toISOString()).toBe("2026-04-01T12:00:00.000Z");
  });

  it("instalado y terminado son el último evento, si el estado llega a esa etapa", () => {
    const f = fechasModulo({ estado: "terminado" }, evM, evC);
    expect(f.instalado.toISOString()).toBe("2026-06-01T12:00:00.000Z");
    expect(f.terminado.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("anula la etapa si el estado actual es anterior", () => {
    const instalado = fechasModulo({ estado: "instalado" }, evM, evC);
    expect(instalado.instalado.toISOString()).toBe("2026-06-01T12:00:00.000Z");
    expect(instalado.terminado).toBeNull();

    const descargado = fechasModulo({ estado: "descargado" }, evM, evC);
    expect(descargado.instalado).toBeNull();
    expect(descargado.terminado).toBeNull();
    expect(descargado.salio).not.toBeNull();
  });
});

describe("equipoEnFecha", () => {
  const miembros = [
    {
      userId: "pepe",
      equipoId: "alfa",
      nombre: "Alfa",
      joinedAt: "2026-01-01T00:00:00Z",
      leftAt: "2026-06-01T00:00:00Z",
    },
    {
      userId: "pepe",
      equipoId: "beta",
      nombre: "Beta",
      joinedAt: "2026-06-01T00:00:00Z",
      leftAt: null,
    },
  ];

  it("una instalación vieja sigue siendo de Alfa aunque ahora esté en Beta", () => {
    expect(equipoEnFecha("pepe", new Date("2026-03-15T15:00:00Z"), miembros)).toEqual({
      id: "alfa",
      nombre: "Alfa",
    });
    expect(equipoEnFecha("pepe", new Date("2026-06-01T00:00:00Z"), miembros)).toEqual({
      id: "beta",
      nombre: "Beta",
    });
    expect(equipoEnFecha("pepe", new Date("2025-12-01T00:00:00Z"), miembros)).toBeNull();
  });
});

describe("esCorreccion", () => {
  it("marca un retroceso y no un avance", () => {
    expect(esCorreccion("modulo", "instalado", "descargado")).toBe(true);
    expect(esCorreccion("modulo", "descargado", "instalado")).toBe(false);
    expect(esCorreccion("contenedor", "en_obra", "en_camino")).toBe(true);
    expect(esCorreccion("modulo", null, "instalado")).toBe(false);
  });
});

describe("seguimiento", () => {
  const equipos = [
    { id: "alfa", nombre: "Alfa" },
    { id: "beta", nombre: "Beta" },
  ];

  it("parte la semana al principio y al final del rango, en hora de Uruguay", () => {
    // Domingo 11/10/2026 22:00 UYT = lunes 12/10 01:00 UTC. Cuenta en esa semana.
    const fechas = [
      {
        piso: 8,
        salio: new Date("2026-10-05T04:00:00Z"),
        llego: null,
        instalado: new Date("2026-10-12T01:00:00Z"),
        terminado: null,
        equipoId: "alfa",
      },
      {
        piso: 9,
        salio: null,
        llego: null,
        instalado: new Date("2026-10-14T15:00:00Z"),
        terminado: null,
        equipoId: "alfa",
      },
      {
        piso: 10,
        salio: null,
        llego: null,
        instalado: new Date("2026-10-15T15:00:00Z"),
        terminado: null,
        equipoId: "alfa",
      },
    ];
    const r = seguimiento(fechas, equipos, "2026-10-07", "2026-10-14", null);
    expect(r.porSemana.map((s) => s.label)).toEqual(["12/10 – 18/10", "05/10 – 11/10"]);
    const primera = r.porSemana[1];
    const segunda = r.porSemana[0];
    expect(primera.salieron).toBe(0);
    expect(primera.instalados).toBe(1);
    expect(segunda.instalados).toBe(1);
    expect(r.totalPeriodo.instalados).toBe(2);
    expect(r.totalPeriodo.salieron).toBe(0);
  });

  it("el filtro de equipo solo afecta instalados y terminados", () => {
    const fechas = [
      {
        piso: 8,
        salio: new Date("2026-10-08T15:00:00Z"),
        llego: new Date("2026-10-10T15:00:00Z"),
        instalado: new Date("2026-10-12T15:00:00Z"),
        terminado: new Date("2026-10-20T15:00:00Z"),
        equipoId: "alfa",
      },
      {
        piso: 12,
        salio: new Date("2026-10-09T15:00:00Z"),
        llego: new Date("2026-10-11T15:00:00Z"),
        instalado: new Date("2026-10-13T15:00:00Z"),
        terminado: null,
        equipoId: "beta",
      },
    ];
    const todos = seguimiento(fechas, equipos, "2026-10-01", "2026-10-31", null);
    expect(todos.totalPeriodo).toMatchObject({
      salieron: 2,
      llegaron: 2,
      instalados: 2,
      terminados: 1,
    });
    const alfa = seguimiento(fechas, equipos, "2026-10-01", "2026-10-31", "alfa");
    expect(alfa.totalPeriodo).toMatchObject({
      salieron: 2,
      llegaron: 2,
      instalados: 1,
      terminados: 1,
    });
    expect(alfa.porEquipo.find((e) => e.id === "alfa")).toMatchObject({
      instalados: 1,
      terminados: 1,
      pisosLabel: "8–8",
    });
    expect(alfa.porEquipo.find((e) => e.id === "beta").instalados).toBe(1);
  });

  it("un módulo que cambió de equipo cuenta en el equipo que lo instaló", () => {
    const miembros = [
      {
        userId: "pepe",
        equipoId: "alfa",
        nombre: "Alfa",
        joinedAt: "2026-01-01T00:00:00Z",
        leftAt: "2026-06-01T00:00:00Z",
      },
      {
        userId: "pepe",
        equipoId: "beta",
        nombre: "Beta",
        joinedAt: "2026-06-01T00:00:00Z",
        leftAt: null,
      },
    ];
    const cuando = new Date("2026-03-15T15:00:00Z");
    const equipo = equipoEnFecha("pepe", cuando, miembros);
    const fechas = [
      {
        piso: 4,
        salio: null,
        llego: null,
        instalado: cuando,
        terminado: new Date("2026-08-01T15:00:00Z"),
        equipoId: equipo.id,
      },
    ];
    const alfa = seguimiento(fechas, equipos, "2026-03-01", "2026-08-31", "alfa");
    const beta = seguimiento(fechas, equipos, "2026-03-01", "2026-08-31", "beta");
    expect(alfa.totalPeriodo.instalados).toBe(1);
    expect(alfa.totalPeriodo.terminados).toBe(1);
    expect(beta.totalPeriodo.instalados).toBe(0);
    expect(beta.totalPeriodo.terminados).toBe(0);
  });

  it("avisa cuando no hubo movimientos", () => {
    const r = seguimiento([], equipos, "2026-01-01", "2026-01-31", null);
    expect(r.vacio).toBe(true);
  });
});

describe("pisoInicial", () => {
  it("elige el piso más bajo con algo sin instalar", () => {
    expect(
      pisoInicial([
        { piso: 3, visual: "instalado" },
        { piso: 5, visual: "camino" },
        { piso: 4, visual: "sin_modulo" },
      ]),
    ).toBe(4);
  });

  it("conteos", () => {
    expect(conteos([{ visual: "camino" }, { visual: "camino" }, { visual: "sin_modulo" }])).toMatchObject({
      camino: 2,
      sin_modulo: 1,
      instalado: 0,
    });
  });
});
