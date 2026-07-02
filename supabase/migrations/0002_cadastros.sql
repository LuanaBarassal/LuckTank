-- LuckTank — Fase 2: cadastros (veículos, motoristas, usuários) + geração de QR.
-- Regra de ouro: não editar 0001_init.sql. Isto só ADICIONA em cima do schema existente.

-- ============================================================================
-- veiculos: tipo de combustível
-- ============================================================================

alter table veiculos add column if not exists tipo_combustivel text
  check (tipo_combustivel in ('diesel_s10', 'diesel_s500', 'arla', 'gasolina', 'etanol'));

-- ============================================================================
-- edicoes_log: agora também registra CRIAÇÃO (acao = 'insert'), não só update/delete.
-- A constraint de 0001 não tinha nome explícito, então localizamos e trocamos por nome.
-- ============================================================================

do $$
declare
  nome_constraint text;
begin
  select conname into nome_constraint
  from pg_constraint
  where conrelid = 'edicoes_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%acao%';

  if nome_constraint is not null then
    execute format('alter table edicoes_log drop constraint %I', nome_constraint);
  end if;
end $$;

alter table edicoes_log add constraint edicoes_log_acao_check
  check (acao in ('insert', 'update', 'delete'));

-- ============================================================================
-- Storage: fotos de veículos (opcional no cadastro).
-- Bucket público de LEITURA (foto de ônibus não é dado sensível); escrita
-- restrita por pasta empresa_id/veiculo_id/arquivo via RLS de storage.objects.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('fotos-veiculos', 'fotos-veiculos', true)
on conflict (id) do nothing;

create policy fotos_veiculos_select on storage.objects
  for select using (bucket_id = 'fotos-veiculos');

create policy fotos_veiculos_insert on storage.objects
  for insert with check (
    bucket_id = 'fotos-veiculos'
    and (storage.foldername(name))[1] = usuario_empresa_id()::text
  );

create policy fotos_veiculos_update on storage.objects
  for update using (
    bucket_id = 'fotos-veiculos'
    and (storage.foldername(name))[1] = usuario_empresa_id()::text
  );

create policy fotos_veiculos_delete on storage.objects
  for delete using (
    bucket_id = 'fotos-veiculos'
    and (storage.foldername(name))[1] = usuario_empresa_id()::text
    and usuario_papel() in ('gerente', 'administrador')
  );
