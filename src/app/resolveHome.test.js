import { describe, expect, it } from "vitest";
import { resolveHome, resolveObraHome } from "./resolveHome";

describe("resolveHome", () => {
  it("quien puede crear obras ve el listado aunque tenga una", () => {
    expect(
      resolveHome({
        veListado: true,
        obras: [{ id: "a", mi_rol: "admin" }],
      }),
    ).toBe("/construccion/obras");
  });

  it("con 1 obra entra a Progreso", () => {
    expect(
      resolveHome({
        veListado: false,
        obras: [{ id: "a", mi_rol: "admin" }],
      }),
    ).toBe("/construccion/obra/a/progreso/torre");
    expect(
      resolveHome({
        veListado: false,
        obras: [{ id: "b", mi_rol: "owner" }],
      }),
    ).toBe("/construccion/obra/b/progreso/torre");
  });

  it("usuario sin obras va a /construccion/sin-obras", () => {
    expect(resolveHome({ veListado: false, obras: [] })).toBe(
      "/construccion/sin-obras",
    );
  });

  it("usuario con 3 obras va a /construccion/obras", () => {
    expect(
      resolveHome({
        veListado: false,
        obras: [
          { id: "1", mi_rol: "admin" },
          { id: "2", mi_rol: "owner" },
          { id: "3", mi_rol: "superadmin" },
        ],
      }),
    ).toBe("/construccion/obras");
  });
});

describe("resolveObraHome", () => {
  it("entra a progreso", () => {
    expect(resolveObraHome()).toBe("progreso/torre");
  });
});
