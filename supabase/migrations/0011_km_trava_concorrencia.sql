-- LuckTank — trava de concorrência no bloqueio de KM (invariante #6).
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- ACHADO (auditoria externa): a checagem "KM não pode ser menor que o último
-- registrado" vivia só em app/api/abastecimentos/route.ts, comparando com o
-- veiculos.km_atual lido ANTES do insert (sem lock). O trigger
-- `atualiza_km_veiculo` (0001_init.sql) sempre sobrescrevia km_atual
-- incondicionalmente, sem comparar com o valor mais recente. Dois inserts
-- concorrentes pro mesmo veículo (ex.: fila offline de dois celulares
-- sincronizando ao mesmo tempo, ou dois motoristas usando o mesmo QR) podiam
-- os dois passar na checagem da aplicação antes de qualquer um gravar — o
-- segundo a chegar no trigger sobrescrevia km_atual com um valor menor que o
-- que tinha acabado de ser validado. Um TOCTOU clássico: validar e gravar em
-- passos separados, sem nada segurando a linha entre os dois.
--
-- Fix: trigger BEFORE INSERT que trava a linha do veículo (`for update`) e
-- SÓ ENTÃO compara — o lock fica retido até o fim da transação do insert
-- (cada insert via PostgREST/Supabase já é uma transação própria), o que
-- serializa concorrência de verdade no Postgres: a segunda transação
-- concorrente espera a primeira terminar antes de conseguir ler km_atual, em
-- vez de ler um valor potencialmente desatualizado. A checagem em
-- route.ts continua existindo (feedback rápido pro usuário, sem precisar
-- tentar o insert pra descobrir o erro), mas deixa de ser a única linha de
-- defesa — o banco agora é a fonte de verdade.
--
-- errcode customizado ('LT001') pra route.ts distinguir esta violação de
-- qualquer outro erro de insert, mesmo padrão já usado pro '23505'
-- (unique violation de registro_uuid).

create or replace function trg_valida_km_nao_retrocede() returns trigger as $$
declare
  km_travado numeric;
begin
  if new.status = 'ativo' then
    select km_atual into km_travado from veiculos where id = new.veiculo_id for update;

    if km_travado is not null and new.km_atual < km_travado then
      raise exception 'km_atual (%) menor que o ultimo km registrado (%) para o veiculo %',
        new.km_atual, km_travado, new.veiculo_id
        using errcode = 'LT001';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger valida_km_nao_retrocede
  before insert on abastecimentos
  for each row execute function trg_valida_km_nao_retrocede();
