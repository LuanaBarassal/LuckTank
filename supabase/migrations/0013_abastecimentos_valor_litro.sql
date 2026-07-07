-- LuckTank — coluna valor_litro em abastecimentos.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- PEDIDO DO USUÁRIO: o motorista via o "valor por litro" na confirmação
-- (calculado ao vivo como valor_total/litros — ver PROJETO.md, seção
-- "Agenda, valor por litro e OCR") mas não conseguia CORRIGI-LO quando
-- estava errado: sendo só um número derivado, editá-lo exigia adivinhar se
-- o problema era em "litros" ou em "valor total" e mexer no campo errado
-- indiretamente. Fix: campo próprio, editável, com coluna real pra guardar
-- o valor que o motorista confirmou.
--
-- Sem regra de consistência com litros×valor_total — mesmo corte de escopo
-- já documentado na 0001_init.sql ("sem regra de valor_litro extraído x
-- calculado"). Nullable: abastecimentos antigos não têm esse dado, e não
-- seria correto inventar um valor pra eles agora.

alter table abastecimentos
  add column valor_litro numeric(8, 3),
  add constraint abastecimentos_valor_litro_positivo check (valor_litro is null or valor_litro > 0);
