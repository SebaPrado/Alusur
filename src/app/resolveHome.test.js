import { describe, expect, it } from "vitest";
import { resolveHome, resolveObraHome } from "./resolveHome";

describe("resolveHome", () => {
  it("CEO con 1 obra va a /obras", () => {
    expect(
      resolveHome({
        isCeo: true,
        obras: [{ id: "a", mi_rol: "ceo" }],
      }),
    ).toBe("/obras");
  });

  it("Admin con 1 obra va a /hoy", () => {
    expect(
      resolveHome({
        isCeo: false,
        obras: [{ id: "a", mi_rol: "admin" }],
      }),
    ).toBe("/obra/a/hoy");
  });

  it("Owner con 1 obra va a /resumen", () => {
    expect(
      resolveHome({
        isCeo: false,
        obras: [{ id: "b", mi_rol: "owner" }],
      }),
    ).toBe("/obra/b/resumen");
  });

  it("usuario sin obras va a /sin-obras", () => {
    expect(resolveHome({ isCeo: false, obras: [] })).toBe("/sin-obras");
  });

  it("usuario con 3 obras va a /obras", () => {
    expect(
      resolveHome({
        isCeo: false,
        obras: [
          { id: "1", mi_rol: "admin" },
          { id: "2", mi_rol: "owner" },
          { id: "3", mi_rol: "superadmin" },
        ],
      }),
    ).toBe("/obras");
  });
});

describe("resolveObraHome", () => {
  it("owner → resumen", () => {
    expect(resolveObraHome({ mi_rol: "owner" })).toBe("resumen");
  });

  it("resto → hoy", () => {
    expect(resolveObraHome({ mi_rol: "admin" })).toBe("hoy");
    expect(resolveObraHome({ mi_rol: "ceo" })).toBe("hoy");
  });
});
