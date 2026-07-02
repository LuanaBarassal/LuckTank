-- LuckTank — Fase 2: policies de escrita para `usuarios`.
-- 0001 só tinha usuarios_select. A criação de usuário na prática sempre passa
-- pelo admin client (precisa de supabase.auth.admin.createUser/inviteUserByEmail,
-- que já exige service role), mas adicionamos a policy mesmo assim como defesa
-- em profundidade — se algum código no futuro tentar inserir/editar usuarios
-- pela sessão do próprio usuário, só administrador consegue.

create policy usuarios_insert on usuarios for insert with check (
  empresa_id = usuario_empresa_id() and usuario_papel() = 'administrador'
);

create policy usuarios_update on usuarios for update using (
  empresa_id = usuario_empresa_id() and usuario_papel() = 'administrador'
);
