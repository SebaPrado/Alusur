import { describe, expect, it } from "vitest";
import {
  areasVisibles,
  destinoAlCambiarOrg,
  elegirOrgActiva,
  esManagerAdmin,
  mostrarSelectorOrganizacion,
  normalizarContexto,
  obrasDeOrganizacion,
  puedeCrearObras,
  puedeGestionarEquipoAdmin,
} from "./organizacion";

const alusur = {
  id: "alusur",
  nombre: "Alusur",
  rol: "dueno",
  areas: ["construccion", "administracion"],
};
const ceibos = {
  id: "ceibos",
  nombre: "Los Ceibos",
  rol: "admin",
  areas: ["administracion"],
};

describe("normalizarContexto", () => {
  it("tolera una respuesta vacía", () => {
    expect(normalizarContexto(null)).toEqual({
      plataforma: false,
      organizaciones: [],
    });
  });

  it("conserva rol y áreas", () => {
    expect(
      normalizarContexto({
        plataforma: true,
        organizaciones: [alusur],
      }).organizaciones[0],
    ).toEqual(alusur);
  });
});

describe("elegirOrgActiva", () => {
  const lista = [alusur, ceibos];

  it("usa la guardada si sigue siendo válida", () => {
    expect(elegirOrgActiva(lista, "ceibos")?.id).toBe("ceibos");
  });

  it("cae a la primera si no hay guardada o ya no está", () => {
    expect(elegirOrgActiva(lista, null)?.id).toBe("alusur");
    expect(elegirOrgActiva(lista, "demo")?.id).toBe("alusur");
  });

  it("sin organizaciones no elige ninguna", () => {
    expect(elegirOrgActiva([], "alusur")).toBeNull();
  });
});

describe("puedeCrearObras", () => {
  it("el dueño crea obras si la organización tiene Construcción", () => {
    expect(puedeCrearObras({ plataforma: false, org: alusur })).toBe(true);
  });

  it("la plataforma crea obras solo en organizaciones con Construcción", () => {
    expect(
      puedeCrearObras({
        plataforma: true,
        org: { rol: "plataforma", areas: ["construccion", "administracion"] },
      }),
    ).toBe(true);
    expect(
      puedeCrearObras({
        plataforma: true,
        org: { rol: "plataforma", areas: ["administracion"] },
      }),
    ).toBe(false);
  });

  it("un admin o un vendedor no crea obras", () => {
    expect(puedeCrearObras({ plataforma: false, org: ceibos })).toBe(false);
    expect(
      puedeCrearObras({
        plataforma: false,
        org: { rol: "vendedor", areas: ["construccion"] },
      }),
    ).toBe(false);
  });

  it("sin organización activa no se puede", () => {
    expect(puedeCrearObras({ plataforma: true, org: null })).toBe(false);
  });
});

describe("puedeGestionarEquipoAdmin", () => {
  it("plataforma o dueño", () => {
    expect(puedeGestionarEquipoAdmin({ plataforma: true, org: ceibos })).toBe(true);
    expect(puedeGestionarEquipoAdmin({ plataforma: false, org: alusur })).toBe(true);
    expect(puedeGestionarEquipoAdmin({ plataforma: false, org: ceibos })).toBe(false);
  });
});

describe("esManagerAdmin", () => {
  it("plataforma, dueño y admin operan; el vendedor no", () => {
    expect(esManagerAdmin({ plataforma: true, org: { rol: "plataforma" } })).toBe(true);
    expect(esManagerAdmin({ plataforma: false, org: { rol: "dueno" } })).toBe(true);
    expect(esManagerAdmin({ plataforma: false, org: { rol: "admin" } })).toBe(true);
    expect(esManagerAdmin({ plataforma: false, org: { rol: "vendedor" } })).toBe(false);
  });
});

describe("areasVisibles", () => {
  it("muestra solo las áreas de la organización", () => {
    expect(areasVisibles({ org: alusur, esObrero: false })).toEqual([
      "construccion",
      "administracion",
    ]);
    expect(areasVisibles({ org: ceibos, esObrero: false })).toEqual(["administracion"]);
  });

  it("un obrero no ve Administración", () => {
    expect(areasVisibles({ org: alusur, esObrero: true })).toEqual(["construccion"]);
    expect(
      areasVisibles({
        org: { rol: "obra", areas: ["construccion", "administracion"] },
        esObrero: false,
      }),
    ).toEqual(["construccion"]);
  });
});

describe("mostrarSelectorOrganizacion", () => {
  it("solo con más de una, y nunca para un obrero", () => {
    expect(
      mostrarSelectorOrganizacion({ organizaciones: [alusur, ceibos], esObrero: false }),
    ).toBe(true);
    expect(mostrarSelectorOrganizacion({ organizaciones: [alusur], esObrero: false })).toBe(
      false,
    );
    expect(
      mostrarSelectorOrganizacion({ organizaciones: [alusur, ceibos], esObrero: true }),
    ).toBe(false);
  });
});

describe("destinoAlCambiarOrg", () => {
  it("con una sola área entra directo", () => {
    expect(destinoAlCambiarOrg({ org: ceibos, esObrero: false })).toBe("/administracion");
    expect(
      destinoAlCambiarOrg({
        org: { rol: "dueno", areas: ["construccion"] },
        esObrero: false,
      }),
    ).toBe("/construccion");
  });

  it("con las dos áreas vuelve al inicio", () => {
    expect(destinoAlCambiarOrg({ org: alusur, esObrero: false })).toBe("/");
  });

  it("un obrero va a Construcción", () => {
    expect(destinoAlCambiarOrg({ org: alusur, esObrero: true })).toBe("/construccion");
  });
});

describe("obrasDeOrganizacion", () => {
  it("filtra por la organización activa", () => {
    const obras = [
      { id: "1", organization_id: "alusur" },
      { id: "2", organization_id: "demo" },
    ];
    expect(obrasDeOrganizacion(obras, "demo").map((o) => o.id)).toEqual(["2"]);
    expect(obrasDeOrganizacion(obras, null)).toEqual([]);
  });
});
