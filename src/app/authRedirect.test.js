import { describe, expect, it } from "vitest";
import { entryTarget, safeInternalPath, sectionLabel } from "./authRedirect";

describe("safeInternalPath", () => {
  it("conserva ruta, búsqueda y hash internos", () => {
    expect(
      safeInternalPath({
        pathname: "/construccion/obra/a/hoy",
        search: "?x=1",
        hash: "#piso",
      }),
    ).toBe("/construccion/obra/a/hoy?x=1#piso");
  });

  it("acepta un path string", () => {
    expect(safeInternalPath("/administracion")).toBe("/administracion");
  });

  it("rechaza vacíos, externos y las pantallas de acceso", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("https://evil.test")).toBe("/");
    expect(safeInternalPath("//evil.test")).toBe("/");
    expect(safeInternalPath("/login")).toBe("/");
    expect(safeInternalPath("/pin")).toBe("/");
    expect(safeInternalPath("/\\evil")).toBe("/");
  });
});

describe("entryTarget", () => {
  it("conserva la ruta profunda si pertenece a la sección elegida", () => {
    expect(
      entryTarget("/construccion", {
        pathname: "/construccion/obra/a/hoy",
        search: "",
        hash: "",
      }),
    ).toBe("/construccion/obra/a/hoy");
  });

  it("usa la portada de la sección si eligió la otra", () => {
    expect(entryTarget("/administracion", "/construccion/obras")).toBe(
      "/administracion",
    );
  });
});

describe("sectionLabel", () => {
  it("nombra la sección de una ruta interna", () => {
    expect(sectionLabel("/construccion/obras")).toBe("Construcción");
    expect(sectionLabel("/administracion")).toBe("Administración");
    expect(sectionLabel("/login")).toBe(null);
  });
});
