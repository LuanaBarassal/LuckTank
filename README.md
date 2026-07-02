# LuckTank

Sistema de controle de combustível e anti-fraude para frotas. Piloto: Expresso Mundial.

## Setup (Fase 1)

1. Instalar dependências:
   ```
   npm install
   ```

2. Criar um projeto em https://supabase.com/dashboard e copiar `.env.example` para `.env.local`, preenchendo:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — em Project Settings > API.
   - `SUPABASE_SERVICE_ROLE_KEY` — mesma tela (nunca expor no client).
   - `GEMINI_API_KEY` — gerar em https://aistudio.google.com/apikey (não habilitar billing no projeto Google, senão o free tier some).

3. Rodar a migration em `supabase/migrations/0001_init.sql` no SQL Editor do Supabase (ou via Supabase CLI:
   `npx supabase link` + `npx supabase db push`).

4. Criar o primeiro usuário do escritório: cadastrar no Supabase Auth (Authentication > Users) e depois
   inserir a linha correspondente em `usuarios` (mesmo `id` do auth.users) com `papel = 'administrador'`
   e o `empresa_id` de uma linha criada em `empresas`.

5. Rodar o projeto:
   ```
   npm run dev
   ```

## Estrutura

- `app/page.tsx` — tela pública de status (única rota liberada em "/" pelo middleware) que confirma
  Supabase/Gemini configurados, service worker registrado e mostra o design system.
- `app/(motorista)/r/[qrToken]` — fluxo do motorista, sem login, aberto via QR do veículo (público).
- `app/(escritorio)` — dashboard autenticado (Supabase Auth + RLS por `empresa_id`).
- `app/api` — rotas de servidor: `gemini/status` (health check), e futuramente OCR, gravação de
  abastecimento e sincronização offline.
- `app/manifest.ts` — manifest do PWA (gera `/manifest.webmanifest` automaticamente).
- `public/sw.js` — service worker mínimo (cache do app shell); registrado só em produção via
  `components/pwa-register.tsx`.
- `lib/supabase` — clients Supabase (`client.ts` browser, `server.ts` Server Components, `admin.ts`
  service role — só usado dentro de `app/api`, protegido por `server-only`).
- `lib/gemini/client.ts` — client do Gemini (free tier), chave via env, também protegido por
  `server-only`; usado só a partir de Route Handlers.
- `lib/validacao` — motor de regras de fraude, determinístico, sem IA (Fase 6).
- `components/ui` — design system mínimo (`Button`, `Card`, `Input`), mobile-first, toque mínimo
  de 48px, paleta verde (`primary-*`) + neutros claros (`neutral-*`) definida em `tailwind.config.ts`.
- `supabase/migrations` — schema do banco.

Uma interface `lib/ocr/provider.ts` (para trocar de Gemini para outro modelo sem tocar no resto do
app) entra na Fase 4, junto com a extração de fato — nesta fase só o client cru estava pedido.

## Fases

1. Fundações (este commit) — projeto, schema, auth do escritório, RLS.
2. Cadastros — veículos (com geração de QR), motoristas, usuários/permissões.
3. Fluxo do motorista sem IA — formulário manual completo, com bloqueio de KM.
4. OCR — Gemini Flash, tela de confirmação/edição, fallback de foto ilegível.
5. Offline/PWA — fila local, sincronização, idempotência.
6. Motor de validação e alertas.
7. Dashboard completo — gráficos, abas ônibus/motorista (mapa pendente, ver PROJETO.md).
8. Validação em produção e prontidão pra piloto (sem integração externa — o
   LuckTank opera sozinho).

> Nota: este README reflete o planejamento inicial do projeto. O estado real
> e atualizado de cada fase está em `PROJETO.md`, que é a fonte de verdade.
