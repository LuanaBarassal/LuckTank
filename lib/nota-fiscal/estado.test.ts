import { describe, expect, it } from "vitest";
import { estadoNotaFiscal, ROTULO_ESTADO_NOTA_FISCAL } from "./estado";

describe("estadoNotaFiscal", () => {
  it("mapeia os 3 estados de tem_nota_fiscal", () => {
    expect(estadoNotaFiscal(true)).toBe("anexada");
    expect(estadoNotaFiscal(false)).toBe("pendente");
    expect(estadoNotaFiscal(null)).toBe("anterior");
  });

  it("rótulos do export", () => {
    expect(ROTULO_ESTADO_NOTA_FISCAL[estadoNotaFiscal(true)]).toBe("Tem nota");
    expect(ROTULO_ESTADO_NOTA_FISCAL[estadoNotaFiscal(false)]).toBe("Pendente");
    expect(ROTULO_ESTADO_NOTA_FISCAL[estadoNotaFiscal(null)]).toBe("Anterior ao recurso");
  });
});
