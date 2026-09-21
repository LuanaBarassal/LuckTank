-- LuckTank — restringe alertas_update por papel.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do schema existente.
--
-- Achado da auditoria de 2026-07-20: `alertas_update` (0001) liberava UPDATE
-- pra QUALQUER usuário autenticado da empresa, sem exigir papel — era
-- deliberado (comentário em app/(escritorio)/alertas/actions.ts), mas deixa
-- um supervisor resolver (silenciar) um alerta crítico de fraude sozinho,
-- sem revisão de gerente/administrador. Todas as outras policies de escrita
-- do produto (veiculos_update, motoristas_update, veiculos_insert) já
-- restringem a gerente/administrador — alertas_update era a exceção.
--
-- resolvido_por/resolvido_em continuam gravando quem resolveu (rastreável),
-- só o "quem pode" que fica mais estrito.

drop policy if exists alertas_update on alertas;

create policy alertas_update on alertas for update using (
  empresa_id = usuario_empresa_id() and usuario_papel() in ('gerente', 'administrador')
);
