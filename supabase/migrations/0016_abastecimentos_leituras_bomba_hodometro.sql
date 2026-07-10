-- LuckTank — conferência cruzada anti-fraude (captura guiada de 3 fotos,
-- Bloco 4). Guarda o que a IA LEU na bomba/hodômetro, separado do que foi
-- CONFIRMADO pelo motorista (litros/valor_total/km_atual já existentes) —
-- é exatamente essa comparação que alimenta as novas regras do motor de
-- validação (lib/validacao/regras.ts).
--
-- Nullable, sem exceção: nem toda foto é obrigatória (bomba/hodômetro são
-- opcionais desde o Bloco 1 da captura guiada), e ausência de leitura NUNCA
-- deve ser tratada como fraude — as novas regras já pulam a comparação
-- quando o valor é null.

alter table abastecimentos
  add column bomba_litros_lido numeric(8, 2),
  add column bomba_valor_total_lido numeric(10, 2),
  add column hodometro_km_lido numeric(10, 1);

alter table abastecimentos
  add constraint abastecimentos_bomba_litros_lido_positivo
    check (bomba_litros_lido is null or bomba_litros_lido > 0),
  add constraint abastecimentos_bomba_valor_total_lido_positivo
    check (bomba_valor_total_lido is null or bomba_valor_total_lido > 0),
  add constraint abastecimentos_hodometro_km_lido_positivo
    check (hodometro_km_lido is null or hodometro_km_lido > 0);
