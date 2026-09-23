// Estado da nota fiscal de um abastecimento, a partir de
// `abastecimentos.tem_nota_fiscal` (0019) — três estados de propósito:
// null = registrado antes do recurso existir (a NF nunca foi pedida pelo
// sistema, então não é "pendência"). Um só lugar pro rótulo, usado no
// export Excel/PDF (uso contábil).
export type EstadoNotaFiscal = "anexada" | "pendente" | "anterior";

export function estadoNotaFiscal(temNotaFiscal: boolean | null): EstadoNotaFiscal {
  if (temNotaFiscal === true) return "anexada";
  if (temNotaFiscal === false) return "pendente";
  return "anterior";
}

export const ROTULO_ESTADO_NOTA_FISCAL: Record<EstadoNotaFiscal, string> = {
  anexada: "Tem nota",
  pendente: "Pendente",
  anterior: "Anterior ao recurso",
};
