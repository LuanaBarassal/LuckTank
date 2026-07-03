-- LuckTank — Bloco 3 (melhorias de uso): fecha o buraco de isolamento por
-- tenant no bucket de comprovantes.
--
-- ACHADO: o bucket 'comprovantes' foi criado `public = true` na 0004, com uma
-- policy de SELECT em storage.objects sem NENHUM filtro de empresa
-- (`using (bucket_id = 'comprovantes')`). Bucket público + policy aberta
-- significa que a URL de qualquer foto de comprovante era acessível por
-- qualquer pessoa com o link, de qualquer empresa — só o path
-- (`empresa_id/veiculo_id/arquivo`) escondia isso, o que é obscuridade, não
-- isolamento (viola o invariante #1 do PROJETO.md). Não tinha sido
-- explorado por nada na UI até agora porque nenhuma tela do escritório
-- exibia essas fotos — o Bloco 3 (foto no histórico) é o primeiro
-- consumidor real, por isso o buraco precisou fechar aqui.
--
-- Corrigido: bucket vira privado; a policy aberta de SELECT é removida (não
-- é substituída por uma policy de storage.objects — o acesso agora só passa
-- pela rota autenticada `/api/midias/[id]`, que valida a linha de `midias`
-- via RLS normal da tabela — já isolada por empresa desde a 0001 — antes de
-- servir o arquivo com a service role). O upload em /api/abastecimentos já
-- usa a service role (ignora RLS de Storage de qualquer forma), então nada
-- muda no caminho de escrita.

update storage.buckets set public = false where id = 'comprovantes';

drop policy if exists comprovantes_select on storage.objects;
