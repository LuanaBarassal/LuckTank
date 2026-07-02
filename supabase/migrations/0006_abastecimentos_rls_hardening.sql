-- LuckTank — hardening pré-piloto: fecha buraco de auditoria em `abastecimentos`.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do schema existente.
--
-- Problema encontrado na auditoria: `abastecimentos_update` (0001) liberava UPDATE
-- pra supervisor+ e `abastecimentos_delete` (0001) liberava DELETE pra gerente+,
-- via client autenticado (anon key + sessão) — o mesmo client que qualquer
-- Client Component do escritório já usa. Nenhuma tela/rota do app edita ou
-- apaga abastecimento (confirmado por busca no código: só INSERT, via
-- app/api/abastecimentos/route.ts com service role). Ou seja, essas policies
-- eram só superfície: um supervisor logado podia abrir o console do navegador
-- e alterar/apagar um abastecimento direto, sem passar por `edicoes_log`
-- (que só é escrito por código de servidor, nunca por trigger de banco).
-- Isso quebra o invariante #4 do projeto (toda edição deixa rastro) bem no
-- coração do produto anti-fraude.
--
-- Se um dia for necessário editar/excluir abastecimento pela UI, isso deve
-- entrar como uma Server Action dedicada (mesmo padrão de onibus/actions.ts e
-- motoristas/actions.ts): valida papel via getUsuarioAtual(), grava em
-- edicoes_log, e só então usa o client (ou o admin client) pra mutar. Até lá,
-- a tabela é somente leitura para o client autenticado.

drop policy if exists abastecimentos_update on abastecimentos;
drop policy if exists abastecimentos_delete on abastecimentos;

-- abastecimentos_select (isolamento por empresa) continua valendo, sem mudança.
-- INSERT continua não tendo policy nenhuma pra client autenticado — o único
-- caminho de escrita é a service role em app/api/abastecimentos/route.ts.
