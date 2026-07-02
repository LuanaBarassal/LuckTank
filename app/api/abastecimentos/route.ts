import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { abastecimentoSchema } from "@/lib/validacao/schemas";
import { avaliarAbastecimento, type ContextoAvaliacao } from "@/lib/validacao/regras";
import type { Json } from "@/types/database";

// `undefined` (não `null`) pra casar com `.optional()` nos schemas —
// `textoOpcional` em lib/validacao/schemas.ts não aceita `null` explícito.
function campoTexto(formData: FormData, campo: string): string | undefined {
  const valor = formData.get(campo);
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

// ocr_raw/campos_editados_manualmente chegam como JSON serializado (FormData
// só carrega string) — se vier corrompido, ignora em vez de derrubar o
// registro inteiro (são só metadados de auditoria, não bloqueiam nada).
function parsearJsonSeguro<T>(texto: string | undefined): T | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

// Único ponto de escrita de abastecimento. O motorista não tem sessão, então
// tudo aqui roda com a service role — por isso a validação de negócio (KM,
// resolução de veículo/empresa a partir do qr_token) precisa acontecer
// inteiramente neste arquivo, nunca confiando em nada vindo do client além
// do próprio qr_token.
export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const qrToken = campoTexto(formData, "qr_token");
  if (!qrToken) {
    return NextResponse.json({ error: "QR inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: veiculo } = await admin
    .from("veiculos")
    .select("id, empresa_id, km_atual, ativo, capacidade_tanque_litros")
    .eq("qr_token", qrToken)
    .single();

  if (!veiculo || !veiculo.ativo) {
    return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });
  }

  const parsed = abastecimentoSchema.safeParse({
    motorista_id: campoTexto(formData, "motorista_id"),
    motorista_nome_livre: campoTexto(formData, "motorista_nome_livre"),
    data_abastecimento: campoTexto(formData, "data_abastecimento"),
    hora: campoTexto(formData, "hora"),
    posto_nome: campoTexto(formData, "posto_nome"),
    posto_cidade: campoTexto(formData, "posto_cidade"),
    posto_cnpj: campoTexto(formData, "posto_cnpj"),
    posto_uf: campoTexto(formData, "posto_uf"),
    litros: campoTexto(formData, "litros"),
    valor_total: campoTexto(formData, "valor_total"),
    forma_pagamento: campoTexto(formData, "forma_pagamento"),
    numero_nota: campoTexto(formData, "numero_nota"),
    bandeira_posto: campoTexto(formData, "bandeira_posto"),
    km_atual: campoTexto(formData, "km_atual"),
    registro_uuid: campoTexto(formData, "registro_uuid"),
    origem_registro: campoTexto(formData, "origem_registro"),
    ocr_confianca: campoTexto(formData, "ocr_confianca"),
    ocr_prompt_version: campoTexto(formData, "ocr_prompt_version"),
    ocr_raw: campoTexto(formData, "ocr_raw"),
    campos_editados_manualmente: campoTexto(formData, "campos_editados_manualmente"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  // BLOQUEIO real (não é alerta leve): KM não pode ser menor que o último registrado.
  if (veiculo.km_atual != null && parsed.data.km_atual < veiculo.km_atual) {
    return NextResponse.json(
      { error: `O KM não pode ser menor que o último registrado (${veiculo.km_atual}).` },
      { status: 409 }
    );
  }

  let fotoUrl: string | null = null;
  let fotoHash: string | null = null;
  const foto = formData.get("foto");

  if (foto instanceof File && foto.size > 0) {
    const buffer = Buffer.from(await foto.arrayBuffer());
    fotoHash = createHash("sha256").update(buffer).digest("hex");

    const caminho = `${veiculo.empresa_id}/${veiculo.id}/${parsed.data.registro_uuid}-${foto.name}`;
    const { error: uploadError } = await admin.storage
      .from("comprovantes")
      .upload(caminho, buffer, { contentType: foto.type || "image/jpeg", upsert: true });

    if (!uploadError) {
      const { data: publicUrlData } = admin.storage.from("comprovantes").getPublicUrl(caminho);
      fotoUrl = publicUrlData.publicUrl;
    }
  }

  const { data: abastecimento, error: insertError } = await admin
    .from("abastecimentos")
    .insert({
      empresa_id: veiculo.empresa_id,
      veiculo_id: veiculo.id,
      motorista_id: parsed.data.motorista_id,
      motorista_nome_livre: parsed.data.motorista_nome_livre,
      data_abastecimento: parsed.data.data_abastecimento,
      hora: parsed.data.hora,
      posto_nome: parsed.data.posto_nome,
      posto_cidade: parsed.data.posto_cidade,
      posto_cnpj: parsed.data.posto_cnpj,
      posto_uf: parsed.data.posto_uf,
      litros: parsed.data.litros,
      valor_total: parsed.data.valor_total,
      forma_pagamento: parsed.data.forma_pagamento,
      numero_nota: parsed.data.numero_nota,
      bandeira_posto: parsed.data.bandeira_posto,
      km_atual: parsed.data.km_atual,
      km_anterior_snapshot: veiculo.km_atual,
      origem_registro: parsed.data.origem_registro ?? "online",
      registro_uuid: parsed.data.registro_uuid,
      status: "ativo",
      ocr_confianca: parsed.data.ocr_confianca,
      ocr_prompt_version: parsed.data.ocr_prompt_version,
      ocr_raw: parsearJsonSeguro(parsed.data.ocr_raw ?? undefined),
      campos_editados_manualmente: parsearJsonSeguro<string[]>(
        parsed.data.campos_editados_manualmente ?? undefined
      ),
    })
    .select("id, litros, km_rodado, consumo_kml, numero_nota")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Reenvio do mesmo registro_uuid (retry de rede) — idempotente, não é erro.
      const { data: existente } = await admin
        .from("abastecimentos")
        .select("id")
        .eq("veiculo_id", veiculo.id)
        .eq("registro_uuid", parsed.data.registro_uuid)
        .single();

      if (existente) {
        return NextResponse.json({ id: existente.id });
      }
    }

    return NextResponse.json(
      { error: "Não foi possível registrar o abastecimento." },
      { status: 500 }
    );
  }

  if (fotoUrl) {
    await admin.from("midias").insert({
      empresa_id: veiculo.empresa_id,
      entidade_tipo: "abastecimento",
      entidade_id: abastecimento.id,
      url: fotoUrl,
      tipo: "foto_comprovante",
      hash_sha256: fotoHash,
    });
  }

  // Alerta é bônus informativo pro escritório — nunca deve derrubar a
  // resposta de sucesso do registro principal, que já foi gravado.
  try {
    await avaliarEGravarAlertas({ admin, veiculo, abastecimento, fotoHash });
  } catch (erro) {
    console.error("Falha ao avaliar alertas do abastecimento:", erro);
  }

  return NextResponse.json({ id: abastecimento.id });
}

async function avaliarEGravarAlertas(params: {
  admin: ReturnType<typeof createAdminClient>;
  veiculo: {
    id: string;
    empresa_id: string;
    capacidade_tanque_litros: number | null;
  };
  abastecimento: {
    id: string;
    litros: number;
    km_rodado: number | null;
    consumo_kml: number | null;
    numero_nota: string | null;
  };
  fotoHash: string | null;
}) {
  const { admin, veiculo, abastecimento, fotoHash } = params;

  let notaDuplicada = false;
  if (abastecimento.numero_nota) {
    const { data } = await admin
      .from("abastecimentos")
      .select("id")
      .eq("veiculo_id", veiculo.id)
      .eq("numero_nota", abastecimento.numero_nota)
      .eq("status", "ativo")
      .neq("id", abastecimento.id)
      .limit(1);
    notaDuplicada = (data?.length ?? 0) > 0;
  }

  let fotoDuplicada = false;
  if (fotoHash) {
    const { data: midiasComMesmoHash } = await admin
      .from("midias")
      .select("entidade_id")
      .eq("hash_sha256", fotoHash)
      .eq("entidade_tipo", "abastecimento")
      .neq("entidade_id", abastecimento.id);

    if (midiasComMesmoHash && midiasComMesmoHash.length > 0) {
      const idsAbastecimentos = midiasComMesmoHash.map((m) => m.entidade_id);
      const { data: mesmoVeiculo } = await admin
        .from("abastecimentos")
        .select("id")
        .eq("veiculo_id", veiculo.id)
        .in("id", idsAbastecimentos)
        .limit(1);
      fotoDuplicada = (mesmoVeiculo?.length ?? 0) > 0;
    }
  }

  const { data: historico } = await admin
    .from("abastecimentos")
    .select("consumo_kml")
    .eq("veiculo_id", veiculo.id)
    .eq("status", "ativo")
    .neq("id", abastecimento.id)
    .not("consumo_kml", "is", null)
    .order("criado_em", { ascending: false })
    .limit(5);

  const valoresHistorico = (historico ?? [])
    .map((h) => h.consumo_kml)
    .filter((v): v is number => v != null);

  const consumoMedioHistorico =
    valoresHistorico.length > 0
      ? valoresHistorico.reduce((soma, v) => soma + v, 0) / valoresHistorico.length
      : null;

  const contexto: ContextoAvaliacao = {
    abastecimento: {
      litros: abastecimento.litros,
      kmRodado: abastecimento.km_rodado,
      consumoKml: abastecimento.consumo_kml,
      numeroNota: abastecimento.numero_nota,
    },
    veiculo: {
      capacidadeTanqueLitros: veiculo.capacidade_tanque_litros,
    },
    notaDuplicada,
    fotoDuplicada,
    consumoMedioHistorico,
  };

  const alertas = avaliarAbastecimento(contexto);
  if (alertas.length === 0) return;

  await admin.from("alertas").insert(
    alertas.map((alerta) => ({
      empresa_id: veiculo.empresa_id,
      entidade_tipo: "abastecimento",
      entidade_id: abastecimento.id,
      tipo_regra: alerta.tipoRegra,
      nivel: alerta.nivel,
      // Sempre um objeto plano JSON-serializável (vem do próprio motor de
      // regras) — o cast só casa com o tipo `Json` gerado pelo Supabase.
      detalhes: alerta.detalhes as Json,
    }))
  );
}
