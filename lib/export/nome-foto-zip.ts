// Nome de cada arquivo DENTRO do zip de fotos (app/api/export/fotos/route.ts)
// — função pura e testável isoladamente (mesmo padrão de gerarNomeArquivoExport
// no mesmo diretório), porque a regra de deduplicação tem casos de borda
// reais: dois abastecimentos do mesmo veículo, mesmo motorista, mesmo dia
// (comum — motorista abastece mais de uma vez no turno) gerariam o mesmo
// nome-base se não fosse por isso.
import { normalizarSlug } from "./nome-arquivo";

// `nomesJaUsados` é mutado de propósito — o chamador mantém um Map único
// por chamada de export inteira, passado adiante a cada foto processada,
// pra deduplicar através de todo o lote (não só dentro de uma função pura
// isolada, que não teria memória entre chamadas).
export function gerarNomeFotoZip(
  dataAbastecimento: string,
  veiculoLabel: string,
  motoristaLabel: string,
  extensao: string,
  nomesJaUsados: Map<string, number>
): string {
  // Cada parte é normalizada separadamente e só depois junta com "_" — igual
  // a gerarNomeArquivoExport (nome-arquivo.ts). Normalizar a string inteira
  // de uma vez removeria os próprios separadores (normalizarSlug tira TODO
  // caractere não alfanumérico, "_" incluso), grudando tudo sem separação
  // nenhuma e deixando o nome ilegível.
  const base =
    [dataAbastecimento, veiculoLabel, motoristaLabel].map(normalizarSlug).filter(Boolean).join("_") ||
    "comprovante";
  const chaveBase = `${base}.${extensao}`;
  const contagem = nomesJaUsados.get(chaveBase) ?? 0;
  nomesJaUsados.set(chaveBase, contagem + 1);
  return contagem === 0 ? chaveBase : `${base}-${contagem + 1}.${extensao}`;
}
