import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limit por IP nos endpoints públicos (motorista não tem sessão, então
// IP é a única coisa que dá pra amarrar). Usa Upstash (Redis via REST) em vez
// de um contador em memória: na Vercel cada invocação de função serverless
// pode cair numa instância diferente (ou uma nova, a frio), então um contador
// local não sobrevive entre requisições — precisaria de estado compartilhado
// de verdade. Se as env vars não estiverem configuradas (ex: dev local sem
// conta Upstash), os limitadores ficam null e a função de checagem sempre
// libera — sem rate limit, não sem servidor. Documentado no PROJETO.md como
// limitação até configurar em produção.
const redisConfigurado = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = redisConfigurado ? Redis.fromEnv() : null;

// OCR: cada submissão real usa no máximo MAXIMO_TENTATIVAS_OCR (2) chamadas.
// 10/min por IP dá folga confortável pro uso legítimo e ainda barra abuso de
// script (a cota do Gemini free tier é ~1.500 leituras/dia no total).
const limiteOcr = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "lucktank:ocr" })
  : null;

// Abastecimento: 1 submissão online + eventuais retries da fila offline
// sincronizando. 20/min por IP é folgado pro uso real de um único motorista.
const limiteAbastecimento = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "lucktank:abastecimento",
    })
  : null;

// PIN (export Excel/PDF/fotos, exclusão de abastecimento): achado numa
// auditoria adversarial — nada limitava quantas vezes o PIN podia ser
// tentado. Sessão é o que autentica quem está chamando (nunca IP: o
// atacante relevante aqui já tem uma sessão válida, roubada ou de um
// computador destravado, e está tentando adivinhar só o PIN), então a
// chave é o usuarioId, não o IP — trocar de rede não reseta a contagem.
// 5 tentativas / 5 min é apertado o bastante pra inviabilizar força bruta
// num PIN de 6 dígitos (1 milhão de combinações) mesmo com scrypt barato
// de calcular, e folgado o bastante pra um usuário de verdade que erra
// duas vezes de propósito.
const limitePin = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "5 m"), prefix: "lucktank:pin" })
  : null;

// Login (achado da auditoria 2026-07-16: antes rodava 100% no client,
// direto contra o Supabase Auth, sem passar pelo nosso servidor — nosso
// rate limit não alcançava). DUAS chaves, checadas juntas, porque cada
// uma cobre um padrão de ataque que a outra sozinha deixa passar: só por
// e-mail (com muitos IPs/proxy rotativo, força bruta contra UMA conta) e
// só por IP (um IP tentando MUITOS e-mails, credential spraying). 10/10min
// por IP e 8/15min por e-mail são conservadores o bastante pra travar
// automação sem incomodar alguém que errou a senha 2-3 vezes de verdade.
const limiteLoginPorIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 m"), prefix: "lucktank:login:ip" })
  : null;
const limiteLoginPorEmail = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, "15 m"), prefix: "lucktank:login:email" })
  : null;

// Recuperação de senha ("esqueci minha senha"): mais apertado que login de
// propósito — diferente de errar senha (ação sem custo nenhum pro sistema),
// cada chamada legítima aqui dispara um e-mail de verdade (custo de
// reputação/cota do Resend) e é um vetor natural de sondagem de e-mails
// cadastrados se não fosse limitado. 5/15min por IP, 3/30min por e-mail —
// folgado o bastante pra alguém que clicou "reenviar" umas 2 vezes de
// verdade, apertado o bastante pra inviabilizar varredura de lista de
// e-mails.
const limiteRecuperacaoSenhaPorIp = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "lucktank:recuperacao:ip",
    })
  : null;
const limiteRecuperacaoSenhaPorEmail = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "30 m"),
      prefix: "lucktank:recuperacao:email",
    })
  : null;

// Aceita qualquer objeto com `.get(nome)` (a `Headers` de uma
// NextRequest/Request E a `ReadonlyHeaders` devolvida por `headers()` do
// `next/headers`, usada dentro de Server Actions como o login — que não
// recebem um `Request` pra extrair o IP).
interface HeadersLegiveis {
  get(nome: string): string | null;
}

export function obterIp(headersOrigem: HeadersLegiveis): string {
  // Vercel injeta x-forwarded-for; pega o primeiro IP da cadeia (o do cliente).
  const encaminhado = headersOrigem.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return headersOrigem.get("x-real-ip") ?? "desconhecido";
}

export interface ResultadoLimite {
  permitido: boolean;
}

export async function limitarOcr(ip: string): Promise<ResultadoLimite> {
  if (!limiteOcr) return { permitido: true };
  const { success } = await limiteOcr.limit(ip);
  return { permitido: success };
}

export async function limitarAbastecimento(ip: string): Promise<ResultadoLimite> {
  if (!limiteAbastecimento) return { permitido: true };
  const { success } = await limiteAbastecimento.limit(ip);
  return { permitido: success };
}

export async function limitarPin(usuarioId: string): Promise<ResultadoLimite> {
  if (!limitePin) return { permitido: true };
  const { success } = await limitePin.limit(usuarioId);
  return { permitido: success };
}

// Conta a tentativa (sucesso ou falha — o `.limit()` do Upstash sempre
// incrementa) contra as duas chaves; barra se QUALQUER uma estourar. Chama
// as duas em paralelo mesmo que a primeira já tenha estourado, de propósito:
// senão o tempo de resposta do login variaria conforme qual chave bateu o
// limite primeiro, um side-channel bobo mas evitável de graça.
export async function limitarLogin(ip: string, email: string): Promise<ResultadoLimite> {
  if (!limiteLoginPorIp || !limiteLoginPorEmail) return { permitido: true };
  const [porIp, porEmail] = await Promise.all([
    limiteLoginPorIp.limit(ip),
    limiteLoginPorEmail.limit(email.trim().toLowerCase()),
  ]);
  return { permitido: porIp.success && porEmail.success };
}

// Mesmo padrão de duas chaves em paralelo do login — ver comentário ali.
// Diferente do login, estourar este limite NUNCA aparece pro chamador como
// um motivo distinto: lib/auth/sessao-actions.ts (`solicitarRecuperacaoSenha`)
// devolve a MESMA mensagem genérica de sempre, sem revelar que o motivo foi
// rate limit em vez de e-mail não cadastrado — uma mensagem diferente aqui
// seria, ela mesma, um oráculo (via timing ou texto) de "esse e-mail existe
// e já foi tentado antes").
export async function limitarRecuperacaoSenha(ip: string, email: string): Promise<ResultadoLimite> {
  if (!limiteRecuperacaoSenhaPorIp || !limiteRecuperacaoSenhaPorEmail) return { permitido: true };
  const [porIp, porEmail] = await Promise.all([
    limiteRecuperacaoSenhaPorIp.limit(ip),
    limiteRecuperacaoSenhaPorEmail.limit(email.trim().toLowerCase()),
  ]);
  return { permitido: porIp.success && porEmail.success };
}
