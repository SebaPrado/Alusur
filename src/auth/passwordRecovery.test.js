import { describe, expect, it } from "vitest";
import {
  AUTH_LINK_EXPIRED,
  authLinkErrorMessage,
  urlIndicatesPasswordRecovery,
  validateNewPassword,
} from "./passwordRecovery";

describe("authLinkErrorMessage", () => {
  it("trata otp_expired como enlace vencido", () => {
    expect(
      authLinkErrorMessage("?error=access_denied&error_code=otp_expired", ""),
    ).toBe(AUTH_LINK_EXPIRED);
  });

  it("lee cualquier error en la query o en el hash", () => {
    expect(authLinkErrorMessage("?error_code=otp_expired", "")).toBe(
      AUTH_LINK_EXPIRED,
    );
    expect(
      authLinkErrorMessage(
        "",
        "#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toBe(AUTH_LINK_EXPIRED);
    expect(
      authLinkErrorMessage("?ok=1", "#error_description=expired"),
    ).toBe(AUTH_LINK_EXPIRED);
  });

  it("no marca una url de la app ni un code suelto", () => {
    expect(authLinkErrorMessage("", "")).toBeNull();
    expect(authLinkErrorMessage("?code=abc", "")).toBeNull();
    expect(authLinkErrorMessage("", "#piso")).toBeNull();
    expect(authLinkErrorMessage("?error=", "#error_code=")).toBeNull();
  });
});

describe("urlIndicatesPasswordRecovery", () => {
  it("detecta type=recovery en el hash o en la query", () => {
    expect(
      urlIndicatesPasswordRecovery(
        "",
        "#access_token=tok&refresh_token=ref&type=recovery",
      ),
    ).toBe(true);
    expect(urlIndicatesPasswordRecovery("?type=recovery&code=abc", "")).toBe(
      true,
    );
  });

  it("un enlace con error no abre la pantalla de contraseña", () => {
    expect(
      urlIndicatesPasswordRecovery(
        "",
        "#error=access_denied&error_code=otp_expired&type=recovery",
      ),
    ).toBe(false);
  });

  it("ignora el resto de las urls", () => {
    expect(urlIndicatesPasswordRecovery("", "")).toBe(false);
    expect(urlIndicatesPasswordRecovery("?code=abc", "#piso")).toBe(false);
  });
});

describe("validateNewPassword", () => {
  it("exige al menos 8 caracteres antes de comparar", () => {
    expect(validateNewPassword("corta", "distinta")).toBe(
      "La contraseña tiene que tener al menos 8 caracteres",
    );
    expect(validateNewPassword("1234567", "1234567")).toBe(
      "La contraseña tiene que tener al menos 8 caracteres",
    );
  });

  it("pide que las dos coincidan", () => {
    expect(validateNewPassword("12345678", "12345679")).toBe(
      "Las contraseñas no coinciden",
    );
  });

  it("acepta 8 o más caracteres iguales", () => {
    expect(validateNewPassword("12345678", "12345678")).toBeNull();
    expect(validateNewPassword("una frase larga", "una frase larga")).toBeNull();
  });
});
