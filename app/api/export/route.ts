import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import { verificarPinDoUsuario } from "@/lib/auth/pin";
import {
  parseFiltrosAbastecimento,
  resolverPeriodo,
  aplicarFiltrosQuery,
} from "@/lib/filtros/abastecimentos";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import { formatarDataBr, formatarVeiculo } from "@/lib/formatacao";
import { ROTULO_REGRA } from "@/lib/validacao/rotulos";
import { baixarFotoComprovante } from "@/lib/midias";
import { gerarExcel } from "@/lib/export/excel";
import { gerarPdf, type FotosLinhaPdf } from "@/lib/export/pdf";
import { calcularResumoExport } from "@/lib/export/resumo";
import { gerarNomeArquivoExport } from "@/lib/export/nome-arquivo";
import type { CabecalhoExport, RegistroExport } from "@/lib/export/tipos";
import {
  calcularEstatisticasVeiculo,
  type AbastecimentoParaEstatistica,
} from "@/lib/onibus/estatisticas";

// Export Excel/PDF do dashboard — usa EXATAMENTE a mesma leitura de filtros
// (parseFiltrosAbastecimento/resolverPeriodo/aplicarFiltrosQuery) do
// dashboard e da aba do ônibus (Bloco 1), então o arquivo gerado nunca pode
// divergir do que a tela está mostrando no momento do clique.
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // PIN sempre no header, nunca na query string (evita ficar gravado em
  // histórico do navegador/log de acesso) — ver lib/auth/pin.ts. Reverificado
  // aqui mesmo que o client já tenha confirmado o PIN antes de chamar (nunca
  // confiar que uma tela já validou algo por conta própria).
  const pin = request.headers.get("x-lucktank-pin") ?? "";
  const pinValido = await verificarPinDoUsuario(usuario.id, pin);
  if (!pinValido) {
    return NextResponse.json(
      { error: "PIN incorreto ou não configurado. Configure em Configurações." },
      { status: 403 }
    );
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filtros = parseFiltrosAbastecimento(searchParams);
  const periodo = resolverPeriodo(filtros);
  const formato = searchParams.formato === "pdf" ? "pdf" : "xlsx";

  const supabase = await createClient();

  const [{ data: empresa }, { veiculos, opcoesMotorista }] = await Promise.all([
    supabase.from("empresas").select("nome").eq("id", usuario.empresa_id).single(),
    buscarOpcoesFiltro(supabase),
  ]);

  const mapaPlacas = new Map(veiculos.map((v) => [v.id, formatarVeiculo(v.prefixo, v.placa)]));
  const mapaMotoristas = new Map(
    opcoesMotorista.filter((o) => o.value.startsWith("id:")).map((o) => [o.value.slice(3), o.label])
  );

  const { data: abastecimentos } = await aplicarFiltrosQuery(
    supabase
      .from("abastecimentos")
      .select(
        "id, data_abastecimento, km_atual, km_rodado, litros, valor_total, consumo_kml, posto_nome, posto_cidade, numero_nota, veiculo_id, motorista_id, motorista_nome_livre"
      )
      .eq("status", "ativo"),
    filtros,
    periodo
  ).order("data_abastecimento", { ascending: true });

  const lista = abastecimentos ?? [];
  const idsAbastecimentos = lista.map((a) => a.id);

  const [{ data: alertasBrutos }, { data: midiasBrutas }] = await Promise.all([
    idsAbastecimentos.length
      ? supabase
          .from("alertas")
          .select("entidade_id, tipo_regra")
          .eq("entidade_tipo", "abastecimento")
          .in("entidade_id", idsAbastecimentos)
      : Promise.resolve({ data: [] as { entidade_id: string; tipo_regra: string }[] }),
    idsAbastecimentos.length
      ? supabase
          .from("midias")
          .select("id, entidade_id, tipo, url, criado_em")
          .eq("entidade_tipo", "abastecimento")
          .in("tipo", ["foto_comprovante", "foto_bomba", "foto_hodometro"])
          .in("entidade_id", idsAbastecimentos)
          .order("criado_em", { ascending: false })
      : Promise.resolve({
          data: [] as { id: string; entidade_id: string; tipo: string; url: string; criado_em: string }[],
        }),
  ]);

  const mapaAlertas = new Map<string, string[]>();
  for (const alerta of alertasBrutos ?? []) {
    const atual = mapaAlertas.get(alerta.entidade_id) ?? [];
    atual.push(ROTULO_REGRA[alerta.tipo_regra] ?? alerta.tipo_regra);
    mapaAlertas.set(alerta.entidade_id, atual);
  }

  // As 3 fotos da captura guiada (Bloco 5) — uma linha por tipo; se houver
  // mais de uma do MESMO tipo, fica valendo a mais recente (mesmo critério
  // de sempre, agora aplicado por tipo).
  const mapaMidias = new Map<
    string,
    { cupom?: { id: string; url: string }; bomba?: { id: string; url: string }; hodometro?: { id: string; url: string } }
  >();
  for (const midia of midiasBrutas ?? []) {
    const atual = mapaMidias.get(midia.entidade_id) ?? {};
    if (midia.tipo === "foto_comprovante" && !atual.cupom) atual.cupom = { id: midia.id, url: midia.url };
    else if (midia.tipo === "foto_bomba" && !atual.bomba) atual.bomba = { id: midia.id, url: midia.url };
    else if (midia.tipo === "foto_hodometro" && !atual.hodometro)
      atual.hodometro = { id: midia.id, url: midia.url };
    mapaMidias.set(midia.entidade_id, atual);
  }

  const origem = request.nextUrl.origin;
  const registros: RegistroExport[] = lista.map((a) => {
    const midias = mapaMidias.get(a.id);
    return {
      data: a.data_abastecimento,
      veiculoPlaca: mapaPlacas.get(a.veiculo_id) ?? "—",
      motorista:
        a.motorista_nome_livre ?? (a.motorista_id ? mapaMotoristas.get(a.motorista_id) : null) ?? "—",
      kmAtual: a.km_atual,
      kmRodado: a.km_rodado,
      litros: a.litros,
      valorPorLitro: a.litros > 0 ? a.valor_total / a.litros : null,
      valorTotal: a.valor_total,
      consumoKml: a.consumo_kml,
      postoNome: a.posto_nome,
      postoCidade: a.posto_cidade,
      numeroNota: a.numero_nota,
      alertas: mapaAlertas.get(a.id) ?? [],
      fotoCupomUrl: midias?.cupom ? `${origem}/api/midias/${midias.cupom.id}` : null,
      fotoBombaUrl: midias?.bomba ? `${origem}/api/midias/${midias.bomba.id}` : null,
      fotoHodometroUrl: midias?.hodometro ? `${origem}/api/midias/${midias.hodometro.id}` : null,
    };
  });

  const resumo = calcularResumoExport(registros);

  // Só quando o export está filtrado por UM veículo específico (aba do
  // ônibus): calcula as mesmas 3 médias que já aparecem nos cards da tela
  // (calcularEstatisticasVeiculo, exatamente a mesma função — nunca pode
  // divergir do que a tela mostra), mostra o veículo no cabeçalho do
  // arquivo e troca o nome do arquivo pra "LuckTank_<prefixo>_<placa>_<período>"
  // em vez do nome da empresa.
  const veiculoFiltrado = filtros.veiculoId
    ? veiculos.find((v) => v.id === filtros.veiculoId)
    : undefined;
  const veiculoLabel = veiculoFiltrado
    ? formatarVeiculo(veiculoFiltrado.prefixo, veiculoFiltrado.placa)
    : undefined;

  const medias = veiculoFiltrado
    ? calcularEstatisticasVeiculo(lista as AbastecimentoParaEstatistica[])
    : undefined;

  const filtrosTexto = construirFiltrosTexto({
    veiculoPlaca: filtros.veiculoId ? mapaPlacas.get(filtros.veiculoId) ?? null : null,
    motoristaNome: filtros.motoristaId
      ? mapaMotoristas.get(filtros.motoristaId) ?? null
      : filtros.motoristaNomeLivre,
  });

  const cabecalho: CabecalhoExport = {
    empresaNome: empresa?.nome ?? "—",
    periodoTexto: `${formatarDataBr(periodo.de)} a ${formatarDataBr(periodo.ate)}`,
    filtrosTexto,
    veiculoLabel,
  };

  const nomeArquivo = veiculoFiltrado
    ? gerarNomeArquivoExport(
        [veiculoFiltrado.prefixo ?? "", veiculoFiltrado.placa],
        periodo,
        formato
      )
    : gerarNomeArquivoExport([cabecalho.empresaNome], periodo, formato);

  if (formato === "pdf") {
    // Só baixa os bytes das fotos quando o formato é PDF (o Excel só usa
    // link, não precisa do arquivo em si) — evita download desnecessário no
    // caminho mais comum de export. As 3 fotos (Bloco 5) baixam em paralelo
    // por linha, cada uma opcional.
    const admin = createAdminClient();
    const fotos = new Map<number, FotosLinhaPdf>();
    await Promise.all(
      lista.map(async (a, indice) => {
        const midias = mapaMidias.get(a.id);
        if (!midias) return;
        const [cupom, bomba, hodometro] = await Promise.all([
          midias.cupom ? baixarFotoComprovante(admin, midias.cupom.url) : null,
          midias.bomba ? baixarFotoComprovante(admin, midias.bomba.url) : null,
          midias.hodometro ? baixarFotoComprovante(admin, midias.hodometro.url) : null,
        ]);
        const linha: FotosLinhaPdf = {};
        if (cupom) linha.cupom = cupom;
        if (bomba) linha.bomba = bomba;
        if (hodometro) linha.hodometro = hodometro;
        if (cupom || bomba || hodometro) fotos.set(indice, linha);
      })
    );

    const buffer = gerarPdf(cabecalho, registros, resumo, fotos, medias);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      },
    });
  }

  const buffer = await gerarExcel(cabecalho, registros, resumo, medias);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}

function construirFiltrosTexto(filtros: { veiculoPlaca: string | null; motoristaNome: string | null }): string {
  const partes: string[] = [];
  if (filtros.veiculoPlaca) partes.push(`Veículo: ${filtros.veiculoPlaca}`);
  if (filtros.motoristaNome) partes.push(`Motorista: ${filtros.motoristaNome}`);
  return partes.length ? partes.join(" · ") : "Nenhum filtro adicional além do período.";
}
