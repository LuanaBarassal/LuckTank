-- LuckTank — schema inicial (Fase 1)
-- Escopo enxuto conforme decidido: sem preço regional, sem geolocalização/EXIF em regra,
-- sem fuzzy match de motorista, sem regra de valor_litro extraído x calculado.

create extension if not exists "pgcrypto";

-- ============================================================================
-- NÚCLEO MULTI-TENANT
-- ============================================================================

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Usuários do escritório (autenticados via Supabase Auth). Motorista NÃO entra aqui.
create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references empresas (id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null check (papel in ('supervisor', 'gerente', 'administrador')),
  criado_em timestamptz not null default now()
);

create index idx_usuarios_empresa on usuarios (empresa_id);

-- ============================================================================
-- NÚCLEO COMPARTILHADO (pronto para módulos futuros no mesmo QR)
-- ============================================================================

create table veiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  placa text not null,
  modelo text,
  marca text,
  ano int,
  capacidade_tanque_litros numeric(8, 2),
  km_atual numeric(10, 1), -- denormalizado, atualizado a cada abastecimento aceito
  qr_token uuid not null default gen_random_uuid(), -- permanente, é a URL /r/[qr_token]
  qr_gerado_em timestamptz not null default now(),
  foto_url text,
  ativo boolean not null default true,
  proxima_revisao_km numeric(10, 1),
  proxima_revisao_data date,
  luckfrotas_veiculo_id text, -- ponto de integração futura (mock por enquanto)
  criado_em timestamptz not null default now()
);

create unique index idx_veiculos_qr_token on veiculos (qr_token);
create index idx_veiculos_empresa on veiculos (empresa_id);
create unique index idx_veiculos_placa_empresa on veiculos (empresa_id, placa);

create table motoristas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  nome text not null,
  cpf text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index idx_motoristas_empresa on motoristas (empresa_id);

-- Fotos/mídias, polimórfico — reutilizável por qualquer módulo futuro (pneu, óleo, checklist...)
create table midias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  entidade_tipo text not null, -- ex: 'abastecimento'
  entidade_id uuid not null,
  url text not null,
  tipo text not null default 'foto_comprovante',
  exif_gps jsonb,
  exif_timestamp timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_midias_entidade on midias (entidade_tipo, entidade_id);

-- Alertas, também polimórfico — um só motor de alerta para todos os módulos futuros
create table alertas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  entidade_tipo text not null,
  entidade_id uuid not null,
  tipo_regra text not null,
  nivel text not null check (nivel in ('info', 'atencao', 'critico')),
  detalhes jsonb,
  resolvido boolean not null default false,
  resolvido_por uuid references usuarios (id),
  resolvido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_alertas_entidade on alertas (entidade_tipo, entidade_id);
create index idx_alertas_empresa_resolvido on alertas (empresa_id, resolvido);

-- ============================================================================
-- MÓDULO 1: ABASTECIMENTO
-- ============================================================================

create table abastecimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  veiculo_id uuid not null references veiculos (id),
  motorista_id uuid references motoristas (id),
  motorista_nome_livre text, -- motorista não cadastrado; aparece destacado no escritório

  -- extração por IA (bruto) vs. confirmado pelo motorista
  ocr_raw jsonb,
  ocr_prompt_version text,
  ocr_confianca text check (ocr_confianca in ('alta', 'media', 'baixa', 'falhou')),
  campos_editados_manualmente jsonb, -- ex: ["litros","valor_total"]

  data_abastecimento date not null,
  hora time,
  posto_nome text,
  posto_cnpj text,
  posto_cidade text,
  posto_uf text,
  litros numeric(8, 2) not null,
  valor_total numeric(10, 2) not null,
  forma_pagamento text,
  numero_nota text,
  bandeira_posto text,

  km_atual numeric(10, 1) not null,
  km_anterior_snapshot numeric(10, 1), -- travado no momento do registro, para auditoria
  km_rodado numeric(10, 1) generated always as (km_atual - km_anterior_snapshot) stored,
  consumo_kml numeric(8, 3) generated always as (
    case when litros > 0 then (km_atual - km_anterior_snapshot) / litros else null end
  ) stored,

  origem_registro text not null default 'online' check (origem_registro in ('online', 'fila_offline')),
  registro_uuid uuid not null, -- gerado no client, chave de idempotência

  status text not null default 'ativo' check (status in ('ativo', 'editado', 'excluido')),

  criado_em timestamptz not null default now(),
  sincronizado_em timestamptz,
  atualizado_em timestamptz,
  editado_por uuid references usuarios (id),
  excluido_por uuid references usuarios (id),
  excluido_em timestamptz
);

create unique index idx_abastecimentos_idempotencia on abastecimentos (veiculo_id, registro_uuid);
create index idx_abastecimentos_empresa on abastecimentos (empresa_id);
create index idx_abastecimentos_veiculo on abastecimentos (veiculo_id, data_abastecimento desc);
create index idx_abastecimentos_motorista on abastecimentos (motorista_id);
-- suporta a regra "nota fiscal ou foto duplicada"
create index idx_abastecimentos_nota_duplicada on abastecimentos (veiculo_id, numero_nota) where numero_nota is not null;

-- Auditoria append-only de edição/exclusão (crítico para um produto anti-fraude:
-- sem isso, a maior fraude possível é a interna, feita pelo próprio escritório).
create table edicoes_log (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  tabela text not null,
  registro_id uuid not null,
  usuario_id uuid not null references usuarios (id),
  acao text not null check (acao in ('update', 'delete')),
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);

create index idx_edicoes_log_registro on edicoes_log (tabela, registro_id);

-- Atualiza o KM denormalizado do veículo a cada novo abastecimento ativo
create or replace function trg_atualiza_km_veiculo() returns trigger as $$
begin
  if new.status = 'ativo' then
    update veiculos set km_atual = new.km_atual where id = new.veiculo_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger atualiza_km_veiculo
  after insert on abastecimentos
  for each row execute function trg_atualiza_km_veiculo();

-- ============================================================================
-- RLS
-- ============================================================================

create or replace function usuario_empresa_id() returns uuid as $$
  select empresa_id from usuarios where id = auth.uid();
$$ language sql security definer stable;

create or replace function usuario_papel() returns text as $$
  select papel from usuarios where id = auth.uid();
$$ language sql security definer stable;

alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table veiculos enable row level security;
alter table motoristas enable row level security;
alter table midias enable row level security;
alter table alertas enable row level security;
alter table abastecimentos enable row level security;
alter table edicoes_log enable row level security;

-- Escritório (autenticado): sempre restrito à própria empresa
create policy usuarios_select on usuarios for select using (empresa_id = usuario_empresa_id());

create policy veiculos_select on veiculos for select using (empresa_id = usuario_empresa_id());
create policy veiculos_insert on veiculos for insert with check (
  empresa_id = usuario_empresa_id() and usuario_papel() = 'administrador'
);
create policy veiculos_update on veiculos for update using (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('gerente', 'administrador')
);

create policy motoristas_select on motoristas for select using (empresa_id = usuario_empresa_id());
create policy motoristas_insert on motoristas for insert with check (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('gerente', 'administrador')
);
create policy motoristas_update on motoristas for update using (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('gerente', 'administrador')
);

create policy midias_select on midias for select using (empresa_id = usuario_empresa_id());
create policy alertas_select on alertas for select using (empresa_id = usuario_empresa_id());
create policy alertas_update on alertas for update using (empresa_id = usuario_empresa_id());

create policy abastecimentos_select on abastecimentos for select using (empresa_id = usuario_empresa_id());
create policy abastecimentos_update on abastecimentos for update using (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('supervisor', 'gerente', 'administrador')
);
-- Exclusão real de linha não é usada pelo app (é soft delete via UPDATE status='excluido'),
-- mas a policy fica como segunda camada de proteção.
create policy abastecimentos_delete on abastecimentos for delete using (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('gerente', 'administrador')
);

create policy edicoes_log_select on edicoes_log for select using (empresa_id = usuario_empresa_id());

-- NOTA: o fluxo do motorista (sem login, via QR) NÃO usa o client do browser com anon key.
-- Toda escrita de abastecimento passa pelas rotas /api/* do servidor, que usam a service role
-- e aplicam a validação de negócio (bloqueio de KM, regras de fraude) antes de gravar.
-- Por isso não há policy de INSERT anônimo aqui — de propósito.
