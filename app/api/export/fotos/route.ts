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
import { formatarVeiculo } from "@/lib/formatacao";
import { baixarFotoBruta } from "@/lib/midias";
import { gerarZipFotos } from "@/lib/export/zip";
import { gerarNomeArquivoExport } from "@/lib/export/nome-arquivo";
import { gerarNomeFotoZip } from "@/lib/export/nome-foto-zip";

// Baixa todos os comprovantes do período/filtro ativo como um .zip único —
// alternativa mais simples a integrar com um Drive externo de verdade
// (OAuth por empresa, token guardado com segurança, fila de sincronização
// em background que a Vercel não tem): aqui é só reunir arquivos que já
// existem no Storage. Usa EXATAMENTE os mesmos filtros do dashboard/aba do
// ônibus/export (parseFiltrosAbastecimento/resolverPeriodo/aplicarFiltrosQuery),
// pro zip nunca poder divergir do que a tela está mostrando.
//
// Baixa do Storage em LOTES (não tudo de uma vez com Promise.all solto) —
// um export "todo o histórico" pode ter centenas de fotos; sem limite de
// concorrência isso arriscaria estourar memória/timeout da function
// serverless bem antes de qualquer teto de linhas do banco.
const TAMANHO_LOTE_DOWNLOAD = 6;

export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

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
      .select("id, data_abastecimento, veiculo_id, motorista_id, motorista_nome_livre")
      .eq("status", "ativo"),
    filtros,
    periodo
  );

  const lista = abastecimentos ?? [];
  const idsAbastecimentos = lista.map((a) => a.id);

  if (idsAbastecimentos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum abastecimento no período/filtro selecionado." },
      { status: 404 }
    );
  }

  // Sessão do usuário (RLS ativo) — a mesma garantia de isolamento por
  // tenant que o resto do app já usa pra ler `midias`.
  const { data: midiasBrutas } = await supabase
    .from("midias")
    .select("id, entidade_id, url, criado_em")
    .eq("entidade_tipo", "abastecimento")
    .eq("tipo", "foto_comprovante")
    .in("entidade_id", idsAbastecimentos)
    .order("criado_em", { ascending: false });

  // Uma foto por abastecimento na prática (mesmo critério do resto do app)
  // — se houver mais de uma linha, fica valendo a mais recente.
  const mapaMidia = new Map<string, { url: string }>();
  for (const midia of midiasBrutas ?? []) {
    if (!mapaMidia.has(midia.entidade_id)) mapaMidia.set(midia.entidade_id, { url: midia.url });
  }

  const itensComFoto = lista.filter((a) => mapaMidia.has(a.id));

  if (itensComFoto.length === 0) {
    return NextResponse.json(
      { error: "Nenhum abastecimento do período/filtro selecionado tem foto de comprovante." },
      { status: 404 }
    );
  }

  // Só a partir daqui usa a service role — pra baixar o arquivo do Storage,
  // não pra decidir QUAIS abastecimentos entram (isso já foi resolvido
  // acima, com RLS).
  const admin = createAdminClient();
  const nomesJaUsados = new Map<string, number>();
  const arquivos: { nome: string; buffer: Buffer }[] = [];

  for (let inicio = 0; inicio < itensComFoto.length; inicio += TAMANHO_LOTE_DOWNLOAD) {
    const lote = itensComFoto.slice(inicio, inicio + TAMANHO_LOTE_DOWNLOAD);
    const baixados = await Promise.all(
      lote.map(async (a) => {
        const midia = mapaMidia.get(a.id);
        if (!midia) return null;

        const foto = await baixarFotoBruta(admin, midia.url);
        if (!foto) return null;

        const motorista =
          a.motorista_nome_livre ??
          (a.motorista_id ? mapaMotoristas.get(a.motorista_id) : null) ??
          "sem motorista";

        const nome = gerarNomeFotoZip(
          a.data_abastecimento,
          mapaPlacas.get(a.veiculo_id) ?? "veiculo",
          motorista,
          foto.extensao,
          nomesJaUsados
        );

        return { nome, buffer: foto.buffer };
      })
    );

    for (const item of baixados) {
      if (item) arquivos.push(item);
    }
  }

  if (arquivos.length === 0) {
    return NextResponse.json({ error: "Não foi possível baixar nenhuma foto." }, { status: 500 });
  }

  // Mesma convenção de nome do export Excel/PDF: prefixo/placa quando
  // filtrado por um veículo específico, nome da empresa no export geral.
  const veiculoFiltrado = filtros.veiculoId ? veiculos.find((v) => v.id === filtros.veiculoId) : undefined;
  const nomeArquivo = veiculoFiltrado
    ? gerarNomeArquivoExport([veiculoFiltrado.prefixo ?? "", veiculoFiltrado.placa], periodo, "zip")
    : gerarNomeArquivoExport([empresa?.nome ?? "Empresa"], periodo, "zip");

  const zipBuffer = await gerarZipFotos(arquivos);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
