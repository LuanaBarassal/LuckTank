// Formato intermediário entre a query (route handler) e os geradores de
// arquivo (excel.ts/pdf.ts) — mesmo padrão do resto do projeto (a página
// busca o dado bruto, uma função separada transforma). `fotoUrl`, quando
// presente, já é a URL ABSOLUTA de /api/midias/[id] (nunca a do Storage
// direto — o bucket é privado desde a 0007, só essa rota autenticada serve
// o arquivo).

export interface RegistroExport {
  data: string; // YYYY-MM-DD
  veiculoPlaca: string;
  motorista: string;
  kmAtual: number;
  kmRodado: number | null;
  litros: number;
  valorPorLitro: number | null;
  valorTotal: number;
  consumoKml: number | null;
  postoNome: string | null;
  postoCidade: string | null;
  numeroNota: string | null;
  alertas: string[];
  fotoUrl: string | null;
}

export interface ResumoExport {
  totalLitros: number;
  totalValor: number;
  precoMedioLitro: number | null;
  consumoMedioKml: number | null;
  quantidadeRegistros: number;
}

export interface CabecalhoExport {
  empresaNome: string;
  periodoTexto: string;
  filtrosTexto: string; // ex.: "Veículo: EXM1A23 · Motorista: João da Silva" ou "Nenhum filtro adicional"
}
