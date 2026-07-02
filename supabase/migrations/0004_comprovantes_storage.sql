-- LuckTank — Fase 3: bucket de fotos de comprovante de abastecimento.
-- Upload sempre via /api/abastecimentos (service role, motorista não tem sessão) —
-- por isso não há policy de INSERT aqui, só leitura (o escritório vai
-- precisar ver a foto no dashboard, Fase 7).

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', true)
on conflict (id) do nothing;

create policy comprovantes_select on storage.objects
  for select using (bucket_id = 'comprovantes');
