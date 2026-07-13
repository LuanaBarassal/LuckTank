-- E-mail de notificação por empresa (caixa do escritório) — usado pra
-- avisar a cada abastecimento registrado (não é o e-mail de alerta crítico,
-- que já existe separado e continua indo pros administradores cadastrados).
-- Nullable de propósito: empresa recém-criada não tem esse e-mail definido
-- ainda; sem ele, o disparo simplesmente não envia (ver
-- lib/email/notificar-abastecimento.ts).
--
-- CHECK como defesa em profundidade (mesmo padrão da 0012): a validação
-- "de verdade" é o Zod em lib/validacao/schemas.ts, mas o schema não deveria
-- ser a única linha de defesa contra um valor claramente não-e-mail entrando
-- direto via service role. Regex simples (tem "@", tem algo depois com
-- ".") — não tenta validar RFC 5322 completo, só barra lixo óbvio.
alter table empresas
  add column email_notificacao text,
  add constraint empresas_email_notificacao_formato
    check (email_notificacao is null or email_notificacao ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
