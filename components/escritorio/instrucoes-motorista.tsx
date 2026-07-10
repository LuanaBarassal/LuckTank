// Passo a passo impresso junto do QR do veículo (etiqueta) — texto gerado a
// partir do fluxo real do motorista (components/motorista/fluxo-abastecimento.tsx
// e os passos PassoNome/PassoFoto/PassoFormulario), não inventado: são
// exatamente as telas que o motorista vê, na ordem em que aparecem — captura
// guiada de 3 fotos (visor da bomba → cupom → hodômetro), bomba e hodômetro
// podem ser puladas se não der pra fotografar.
// Preto sobre branco de propósito (alto contraste em impressora comum, P&B
// inclusive) — não usa nenhuma cor semântica que dependa de tinta colorida.
const PASSOS = [
  "Escaneie o QR Code — ele abre o sistema de abastecimento, sem senha.",
  'Toque no seu nome na lista (ou em "Meu nome não está na lista" e digite).',
  "Fotografe o visor da bomba mostrando litros e valor (ou pule, se não der pra fotografar).",
  "Tire uma foto legível do comprovante/cupom do abastecimento, ou escolha uma da galeria.",
  "Fotografe o painel/hodômetro mostrando o KM atual (ou pule, se não der pra fotografar).",
  "Confira os dados preenchidos automaticamente (ou preencha à mão) e confirme o KM atual do veículo.",
  'Toque em "Confirmar abastecimento". Pronto — o registro já chega ao escritório.',
];

export default function InstrucoesMotorista() {
  return (
    <div className="w-full max-w-sm text-neutral-900">
      <p className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-neutral-500 print:text-neutral-700">
        Como abastecer
      </p>
      <ol className="flex flex-col gap-2">
        {PASSOS.map((passo, indice) => (
          <li key={passo} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-900 text-sm font-bold leading-none">
              {indice + 1}
            </span>
            <span className="text-sm leading-snug">{passo}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-xs text-neutral-500">
        Sem internet? Preencha os dados manualmente — o abastecimento é salvo
        no aparelho e enviado assim que a conexão voltar.
      </p>
    </div>
  );
}
