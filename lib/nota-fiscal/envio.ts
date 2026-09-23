// Atalhos de envio da nota fiscal (Bloco 4 da NF) — só montam links que
// ABREM o app já preenchido (wa.me / mailto:); quem envia de verdade é a
// pessoa, confirmando no próprio app. Nada passa pelo servidor. Limitações
// reais, por isso a mensagem pede o anexo em vez de prometer: nem wa.me nem
// mailto: conseguem anexar arquivo (o anexo real, quando o celular suporta,
// é o "Compartilhar foto da nota", via Web Share API no componente).

import { formatarDataBr, formatarMoeda } from "@/lib/formatacao";

export interface DadosMensagemNotaFiscal {
  veiculo: string; // já formatado (prefixo · placa)
  dataAbastecimento: string; // ISO yyyy-mm-dd
  valorTotal: number | null;
  litros: number | null;
  motorista: string | null;
}

export function montarAssuntoNotaFiscal(dados: DadosMensagemNotaFiscal): string {
  return `Nota fiscal - abastecimento ${dados.veiculo} - ${formatarDataBr(dados.dataAbastecimento)}`;
}

// `fotoAnexada`: só é verdade no "Compartilhar foto da nota" (Web Share com
// o arquivo). Em wa.me e mailto: nada é anexado — a mensagem INSTRUI a
// anexar, nunca afirma que a foto já foi (se a pessoa não anexar, o texto
// não pode mentir pra quem recebe).
export function montarMensagemNotaFiscal(dados: DadosMensagemNotaFiscal, fotoAnexada = false): string {
  const linhas = [
    "Nota fiscal do abastecimento",
    `Veículo: ${dados.veiculo}`,
    `Data: ${formatarDataBr(dados.dataAbastecimento)}`,
  ];
  if (dados.valorTotal != null) linhas.push(`Valor: ${formatarMoeda(dados.valorTotal)}`);
  if (dados.litros != null) linhas.push(`Litros: ${dados.litros} L`);
  if (dados.motorista) linhas.push(`Motorista: ${dados.motorista}`);
  linhas.push("", fotoAnexada ? "Foto da nota fiscal em anexo." : "Anexe a foto da nota fiscal a esta mensagem.");
  return linhas.join("\n");
}

// Número gravado só com DDD + número (0020) — wa.me exige o código do país.
export function linkWhatsappNotaFiscal(whatsapp: string, mensagem: string): string {
  return `https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
}

export function linkEmailNotaFiscal(email: string, assunto: string, mensagem: string): string {
  // encodeURIComponent (não URLSearchParams): mailto espera espaço como %20,
  // não "+" — senão alguns apps de e-mail mostram "+" no lugar dos espaços.
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;
}
