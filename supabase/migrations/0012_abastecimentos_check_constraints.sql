-- LuckTank — constraints de valor (defesa em profundidade) em abastecimentos.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- ACHADO (auditoria externa): litros/valor_total/km_atual são NOT NULL desde
-- a 0001_init.sql, mas sem CHECK de valor positivo — a garantia vivia só no
-- Zod (lib/validacao/schemas.ts, que já exige `.positive()` nos três). Todo
-- insert de hoje passa por lá, mas RLS/schema deveriam ser a segunda linha de
-- defesa, não a única ausente — sobretudo havendo service role usado em mais
-- de um Route Handler (app/api/abastecimentos). Aditivo e seguro: os dados
-- existentes já respeitam a regra (Zod sempre validou antes de gravar), então
-- a validação completa do ADD CONSTRAINT não encontra violação nenhuma.

alter table abastecimentos
  add constraint abastecimentos_litros_positivo check (litros > 0),
  add constraint abastecimentos_valor_total_positivo check (valor_total > 0),
  add constraint abastecimentos_km_atual_positivo check (km_atual > 0);
