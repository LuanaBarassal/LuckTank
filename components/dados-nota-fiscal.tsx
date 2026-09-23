import { formatarCnpj, formatarTelefone } from "@/lib/formatacao";

// Dados da empresa pra pedir a nota fiscal eletrônica no posto (0020) —
// gravados só com dígitos, formatados aqui. Mesmo bloco na etiqueta
// impressa do QR e na etapa da NF do fluxo do motorista: é o que o
// motorista mostra/dita pro frentista. Preto sobre branco, sem cor
// semântica (mesmo critério de InstrucoesMotorista: imprime bem em P&B).
export interface DadosNotaFiscalEmpresa {
  cnpj: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function temDadosNotaFiscal(dados: DadosNotaFiscalEmpresa | null): dados is DadosNotaFiscalEmpresa {
  return Boolean(dados && (dados.cnpj || dados.whatsapp || dados.email));
}

export default function DadosNotaFiscal({
  dados,
  compacto = false,
}: {
  dados: DadosNotaFiscalEmpresa;
  // Versão menor pro card do celular (a etiqueta usa o tamanho cheio).
  compacto?: boolean;
}) {
  const destinos = [
    dados.whatsapp ? formatarTelefone(dados.whatsapp) : null,
    dados.email,
  ].filter((d): d is string => Boolean(d));

  return (
    <div
      className={`w-full rounded-xl border-2 border-neutral-900 text-neutral-900 ${
        compacto ? "max-w-md p-3" : "max-w-sm p-4"
      }`}
    >
      <p
        className={`text-center font-bold uppercase tracking-wide ${compacto ? "text-xs" : "text-sm"}`}
      >
        Dados para a nota fiscal
      </p>
      {dados.cnpj && (
        <div className="mt-2 text-center">
          <div className={`font-medium text-neutral-600 ${compacto ? "text-xs" : "text-sm"}`}>
            Emitir no CNPJ
          </div>
          <div
            className={`font-bold tabular-nums tracking-wide ${compacto ? "text-xl" : "text-2xl"}`}
          >
            {formatarCnpj(dados.cnpj)}
          </div>
        </div>
      )}
      {destinos.length > 0 && (
        <div className="mt-2 text-center">
          <div className={`font-medium text-neutral-600 ${compacto ? "text-xs" : "text-sm"}`}>
            Enviar comprovante para
          </div>
          {destinos.map((destino, indice) => (
            <div key={destino}>
              {indice > 0 && <div className="text-xs text-neutral-500">ou</div>}
              <div className={`break-all font-bold ${compacto ? "text-base" : "text-lg"}`}>
                {destino}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
