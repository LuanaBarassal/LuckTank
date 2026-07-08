-- Data da próxima renovação de contrato, por empresa. Cobrança é manual
-- (venda direta, sem Stripe) — sem isso, controlar quem já pagou vira só
-- memória do dono do sistema, o que não escala além de poucos clientes.
-- Nullable de propósito: empresa recém-criada não tem renovação marcada
-- ainda, o dono do sistema preenche depois de fechar o pagamento.
alter table empresas add column proxima_renovacao date;
