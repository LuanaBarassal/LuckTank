import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { abastecimentoSchema } from "@/lib/validacao/schemas";
import {
  avaliarAbastecimento,
  kmMenorQueUltimoRegistrado,
  type ContextoAvaliacao,
  type AlertaGerado,
} from "@/lib/validacao/regras";
import { validarFoto } from "@/lib/validacao/arquivo";
import { extrairExifFoto } from "@/lib/exif";
import { limitarAbastecimento, obterIp } from "@/lib/rate-limit";
import { notificarAlertaCritico } from "@/lib/email/notificar-alerta-critico";
import { notificarAbastecimentoRegistrado } from "@/lib/email/notificar-abastecimento";
import { formatarVeiculo } from "@/lib/formatacao";
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

// Lista fechada, nunca o valor cru: `foto.type` também é auto-declarado pelo
// client (assim como `foto.name`), mas aqui só decide uma extensão dentro de
// um conjunto pequeno e conhecido — não pode carregar nada arbitrário pra
// dentro da key do Storage, então não precisa da validação por assinatura de
// bytes que `validarFoto` já fez (essa garante que o CONTEÚDO é imagem;
// esta função só nomeia o arquivo).
function extensaoSeguraFoto(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic") || mimeType.includes("heif")) return "heic";
  return "bin";
}

interface FotoProcessada {
  url: string;
  hash: string;
  exifTimestamp: string | null;
  exifGps: { lat: number; lon: number } | null;
}

// Captura guiada de 3 fotos (cupom/bomba/hodômetro, 2026-07-10): mesma
// validação/hash/EXIF/upload que o cupom já usava, agora reaproveitada pras
// 3. Cupom é obrigatório (preserva o comportamento de sempre — arquivo
// inválido barra o registro com 400); bomba/hodômetro são evidência
// complementar opcional — arquivo ausente OU inválido nelas NUNCA bloqueia o
// registro, só resulta em "sem foto" pra aquela etapa (mesmo espírito do
// invariante #7: prova a mais é bônus, nunca trava o motorista).
async function processarFoto(params: {
  formData: FormData;
  campoFoto: string;
  campoExif: string;
  admin: ReturnType<typeof createAdminClient>;
  caminhoBase: string;
  obrigatoria: boolean;
}): Promise<{ ok: true; dados: FotoProcessada | null } | { ok: false; erro: string }> {
  const { formData, campoFoto, campoExif, admin, caminhoBase, obrigatoria } = params;
  const foto = formData.get(campoFoto);

  if (!(foto instanceof File) || foto.size === 0) {
    return { ok: true, dados: null };
  }

  const buffer = Buffer.from(await foto.arrayBuffer());
  const validacao = validarFoto(foto, buffer);
  if (!validacao.valido) {
    if (obrigatoria) return { ok: false, erro: validacao.erro ?? "Foto inválida." };
    return { ok: true, dados: null };
  }

  const hash = createHash("sha256").update(buffer).digest("hex");

  // Mesmo truque do cupom: o "cabeçalho" do arquivo ORIGINAL (sem
  // recodificar) preserva o EXIF que a compressão via canvas apaga; sem
  // esse campo, cai no fallback de tentar ler do próprio arquivo comprimido.
  const fotoExifCampo = formData.get(campoExif);
  const bufferParaExif =
    fotoExifCampo instanceof File && fotoExifCampo.size > 0
      ? Buffer.from(await fotoExifCampo.arrayBuffer())
      : buffer;
  const exif = await extrairExifFoto(bufferParaExif);

  const caminho = `${caminhoBase}.${extensaoSeguraFoto(foto.type)}`;
  const { error: uploadError } = await admin.storage
    .from("comprovantes")
    .upload(caminho, buffer, { contentType: foto.type || "image/jpeg", upsert: true });

  // Falha de upload não bloqueia o registro (mesmo comportamento de sempre
  // pro cupom) — só resulta em "sem foto" pra essa etapa.
  if (uploadError) return { ok: true, dados: null };

  const { data: publicUrlData } = admin.storage.from("comprovantes").getPublicUrl(caminho);
  return {
    ok: true,
    dados: { url: publicUrlData.publicUrl, hash, exifTimestamp: exif.timestamp, exifGps: exif.gps },
  };
}

// Único ponto de escrita de abastecimento. O motorista não tem sessão, então
// tudo aqui roda com a service role — por isso a validação de negócio (KM,
// resolução de veículo/empresa a partir do qr_token) precisa acontecer
// inteiramente neste arquivo, nunca confiando em nada vindo do client além
// do próprio qr_token.
export async function POST(request: NextRequest) {
  const { permitido } = await limitarAbastecimento(obterIp(request));
  if (!permitido) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Content-Type ausente/errado (não multipart) — requisição malformada,
    // não uma exceção do servidor. Sem isso, request.formData() lança e vira
    // um 500 pra qualquer POST vazio ou mal formado.
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const qrToken = campoTexto(formData, "qr_token");
  if (!qrToken) {
    return NextResponse.json({ error: "QR inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: veiculo } = await admin
    .from("veiculos")
    .select(
      "id, empresa_id, km_atual, ativo, capacidade_tanque_litros, consumo_referencia_kml, placa, prefixo"
    )
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
    valor_litro: campoTexto(formData, "valor_litro"),
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
    bomba_litros_lido: campoTexto(formData, "bomba_litros_lido"),
    bomba_valor_total_lido: campoTexto(formData, "bomba_valor_total_lido"),
    hodometro_km_lido: campoTexto(formData, "hodometro_km_lido"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  // BLOQUEIO real (não é alerta leve): KM não pode ser menor que o último registrado.
  // Checagem rápida aqui (feedback sem round-trip de erro); o trigger
  // `valida_km_nao_retrocede` (migration 0011) é quem garante isso de fato
  // sob concorrência, travando a linha do veículo dentro da transação do insert.
  if (kmMenorQueUltimoRegistrado(parsed.data.km_atual, veiculo.km_atual)) {
    return NextResponse.json(
      { error: `O KM não pode ser menor que o último registrado (${veiculo.km_atual}).` },
      { status: 409 }
    );
  }

  // `motorista_id` nunca deve ser confiado cegamente vindo do client (mesmo
  // princípio de veiculo_id/empresa_id, resolvidos só a partir do qr_token):
  // sem essa checagem, um motorista_id de OUTRA empresa poderia ser
  // vinculado ao abastecimento, quebrando a integridade referencial entre
  // tenants. Se não pertencer à empresa do veículo, trata como se não tivesse
  // vindo — nunca bloqueia o registro por causa disso, só cai pro nome livre.
  let motoristaId = parsed.data.motorista_id ?? null;
  let motoristaNomeCadastrado: string | null = null;
  if (motoristaId) {
    const { data: motorista } = await admin
      .from("motoristas")
      .select("id, nome")
      .eq("id", motoristaId)
      .eq("empresa_id", veiculo.empresa_id)
      .maybeSingle();
    if (!motorista) {
      motoristaId = null;
    } else {
      motoristaNomeCadastrado = motorista.nome;
    }
  }
  if (!motoristaId && !parsed.data.motorista_nome_livre) {
    return NextResponse.json({ error: "Motorista inválido." }, { status: 400 });
  }
  // Rótulo pro e-mail de notificação — mesma lógica de fallback usada no
  // resto do app (dashboard/export): nome cadastrado se vinculado, senão o
  // nome livre que o motorista digitou.
  const motoristaLabel = motoristaNomeCadastrado ?? parsed.data.motorista_nome_livre ?? "—";

  // `registro_uuid` (já validado como UUID pelo schema) + sufixo por tipo +
  // extensão de uma lista fechada — NUNCA `foto.name` (achado numa auditoria
  // adversarial: é o nome de arquivo declarado pelo client num FormData,
  // então totalmente controlável por quem chama este endpoint sem sessão
  // nenhuma; ia direto pra dentro da key do Storage e, mais adiante, pro
  // header Content-Disposition em /api/midias/[id] — um jeito de injetar
  // caracteres arbitrários num header HTTP a partir de um campo que nunca
  // devia ser confiável).
  const caminhoBase = (sufixo: string) =>
    `${veiculo.empresa_id}/${veiculo.id}/${parsed.data.registro_uuid}-${sufixo}`;

  const resultadoCupom = await processarFoto({
    formData,
    campoFoto: "foto_cupom",
    campoExif: "foto_cupom_exif",
    admin,
    caminhoBase: caminhoBase("cupom"),
    obrigatoria: true,
  });
  if (!resultadoCupom.ok) {
    return NextResponse.json({ error: resultadoCupom.erro }, { status: 400 });
  }
  const resultadoBomba = await processarFoto({
    formData,
    campoFoto: "foto_bomba",
    campoExif: "foto_bomba_exif",
    admin,
    caminhoBase: caminhoBase("bomba"),
    obrigatoria: false,
  });
  if (!resultadoBomba.ok) {
    return NextResponse.json({ error: resultadoBomba.erro }, { status: 400 });
  }
  const resultadoHodometro = await processarFoto({
    formData,
    campoFoto: "foto_hodometro",
    campoExif: "foto_hodometro_exif",
    admin,
    caminhoBase: caminhoBase("hodometro"),
    obrigatoria: false,
  });
  if (!resultadoHodometro.ok) {
    return NextResponse.json({ error: resultadoHodometro.erro }, { status: 400 });
  }

  const fotoCupom = resultadoCupom.dados;
  const fotoBomba = resultadoBomba.dados;
  const fotoHodometro = resultadoHodometro.dados;
  // As regras de fraude (nota duplicada, foto reaproveitada, EXIF antigo)
  // continuam olhando só pro cupom — é o documento fiscal, o mesmo padrão
  // de sempre; bomba/hodômetro são evidência complementar de conferência
  // cruzada (Bloco 4), não entram nessas regras específicas.
  const fotoHash = fotoCupom?.hash ?? null;
  const exifTimestamp = fotoCupom?.exifTimestamp ?? null;

  const { data: abastecimento, error: insertError } = await admin
    .from("abastecimentos")
    .insert({
      empresa_id: veiculo.empresa_id,
      veiculo_id: veiculo.id,
      motorista_id: motoristaId,
      motorista_nome_livre: parsed.data.motorista_nome_livre,
      data_abastecimento: parsed.data.data_abastecimento,
      hora: parsed.data.hora,
      posto_nome: parsed.data.posto_nome,
      posto_cidade: parsed.data.posto_cidade,
      posto_cnpj: parsed.data.posto_cnpj,
      posto_uf: parsed.data.posto_uf,
      litros: parsed.data.litros,
      valor_total: parsed.data.valor_total,
      valor_litro: parsed.data.valor_litro,
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
      bomba_litros_lido: parsed.data.bomba_litros_lido,
      bomba_valor_total_lido: parsed.data.bomba_valor_total_lido,
      hodometro_km_lido: parsed.data.hodometro_km_lido,
    })
    .select(
      "id, litros, valor_total, km_atual, km_rodado, consumo_kml, numero_nota, bomba_litros_lido, bomba_valor_total_lido, hodometro_km_lido"
    )
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

    // Trigger `valida_km_nao_retrocede` (migration 0011) — mesma regra da
    // checagem acima, mas travada por lock de linha, então é a que vale de
    // fato sob concorrência (duas sincronizações da fila offline ao mesmo
    // tempo, por exemplo). Mensagem genérica de propósito: o km_atual mais
    // recente pode já ter mudado entre a checagem acima e este ponto.
    if (insertError.code === "LT001") {
      return NextResponse.json(
        { error: "O KM não pode ser menor que o último registrado para este veículo." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Não foi possível registrar o abastecimento." },
      { status: 500 }
    );
  }

  const midiasParaGravar = [
    fotoCupom && {
      empresa_id: veiculo.empresa_id,
      entidade_tipo: "abastecimento",
      entidade_id: abastecimento.id,
      url: fotoCupom.url,
      tipo: "foto_comprovante",
      hash_sha256: fotoCupom.hash,
      exif_timestamp: fotoCupom.exifTimestamp,
      exif_gps: fotoCupom.exifGps as Json,
    },
    fotoBomba && {
      empresa_id: veiculo.empresa_id,
      entidade_tipo: "abastecimento",
      entidade_id: abastecimento.id,
      url: fotoBomba.url,
      tipo: "foto_bomba",
      hash_sha256: fotoBomba.hash,
      exif_timestamp: fotoBomba.exifTimestamp,
      exif_gps: fotoBomba.exifGps as Json,
    },
    fotoHodometro && {
      empresa_id: veiculo.empresa_id,
      entidade_tipo: "abastecimento",
      entidade_id: abastecimento.id,
      url: fotoHodometro.url,
      tipo: "foto_hodometro",
      hash_sha256: fotoHodometro.hash,
      exif_timestamp: fotoHodometro.exifTimestamp,
      exif_gps: fotoHodometro.exifGps as Json,
    },
  ].filter((m): m is NonNullable<typeof m> => Boolean(m));

  if (midiasParaGravar.length > 0) {
    await admin.from("midias").insert(midiasParaGravar);
  }

  // Alerta é bônus informativo pro escritório — nunca deve derrubar a
  // resposta de sucesso do registro principal, que já foi gravado.
  let alertasGerados: AlertaGerado[] = [];
  try {
    alertasGerados = await avaliarEGravarAlertas({
      admin,
      veiculo,
      abastecimento,
      fotoHash,
      dataAbastecimento: parsed.data.data_abastecimento,
      exifTimestamp,
    });
  } catch (erro) {
    console.error("Falha ao avaliar alertas do abastecimento:", erro);
  }

  // E-mail de "abastecimento registrado" — dispara SEMPRE (diferente do de
  // alerta crítico acima, que só dispara pra nível crítico e vai pra outra
  // lista de destinatários). Nunca lança (mesmo invariante #7 — ver
  // notificar-abastecimento.ts); chamado fora do try/catch acima de
  // propósito, pra não ficar condicionado a `avaliarEGravarAlertas` ter
  // funcionado (mesmo se o motor de alertas falhar, o abastecimento em si
  // já está gravado e merece o e-mail de confirmação).
  await notificarAbastecimentoRegistrado({
    abastecimentoId: abastecimento.id,
    empresaId: veiculo.empresa_id,
    veiculoLabel: formatarVeiculo(veiculo.prefixo, veiculo.placa),
    dataAbastecimento: parsed.data.data_abastecimento,
    hora: parsed.data.hora ?? null,
    motoristaLabel,
    litros: abastecimento.litros,
    valorTotal: abastecimento.valor_total,
    valorLitro: parsed.data.valor_litro ?? null,
    postoNome: parsed.data.posto_nome ?? null,
    postoCidade: parsed.data.posto_cidade ?? null,
    kmAtual: abastecimento.km_atual,
    alertas: alertasGerados,
  });

  return NextResponse.json({ id: abastecimento.id });
}

async function avaliarEGravarAlertas(params: {
  admin: ReturnType<typeof createAdminClient>;
  veiculo: {
    id: string;
    empresa_id: string;
    capacidade_tanque_litros: number | null;
    consumo_referencia_kml: number | null;
    placa: string;
    prefixo: string | null;
  };
  abastecimento: {
    id: string;
    litros: number;
    valor_total: number;
    km_atual: number;
    km_rodado: number | null;
    consumo_kml: number | null;
    numero_nota: string | null;
    bomba_litros_lido: number | null;
    bomba_valor_total_lido: number | null;
    hodometro_km_lido: number | null;
  };
  fotoHash: string | null;
  dataAbastecimento: string;
  exifTimestamp: string | null;
}): Promise<AlertaGerado[]> {
  const { admin, veiculo, abastecimento, fotoHash, dataAbastecimento, exifTimestamp } = params;

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
    // Filtra por tipo "foto_comprovante" (não só entidade_tipo): desde a
    // captura guiada de 3 fotos (2026-07-10), midias também guarda bomba e
    // hodômetro com hash próprio — sem esse filtro, um hash batendo entre
    // tipos diferentes (coincidência praticamente impossível de qualquer
    // forma, mas a intenção da regra é clara) contaminaria uma regra que é
    // especificamente sobre o CUPOM ser reaproveitado.
    const { data: midiasComMesmoHash } = await admin
      .from("midias")
      .select("entidade_id")
      .eq("hash_sha256", fotoHash)
      .eq("entidade_tipo", "abastecimento")
      .eq("tipo", "foto_comprovante")
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
      valorTotal: abastecimento.valor_total,
      kmAtual: abastecimento.km_atual,
      kmRodado: abastecimento.km_rodado,
      consumoKml: abastecimento.consumo_kml,
      numeroNota: abastecimento.numero_nota,
      dataAbastecimento,
    },
    veiculo: {
      capacidadeTanqueLitros: veiculo.capacidade_tanque_litros,
      consumoReferenciaKml: veiculo.consumo_referencia_kml,
    },
    notaDuplicada,
    fotoDuplicada,
    consumoMedioHistorico,
    fotoExifTimestamp: exifTimestamp,
    bombaLitrosLido: abastecimento.bomba_litros_lido,
    bombaValorTotalLido: abastecimento.bomba_valor_total_lido,
    hodometroKmLido: abastecimento.hodometro_km_lido,
  };

  const alertas = avaliarAbastecimento(contexto);
  if (alertas.length === 0) return alertas;

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

  // E-mail é só pros críticos — info/atenção continuam só no painel
  // (mesmo corte de "não incomodar à toa" já usado nas cores do painel de
  // Alertas). Roda depois do insert acima: o alerta já existe no banco
  // mesmo que o e-mail falhe (notificarAlertaCritico nunca lança).
  const tiposRegraCriticos = alertas.filter((a) => a.nivel === "critico").map((a) => a.tipoRegra);
  if (tiposRegraCriticos.length > 0) {
    await notificarAlertaCritico({
      empresaId: veiculo.empresa_id,
      veiculoLabel: formatarVeiculo(veiculo.prefixo, veiculo.placa),
      tiposRegraCriticos,
    });
  }

  return alertas;
}
