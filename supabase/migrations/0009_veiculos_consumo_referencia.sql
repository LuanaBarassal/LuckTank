-- LuckTank — Consumo de referência do veículo (comparativo real x fabricante).
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- Valor informado pelo gestor da frota (manual/ficha técnica do modelo do
-- ônibus) em km/L — âncora ABSOLUTA de consumo, complementar à média
-- histórica do próprio veículo que o motor de fraude já usa (essa é
-- relativa, calculada em cima dos últimos abastecimentos do veículo; ver
-- lib/validacao/regras.ts). Nullable e opcional de propósito: veículos já
-- cadastrados não têm esse valor ainda, e preencher não pode ser bloqueante
-- pro cadastro/edição continuar funcionando.

alter table veiculos add column if not exists consumo_referencia_kml numeric(6, 2);
