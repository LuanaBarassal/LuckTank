-- LuckTank — estado da nota fiscal eletrônica por abastecimento.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do schema existente.
--
-- A NF em si é uma linha de `midias` com tipo = 'nota_fiscal' (motorista
-- fotografa no fluxo do QR, ou o escritório anexa depois — ver
-- app/api/abastecimentos/route.ts e anexarNotaFiscal em
-- app/(escritorio)/onibus/actions.ts). `tem_nota_fiscal` é o estado
-- denormalizado disso, pra o escritório filtrar "nota pendente" com um `.eq`
-- simples (inclusive paginado) em vez de cruzar com `midias` em toda query.
--
-- Mantido por TRIGGER em `midias`, não pelo código: os dois caminhos de
-- escrita (rota do motorista com service role e Server Action do escritório)
-- ficam automaticamente consistentes, e a flag nasce na mesma transação da
-- linha de mídia — nunca "tem nota" sem a mídia existir, nem o contrário.

-- Três estados, de propósito:
--   true  = tem NF anexada
--   false = NF pendente (todo abastecimento novo nasce assim — default)
--   null  = registrado ANTES deste recurso existir: a NF nunca foi pedida
--           pelo sistema, então não entra no "pendente" (senão todo o
--           histórico anterior viraria pendência de uma vez no dashboard).
--           O escritório ainda pode anexar a NF a um desses se quiser.
alter table abastecimentos
  add column if not exists tem_nota_fiscal boolean default false;

-- Backfill do histórico: null, exceto se já existir NF em midias (possível
-- se o código do Bloco 1 foi pro ar antes desta migration).
update abastecimentos a
set tem_nota_fiscal = case
  when exists (
    select 1 from midias m
    where m.entidade_tipo = 'abastecimento'
      and m.entidade_id = a.id
      and m.tipo = 'nota_fiscal'
  ) then true
  else null
end;

-- Filtro "nota pendente" do escritório: sempre recortado por empresa + status.
create index if not exists idx_abastecimentos_nota_pendente
  on abastecimentos (empresa_id, data_abastecimento)
  where tem_nota_fiscal = false and status = 'ativo';

-- security definer: `abastecimentos` não tem policy de UPDATE pra client
-- autenticado desde a 0006 (e não deve ganhar) — o trigger precisa conseguir
-- atualizar a flag independentemente de quem inseriu/apagou a mídia.
create or replace function trg_sincroniza_tem_nota_fiscal() returns trigger as $$
declare
  alvo uuid;
begin
  if tg_op = 'DELETE' then
    alvo := old.entidade_id;
  else
    alvo := new.entidade_id;
  end if;

  update abastecimentos
  set tem_nota_fiscal = exists (
    select 1 from midias m
    where m.entidade_tipo = 'abastecimento'
      and m.entidade_id = alvo
      and m.tipo = 'nota_fiscal'
  )
  where id = alvo;

  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger sincroniza_tem_nota_fiscal_insert
  after insert on midias
  for each row
  when (new.entidade_tipo = 'abastecimento' and new.tipo = 'nota_fiscal')
  execute function trg_sincroniza_tem_nota_fiscal();

create trigger sincroniza_tem_nota_fiscal_delete
  after delete on midias
  for each row
  when (old.entidade_tipo = 'abastecimento' and old.tipo = 'nota_fiscal')
  execute function trg_sincroniza_tem_nota_fiscal();
