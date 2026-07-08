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

export function obterIp(request: Request): string {
  // Vercel injeta x-forwarded-for; pega o primeiro IP da cadeia (o do cliente).
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
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
