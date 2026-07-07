-- LuckTank — PIN de acesso por usuário, protegendo ações sensíveis.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- PEDIDO: mesmo padrão do LuckFrota (produto irmão) — cada usuário do
-- escritório pode definir um PIN de 6 dígitos, exigido antes de exportar
-- Excel/PDF/ZIP e antes de excluir um abastecimento. Diferente do LuckFrota
-- (que guarda o PIN em texto puro em `profiles.pin_acesso` e compara no
-- client): aqui o hash é gerado com salt (scrypt, lib/auth/pin.ts) e a
-- verificação SEMPRE roda no servidor via service role — nunca pela sessão
-- do usuário, porque a policy `usuarios_select` (0001) libera ler colegas da
-- mesma empresa, o que exporia o hash de qualquer um pra qualquer colega se
-- esta coluna fosse lida pelo client autenticado.
--
-- Nullable: usuário sem PIN definido ainda não tem acesso bloqueado a nada
-- (ver lib/auth/pin.ts — sem pin_hash, a verificação sempre nega, então as
-- ações passam a exigir cadastrar o PIN antes de usar pela primeira vez).

alter table usuarios add column pin_hash text;
