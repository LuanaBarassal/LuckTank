-- LuckTank — corrige buraco de RLS na tabela `empresas`.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do
-- schema existente.
--
-- ACHADO (descoberto ao construir o painel de administração do sistema):
-- `empresas` teve `enable row level security` desde a 0001_init.sql, mas
-- NENHUMA migration nunca criou uma policy pra ela. RLS sem nenhuma policy
-- é "nega tudo" por padrão no Postgres — confirmado com teste direto contra
-- o projeto real (client de sessão, papel administrador, tentando ler a
-- PRÓPRIA empresa): retornou 0 linhas. Não quebrou nada visivelmente porque
-- todo código que lê `empresas.nome` (dashboard, export Excel/PDF/ZIP) já
-- tinha fallback (`empresa?.nome ?? "—"` / `?? "Empresa"`) — o nome real da
-- empresa nunca apareceu nesses lugares, sempre caiu no fallback em
-- silêncio, sem erro nenhum pra notar.

create policy empresas_select on empresas for select using (id = usuario_empresa_id());
