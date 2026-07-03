import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioAtual } from "@/lib/auth/contexto-usuario";

// Único jeito de servir uma foto de comprovante pro escritório desde a
// 0007 (bucket virou privado, sem policy de SELECT em storage.objects —
// ver migration). Duas camadas de isolamento por tenant, não uma só:
// 1) a linha de `midias` é buscada com o client de SESSÃO (RLS ativo,
//    `midias_select` já filtra por `empresa_id = usuario_empresa_id()`
//    desde a 0001) — se a mídia for de outra empresa, a query volta vazia,
//    igual a "não existe" (nunca revela que existe mas não é sua).
// 2) só depois disso, com o path já confirmado como da empresa certa, o
//    arquivo é baixado do Storage via service role (que ignora RLS de
//    Storage, mas nesse ponto o isolamento já foi garantido pelo passo 1).
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: midia } = await supabase
    .from("midias")
    .select("url")
    .eq("id", params.id)
    .eq("entidade_tipo", "abastecimento")
    .single();

  if (!midia) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const caminho = extrairCaminhoDoBucket(midia.url);
  if (!caminho) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: arquivo, error } = await admin.storage.from("comprovantes").download(caminho);
  if (error || !arquivo) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const baixar = request.nextUrl.searchParams.get("baixar") === "1";
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const nomeArquivo = caminho.split("/").pop() ?? `comprovante-${params.id}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": arquivo.type || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      ...(baixar ? { "Content-Disposition": `attachment; filename="${nomeArquivo}"` } : {}),
    },
  });
}

// A URL salva em `midias.url` é a pública antiga (getPublicUrl, gerada no
// upload em /api/abastecimentos) — continua no formato
// ".../object/public/comprovantes/<caminho>" mesmo com o bucket privado
// agora (getPublicUrl só monta a string, não valida se o bucket é público).
// Aqui só se extrai o `<caminho>` de volta pra chamar `.download()`.
function extrairCaminhoDoBucket(url: string): string | null {
  const marcador = "/object/public/comprovantes/";
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return decodeURIComponent(url.slice(indice + marcador.length));
}
