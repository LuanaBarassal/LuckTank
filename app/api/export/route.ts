import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";
import {
  parseFiltrosAbastecimento,
  resolverPeriodo,
  aplicarFiltrosQuery,
} from "@/lib/filtros/abastecimentos";
import { buscarOpcoesFiltro } from "@/lib/filtros/opcoes";
import { formatarDataBr } from "@/lib/formatacao";
import { ROTULO_REGRA } from "@/lib/validacao/rotulos";
import { baixarFotoComprovante, type FotoBaixada } from "@/lib/midias";
import { gerarExcel } from "@/lib/export/excel";
import { gerarPdf } from "@/lib/export/pdf";
import { calcularResumoExport } from "@/lib/export/resumo";
import { gerarNomeArquivoExport } from "@/lib/export/nome-arquivo";
import type { CabecalhoExport, RegistroExport } from "@/lib/export/tipos";

// Export Excel/PDF do dashboard — usa EXATAMENTE a mesma leitura de filtros
// (parseFiltrosAbastecimento/resolverPeriodo/aplicarFiltrosQuery) do
// dashboard e da aba do ônibus (Bloco 1), então o arquivo gerado nunca pode
// divergir do que a tela está mostrando no momento do clique.
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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

  const mapaPlacas = new Map(veiculos.map((v) => [v.id, v.placa]));
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
          .select("id, entidade_id, url, criado_em")
          .eq("entidade_tipo", "abastecimento")
          .eq("tipo", "foto_comprovante")
          .in("entidade_id", idsAbastecimentos)
          .order("criado_em", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; entidade_id: string; url: string; criado_em: string }[] }),
  ]);

  const mapaAlertas = new Map<string, string[]>();
  for (const alerta of alertasBrutos ?? []) {
    const atual = mapaAlertas.get(alerta.entidade_id) ?? [];
    atual.push(ROTULO_REGRA[alerta.tipo_regra] ?? alerta.tipo_regra);
    mapaAlertas.set(alerta.entidade_id, atual);
  }

  // Uma foto por abastecimento na prática — se houver mais de uma linha,
  // fica valendo a mais recente (mesmo critério do Bloco 3).
  const mapaMidia = new Map<string, { id: string; url: string }>();
  for (const midia of midiasBrutas ?? []) {
    if (!mapaMidia.has(midia.entidade_id)) mapaMidia.set(midia.entidade_id, { id: midia.id, url: midia.url });
  }

  const origem = request.nextUrl.origin;
  const registros: RegistroExport[] = lista.map((a) => {
    const midia = mapaMidia.get(a.id);
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
      fotoUrl: midia ? `${origem}/api/midias/${midia.id}` : null,
    };
  });

  const resumo = calcularResumoExport(registros);

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
  };

  const nomeArquivo = gerarNomeArquivoExport(cabecalho.empresaNome, periodo, formato);

  if (formato === "pdf") {
    // Só baixa os bytes das fotos quando o formato é PDF (o Excel só usa um
    // link, não precisa do arquivo em si) — evita download desnecessário no
    // caminho mais comum de export.
    const admin = createAdminClient();
    const fotos = new Map<number, FotoBaixada>();
    await Promise.all(
      lista.map(async (a, indice) => {
        const midia = mapaMidia.get(a.id);
        if (!midia) return;
        const foto = await baixarFotoComprovante(admin, midia.url);
        if (foto) fotos.set(indice, foto);
      })
    );

    const buffer = gerarPdf(cabecalho, registros, resumo, fotos);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      },
    });
  }

  const buffer = await gerarExcel(cabecalho, registros, resumo);
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
