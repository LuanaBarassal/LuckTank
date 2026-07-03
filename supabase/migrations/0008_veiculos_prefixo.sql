-- LuckTank — Prefixo do veículo (identidade operacional).
-- Na operação real da frota, motorista e escritório se referem ao ônibus
-- pelo PREFIXO (ex.: "1450"), não pela placa — a placa é só o dado legal.
-- Coluna opcional (nullable) de propósito: veículos já cadastrados (ex.:
-- EXM1A23) não têm prefixo ainda e não podem quebrar; toda tela que exibe
-- o veículo trata "sem prefixo" mostrando só a placa (ver lib/formatacao.ts,
-- formatarVeiculo).

alter table veiculos add column if not exists prefixo text;
