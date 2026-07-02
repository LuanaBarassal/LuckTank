-- LuckTank — Fase 6: hash do conteúdo da foto, pra detectar comprovante
-- reaproveitado (mesma foto usada em mais de um abastecimento).

alter table midias add column if not exists hash_sha256 text;

create index if not exists idx_midias_hash on midias (hash_sha256)
  where hash_sha256 is not null;
