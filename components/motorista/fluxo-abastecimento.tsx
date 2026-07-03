"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import PassoNome from "@/components/motorista/passo-nome";
import PassoFoto from "@/components/motorista/passo-foto";
import PassoProcessando from "@/components/motorista/passo-processando";
import PassoFormulario, {
  type ValoresFormulario,
} from "@/components/motorista/passo-formulario";
import PassoSucesso from "@/components/motorista/passo-sucesso";
import type { OcrConfianca, OcrResultado } from "@/lib/ocr/provider";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { adicionarNaFila } from "@/lib/offline/db";
import { comprimirImagem } from "@/lib/offline/comprimir-imagem";
import { sincronizarFila } from "@/lib/offline/sync";

interface Motorista {
  id: string;
  nome: string;
}

interface UltimoAbastecimento {
  data_abastecimento: string;
  km_atual: number;
  litros: number;
}

interface Props {
  qrToken: string;
  empresaNome: string;
  veiculo: {
    id: string;
    placa: string;
    modelo: string | null;
    ano: number | null;
    kmAtual: number | null;
  };
  motoristas: Motorista[];
  ultimoAbastecimento: UltimoAbastecimento | null;
}

type Passo = "nome" | "foto" | "processando" | "formulario" | "sucesso";

interface MetaOcr {
  confianca: OcrConfianca;
  versaoPrompt: string;
  bruto: unknown;
  valoresOriginais: ValoresFormulario;
}

const MAXIMO_TENTATIVAS_OCR = 2;

// Só o "cabeçalho" do arquivo ORIGINAL (antes da compressão) é enviado pro
// servidor ler o EXIF — é onde o EXIF de um JPEG mora, então não precisa da
// imagem inteira. `File.slice()` é um corte puro (não recodifica), preserva
// os bytes originais escritos pela câmera; enviar a foto inteira sem
// comprimir dobraria o tamanho do upload e arriscaria estourar o limite de
// payload de function serverless (Vercel).
const TAMANHO_CABECALHO_EXIF_BYTES = 128 * 1024;

const VALORES_INICIAIS: ValoresFormulario = {
  dataAbastecimento: new Date().toISOString().slice(0, 10),
  hora: "",
  postoNome: "",
  postoCidade: "",
  postoUf: "",
  postoCnpj: "",
  litros: "",
  valorTotal: "",
  formaPagamento: "",
  numeroNota: "",
  bandeiraPosto: "",
  kmAtual: "",
};

// A IA devolve texto livre ("Cartão de Crédito"); nosso formulário usa um
// select fixo — tenta casar por palavra-chave, sem acento, senão deixa em
// branco pro motorista escolher.
function mapearFormaPagamento(texto: string | null): string {
  if (!texto) return "";
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (normalizado.includes("frota")) return "cartao_frota";
  if (normalizado.includes("credito")) return "cartao_credito";
  if (normalizado.includes("debito")) return "cartao_debito";
  if (normalizado.includes("dinheiro") || normalizado.includes("especie")) return "dinheiro";
  if (normalizado.includes("pix")) return "pix";
  if (normalizado.includes("boleto")) return "boleto";
  return "";
}

export default function FluxoAbastecimento({
  qrToken,
  empresaNome,
  veiculo,
  motoristas,
  ultimoAbastecimento,
}: Props) {
  const estaOnline = useOnlineStatus();
  const [passo, setPasso] = useState<Passo>("nome");

  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [usarNomeLivre, setUsarNomeLivre] = useState(motoristas.length === 0);
  const [nomeLivre, setNomeLivre] = useState("");

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [tentativasOcr, setTentativasOcr] = useState(0);
  const [ocrMeta, setOcrMeta] = useState<MetaOcr | null>(null);
  const [avisoFormulario, setAvisoFormulario] = useState<string | null>(null);

  const [valores, setValores] = useState<ValoresFormulario>(VALORES_INICIAIS);
  const [registroUuid, setRegistroUuid] = useState(() => crypto.randomUUID());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [salvoOffline, setSalvoOffline] = useState(false);

  // Tenta esvaziar a fila local ao abrir a página e sempre que a conexão
  // voltar — cobre tanto "reabriu o link depois" quanto "sinal voltou com a
  // aba ainda aberta". Não bloqueia nada da UI (roda em segundo plano).
  useEffect(() => {
    if (estaOnline) {
      sincronizarFila();
    }
  }, [estaOnline]);

  function handleFotoChange(file: File | null) {
    setFotoFile(file);
    setFotoPreview((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function handleChangeFormulario<K extends keyof ValoresFormulario>(campo: K, valor: string) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  function reiniciar() {
    setPasso("nome");
    setMotoristaId(null);
    setUsarNomeLivre(motoristas.length === 0);
    setNomeLivre("");
    handleFotoChange(null);
    setErroFoto(null);
    setTentativasOcr(0);
    setOcrMeta(null);
    setAvisoFormulario(null);
    setValores(VALORES_INICIAIS);
    setRegistroUuid(crypto.randomUUID());
    setErro(null);
    setSalvoOffline(false);
  }

  async function handleContinuarFoto() {
    if (!fotoFile) return;

    // Sem conexão: a IA não tem como rodar (chama o Gemini), então pula
    // direto pro preenchimento manual — nada de tentar e falhar por rede.
    if (!estaOnline) {
      setOcrMeta(null);
      setAvisoFormulario(
        "Sem internet — preencha os dados manualmente. Enviaremos quando a conexão voltar."
      );
      setErroFoto(null);
      setPasso("formulario");
      return;
    }

    setPasso("processando");

    const formData = new FormData();
    formData.set("qr_token", qrToken);
    formData.set("foto", fotoFile);

    try {
      const resposta = await fetch("/api/ocr", { method: "POST", body: formData });
      const resultado: OcrResultado = await resposta.json();

      if (resultado.sucesso && resultado.dados) {
        const novosValores: ValoresFormulario = {
          dataAbastecimento:
            resultado.dados.data_abastecimento ?? VALORES_INICIAIS.dataAbastecimento,
          hora: resultado.dados.hora ?? "",
          postoNome: resultado.dados.posto_nome ?? "",
          postoCidade: resultado.dados.posto_cidade ?? "",
          postoUf: resultado.dados.posto_uf ?? "",
          postoCnpj: resultado.dados.posto_cnpj ?? "",
          litros: resultado.dados.litros != null ? String(resultado.dados.litros) : "",
          valorTotal: resultado.dados.valor_total != null ? String(resultado.dados.valor_total) : "",
          formaPagamento: mapearFormaPagamento(resultado.dados.forma_pagamento),
          numeroNota: resultado.dados.numero_nota ?? "",
          bandeiraPosto: resultado.dados.bandeira_posto ?? "",
          kmAtual: "",
        };

        setValores(novosValores);
        setOcrMeta({
          confianca: resultado.confianca,
          versaoPrompt: resultado.versaoPrompt,
          bruto: resultado.bruto,
          valoresOriginais: novosValores,
        });
        setAvisoFormulario(
          "Conferimos os dados automaticamente — revise antes de confirmar."
        );
        setErroFoto(null);
        setPasso("formulario");
        return;
      }

      falharOcr();
    } catch {
      falharOcr();
    }

    function falharOcr() {
      const tentativas = tentativasOcr + 1;
      setTentativasOcr(tentativas);

      if (tentativas < MAXIMO_TENTATIVAS_OCR) {
        setErroFoto(
          "Não conseguimos ler o comprovante. Tire outra foto, com mais luz e a nota inteira no quadro."
        );
        handleFotoChange(null);
        setPasso("foto");
      } else {
        setOcrMeta(null);
        setAvisoFormulario("Não foi possível ler automaticamente — preencha os dados manualmente.");
        setPasso("formulario");
      }
    }
  }

  async function handleSubmit() {
    setErro(null);
    setEnviando(true);

    const campos: Record<string, string> = {};
    if (usarNomeLivre) campos.motorista_nome_livre = nomeLivre.trim();
    else if (motoristaId) campos.motorista_id = motoristaId;
    campos.data_abastecimento = valores.dataAbastecimento;
    if (valores.hora) campos.hora = valores.hora;
    if (valores.postoNome) campos.posto_nome = valores.postoNome;
    if (valores.postoCidade) campos.posto_cidade = valores.postoCidade;
    if (valores.postoUf) campos.posto_uf = valores.postoUf;
    if (valores.postoCnpj) campos.posto_cnpj = valores.postoCnpj;
    campos.litros = valores.litros;
    campos.valor_total = valores.valorTotal;
    if (valores.formaPagamento) campos.forma_pagamento = valores.formaPagamento;
    if (valores.numeroNota) campos.numero_nota = valores.numeroNota;
    if (valores.bandeiraPosto) campos.bandeira_posto = valores.bandeiraPosto;
    campos.km_atual = valores.kmAtual;
    campos.registro_uuid = registroUuid;

    if (ocrMeta) {
      // "kmAtual" nunca vem da IA (não existe no comprovante) — sempre seria
      // listado como "editado" sem significar uma correção de leitura, então
      // fica de fora do sinal de fraude.
      const camposEditados = (Object.keys(valores) as (keyof ValoresFormulario)[]).filter(
        (campo) => campo !== "kmAtual" && valores[campo] !== ocrMeta.valoresOriginais[campo]
      );
      campos.ocr_confianca = ocrMeta.confianca;
      campos.ocr_prompt_version = ocrMeta.versaoPrompt;
      campos.ocr_raw = JSON.stringify(ocrMeta.bruto);
      if (camposEditados.length > 0) {
        campos.campos_editados_manualmente = JSON.stringify(camposEditados);
      }
    }

    if (!estaOnline) {
      await enfileirarOffline();
      return;
    }

    const formData = new FormData();
    formData.set("qr_token", qrToken);
    for (const [chave, valor] of Object.entries(campos)) formData.set(chave, valor);
    if (fotoFile) {
      // Mesma compressão do caminho offline (lib/offline/comprimir-imagem.ts)
      // — antes só o offline reduzia o tamanho antes de subir a foto.
      const fotoComprimida = await comprimirImagem(fotoFile);
      formData.set("foto", fotoComprimida, fotoFile.name);
      formData.set(
        "foto_exif",
        fotoFile.slice(0, TAMANHO_CABECALHO_EXIF_BYTES),
        fotoFile.name
      );
    }

    try {
      const resposta = await fetch("/api/abastecimentos", { method: "POST", body: formData });
      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErro(resultado.error ?? "Não foi possível registrar. Tente novamente.");
        setEnviando(false);
        return;
      }

      setEnviando(false);
      setSalvoOffline(false);
      setPasso("sucesso");
    } catch {
      // Conexão caiu no meio do envio — não perde o registro, guarda local.
      await enfileirarOffline();
    }

    async function enfileirarOffline() {
      try {
        const fotoBlob = fotoFile ? await comprimirImagem(fotoFile) : null;
        const fotoExifHeaderBlob = fotoFile ? fotoFile.slice(0, TAMANHO_CABECALHO_EXIF_BYTES) : null;
        await adicionarNaFila({
          registroUuid,
          qrToken,
          payload: campos,
          fotoBlob,
          fotoExifHeaderBlob,
          fotoNome: fotoFile?.name ?? null,
          criadoEm: Date.now(),
          status: "pendente",
          erro: null,
          tentativas: 0,
        });
        setEnviando(false);
        setSalvoOffline(true);
        setPasso("sucesso");
      } catch {
        setErro("Não foi possível salvar localmente. Anote os dados e tente de novo com internet.");
        setEnviando(false);
      }
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex flex-col items-center gap-1 rounded-b-3xl bg-gradient-to-br from-primary-800 to-primary-900 px-4 pb-5 pt-6 text-center shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 text-xs font-bold text-navy-950">
              LT
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              {empresaNome}
            </span>
          </div>
          <h1 className="font-title text-2xl font-bold text-white">{veiculo.placa}</h1>
          <p className="text-sm text-slate-300">
            {[veiculo.modelo, veiculo.ano].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {ultimoAbastecimento
              ? `Último abastecimento: ${ultimoAbastecimento.data_abastecimento} · ${ultimoAbastecimento.km_atual} km · ${ultimoAbastecimento.litros} L`
              : "Nenhum abastecimento registrado ainda."}
          </p>
        </header>

        {passo !== "sucesso" && (
          <div className="px-4">
            <PassosProgresso passoAtual={passo} />
          </div>
        )}

        <div className="px-4">
        <Card>
          {passo === "nome" && (
            <PassoNome
              motoristas={motoristas}
              motoristaId={motoristaId}
              usarNomeLivre={usarNomeLivre}
              nomeLivre={nomeLivre}
              onSelecionar={(id) => {
                setMotoristaId(id);
                setUsarNomeLivre(false);
              }}
              onUsarNomeLivre={() => setUsarNomeLivre(true)}
              onNomeLivreChange={setNomeLivre}
              onContinuar={() => setPasso("foto")}
            />
          )}

          {passo === "foto" && (
            <PassoFoto
              preview={fotoPreview}
              mensagemErro={erroFoto}
              onFotoChange={handleFotoChange}
              onVoltar={() => setPasso("nome")}
              onContinuar={handleContinuarFoto}
            />
          )}

          {passo === "processando" && <PassoProcessando />}

          {passo === "formulario" && (
            <PassoFormulario
              valores={valores}
              onChange={handleChangeFormulario}
              kmMinimo={veiculo.kmAtual}
              erro={erro}
              aviso={avisoFormulario}
              enviando={enviando}
              onVoltar={() => setPasso("foto")}
              onSubmit={handleSubmit}
            />
          )}

          {passo === "sucesso" && (
            <PassoSucesso offline={salvoOffline} onNovoRegistro={reiniciar} />
          )}
        </Card>
        </div>
      </div>
    </main>
  );
}

const PASSOS_VISIVEIS: { chave: Passo[]; label: string }[] = [
  { chave: ["nome"], label: "Nome" },
  { chave: ["foto", "processando"], label: "Foto" },
  { chave: ["formulario"], label: "Dados" },
];

// Indicador simples de progresso do wizard — "processando" conta como parte
// do passo "Foto" (é uma etapa transitória, não uma decisão do motorista).
function PassosProgresso({ passoAtual }: { passoAtual: Passo }) {
  const indiceAtual = PASSOS_VISIVEIS.findIndex((p) => p.chave.includes(passoAtual));

  return (
    <div className="flex items-center gap-2">
      {PASSOS_VISIVEIS.map((p, indice) => {
        const concluido = indice < indiceAtual;
        const ativo = indice === indiceAtual;
        return (
          <div key={p.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full ${
                  concluido || ativo ? "bg-primary-700" : "bg-neutral-200"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  ativo ? "text-primary-800" : concluido ? "text-neutral-500" : "text-neutral-400"
                }`}
              >
                {p.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
