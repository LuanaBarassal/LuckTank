import { describe, expect, it, afterEach } from "vitest";
import { ehDonoSistema } from "./dono-sistema";

const ENV_ORIGINAL = process.env.DONO_SISTEMA_EMAILS;

describe("ehDonoSistema", () => {
  afterEach(() => {
    process.env.DONO_SISTEMA_EMAILS = ENV_ORIGINAL;
  });

  it("retorna false quando a variável de ambiente não está configurada", () => {
    delete process.env.DONO_SISTEMA_EMAILS;
    expect(ehDonoSistema("qualquer@gmail.com")).toBe(false);
  });

  it("retorna true pra um e-mail que está na lista", () => {
    process.env.DONO_SISTEMA_EMAILS = "dona1@gmail.com,dona2@gmail.com";
    expect(ehDonoSistema("dona2@gmail.com")).toBe(true);
  });

  it("retorna false pra um e-mail que não está na lista, mesmo sendo administrador de uma empresa", () => {
    process.env.DONO_SISTEMA_EMAILS = "dona1@gmail.com,dona2@gmail.com";
    expect(ehDonoSistema("outra-empresa@gmail.com")).toBe(false);
  });

  it("compara sem diferenciar maiúsculas/minúsculas e ignorando espaços na env var", () => {
    process.env.DONO_SISTEMA_EMAILS = " Dona1@Gmail.com , dona2@gmail.com ";
    expect(ehDonoSistema("dona1@gmail.com")).toBe(true);
  });

  it("retorna false quando não há e-mail (não autenticado)", () => {
    process.env.DONO_SISTEMA_EMAILS = "dona1@gmail.com";
    expect(ehDonoSistema(null)).toBe(false);
    expect(ehDonoSistema(undefined)).toBe(false);
  });
});
