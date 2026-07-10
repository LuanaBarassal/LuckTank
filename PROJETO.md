# LuckTank — Estado do Projeto

> Fonte de verdade do projeto. Se uma sessão nova (ou outro agente) perder o
> contexto da conversa, este arquivo é o ponto de partida — atualize-o ao
> final de cada fase, antes de avançar para a próxima.

Última atualização: 2026-07-10 (3 fotos guiadas — Bloco 4: conferência cruzada anti-fraude bomba×cupom e hodômetro×KM confirmado).

## Visão do produto

LuckTank é um sistema web (PWA) de **controle de combustível e anti-fraude
para frotas**. Cliente piloto: Expresso Mundial (ônibus rodoviários).

Conceito central: cada veículo tem um **QR Code que é sua identidade
digital**. O motorista escaneia e o sistema já sabe qual veículo é, sem
login. O **abastecimento é o 1º módulo** — a arquitetura já nasce pronta
para o mesmo QR abrir manutenção, pneu, óleo, lavagem, checklist e viagem
no futuro (por isso `veiculos`, `motoristas`, `midias` e `alertas` são
tabelas compartilhadas/polimórficas, não amarradas só a abastecimento).

Fluxo do motorista: leve, sem login, foto do comprovante → OCR extrai os
dados → motorista confere/edita → confirma. Fluxo do escritório: dashboard
autenticado, com permissões por papel e um motor de alertas graduado
(info/atenção/crítico) para fraude.

## Stack e decisões técnicas fechadas

- **Next.js 14 (App Router) + TypeScript + Tailwind.**
- **Supabase** (Postgres + Auth + Storage) — RLS por `empresa_id` (multi-tenant)
  e por `papel` (`supervisor` / `gerente` / `administrador`). Funções
  `usuario_empresa_id()` e `usuario_papel()` (security definer) resolvem o
  tenant/papel a partir de `auth.uid()`.
- **OCR: Google Gemini API, free tier, modelo `gemini-flash-latest`
  (visão).** Chamado só no servidor (Route Handlers), chave nunca no client
  (`lib/gemini/client.ts`, protegido por `server-only`). Não habilitar
  billing no projeto Google, senão o free tier some. Provider isolado atrás
  de uma interface (`lib/ocr/provider.ts`) — trocar de Gemini pra outro
  modelo é só implementar `OcrProvider` de novo.
- **Motor de validação é código determinístico, sem IA** (`lib/validacao/regras.ts`)
  — 4 regras puras (recebem contexto já resolvido, sem query dentro):
  capacidade do tanque, nota fiscal duplicada, foto duplicada (hash SHA-256
  do arquivo, coluna `midias.hash_sha256`), consumo fora da faixa histórica
  do veículo, litros desproporcionais ao KM rodado, foto antiga/reaproveitada
  (EXIF `DateTimeOriginal` vs. data informada — ver "Melhorias de uso, Bloco
  2"). O bloqueio de KM menor é separado (invariante #6, roda antes do
  insert). Rodam em `/api/abastecimentos` logo depois do insert, nunca
  derrubam a resposta de sucesso se falharem (try/catch silencioso — alerta
  é bônus informativo). **EXIF deixou de ser cortado do escopo** (era
  verdade até o Bloco 2 das melhorias de uso, quando a galeria foi liberada
  no fluxo do motorista — ver seção própria); preço regional/ANP e
  geolocalização como regra de negócio continuam fora do escopo.
- **PWA**: manifest (`app/manifest.ts`) + service worker mínimo
  (`public/sw.js`, só registra em produção). Fila offline (IndexedDB via
  `idb`) + sincronização por retry (sem Background Sync API — iOS Safari
  não suporta, então o fallback é a estratégia principal, não um plano B)
  com idempotência por `registro_uuid`. Escopo: protege a *submissão* em
  conexão instável, não o carregamento inicial da página (SSR ainda precisa
  de alguma conectividade pra abrir `/r/[qrToken]` pela primeira vez).
- **Gráficos: `recharts`** (`components/escritorio/grafico-barra.tsx`, único
  componente reutilizado nos 5 gráficos do dashboard). Deixa o bundle de
  `/dashboard` em ~106kB — aceitável pro escritório (não é o fluxo leve do
  motorista), mas se crescer mais vale considerar `next/dynamic` pra
  carregar sob demanda.
- **Rate limit: Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`,
  via `lib/rate-limit.ts`). Escolhido em vez de contador em memória porque
  funções serverless da Vercel não compartilham estado entre invocações.
  Precisa de `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` no `.env`
  de produção — sem isso, o rate limit fica inerte (abre, não derruba).
- **Testes: Vitest** (`npm test`), cobrindo `lib/validacao/regras.ts` (motor
  de fraude), `lib/onibus/estatisticas.ts`, `lib/filtros/*` e `lib/export/*`
  — as funções puras/de maior risco silencioso. Não cobre o resto do app
  (páginas, rotas inteiras) — decisão deliberada do hardening pós-Fase 7,
  não uma meta de cobertura total.
- **Export: `exceljs`** (Excel, com hyperlink nativo em célula) e `jspdf` +
  `jspdf-autotable` (PDF) — ver "Melhorias de uso, Bloco 4". `jspdf` em vez
  de `pdfkit` de propósito: `pdfkit` lê fontes `.afm` do disco em tempo de
  execução (risco de bundling em function serverless na Vercel); `jspdf`
  embute fontes padrão como dado JS.
- **Identidade visual: navy (`primary`/`navy`, `#0a1628`) + ciano (`cyan`,
  `#00d4ff`)**, mesma paleta do LuckFrota (produto irmão) — ver "Design por
  contexto" na seção da Fase 8 pra regra completa de onde cada tema se
  aplica. Tipografia: Space Grotesk (`font-title`, títulos) + Plus Jakarta
  Sans (`font-sans`, corpo), via `next/font/google` em `app/layout.tsx`.
- **Deploy alvo**: Vercel (app) + Supabase (banco/auth/storage).
- Motorista nunca fala direto com o Supabase client — sempre via rotas
  `/api/*` do servidor, que usam a service role e aplicam a validação de
  negócio antes de gravar.
- **`types/database.ts` é gerado, não escrito à mão.** Regra pega na marra
  (ver "Lição aprendida" abaixo): sempre regenerar com
  `npx supabase gen types typescript --linked` (CLI já linkado ao projeto
  `ssuwuuechsaknxkqvjsm`) e colar por cima da seção gerada, mantendo os
  aliases de conveniência (`VeiculoRow`, `MotoristaRow`, etc.) no final do
  arquivo.
- **Supabase CLI linkado e operante** — `npx supabase db push` aplica
  migrations novas direto no banco real, sem precisar copiar/colar no SQL
  Editor. `npx supabase migration list` mostra o que está em sincronia.

### Lições aprendidas

- **(Fase 2) `types/database.ts` escrito à mão** (sem o campo
  `__InternalSupabase` e sem `Relationships` no shape exato que o
  `@supabase/supabase-js` mais recente espera) fazia **todo** `.select()`
  resolver silenciosamente para `never` sob `strict: true` — só aparecia no
  `tsc --noEmit`/`next build`, não no `next dev`. Causou 67 erros de tipo
  que sumiram por completo ao trocar o arquivo pelo gerado via
  `supabase gen types typescript --linked`. Não escrever esse arquivo à
  mão de novo.
- **(Fase 3) Server Components que só usam o admin client (service role)
  precisam de `export const dynamic = "force-dynamic"`.** Sem isso, o Next
  trata a página como estática/cacheável (só páginas que leem `cookies()`
  via `next/headers` são automaticamente dinâmicas) — `/r/[qrToken]` ficou
  servindo `km_atual` e "último abastecimento" desatualizados depois do
  primeiro registro, o que quebraria o bloqueio de KM silenciosamente.
  Qualquer página nova do motorista que só use `createAdminClient()` (sem
  sessão) precisa dessa mesma linha.
- **(Fase 4) Nomes de modelo fixos do Gemini quebram — MAS ver revisão de
  2026-07-10 abaixo.** `gemini-1.5-flash` (usado desde a Fase 1 só pro
  health check) retornou 404 "not found" na hora de usar de verdade — o
  modelo foi descontinuado. Troquei pra `gemini-flash-latest`, um alias que
  o Google mantém apontando pro Flash atual. Se o OCR começar a falhar do
  nada, checar `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
  pra ver os modelos realmente disponíveis antes de qualquer outro
  diagnóstico. **Atualização 2026-07-10**: o alias deixou de ser a opção
  estável — trocou de comportamento 2x em menos de um ano (thinking pesado
  sem aviso, depois passou a apontar pro Gemini 3.5 Flash com lentidão/503
  recorrente) — voltou a usar nome fixo (`gemini-2.5-flash`), com o alias
  como fallback só pra 404 de descontinuação real. Ver seção "Diagnóstico e
  correção do OCR" mais abaixo pra decisão completa com evidência.
- **(Fase 4) `tsconfig.json` precisou de `"target": "ES2018"` explícito**
  pra permitir a flag `u` de regex (usada em `\p{Diacritic}` pra remover
  acento na hora de mapear forma de pagamento do OCR pro enum do formulário).
  Sem `target`, o TS assume um padrão antigo que rejeita essa sintaxe mesmo
  rodando em Node 22.
- **(Fase 5) `dynamic = "force-dynamic"` sozinho NÃO bastou** pra impedir
  cache dos fetches do client do Supabase em `/r/[qrToken]` — o "último
  abastecimento" ficou preso em `150000 km` por várias requisições
  seguidas, confirmado até via `curl` direto (não era cache do navegador).
  Precisou adicionar também `export const fetchCache = "force-no-store"` e
  `export const revalidate = 0` explicitamente. Esse bug **já existia desde
  a Fase 3** e passou despercebido porque os testes anteriores sempre
  reiniciavam o dev server entre uma rodada e outra, resetando o cache e
  mascarando o problema. Qualquer página que só use `createAdminClient()`
  precisa das três linhas juntas, não só `dynamic`.

## Status por fase

- ✅ **Fase 1 — Fundação — CONCLUÍDA.** Projeto Next.js/TS/Tailwind/ESLint
  criado; estrutura de pastas (motorista público × escritório autenticado);
  PWA (manifest + SW + registro condicional); clients Supabase
  (`client`/`server`/`admin`); client Gemini server-only + health check;
  design system mínimo (Button/Card/Input, paleta verde + neutros, toque
  48px); schema `supabase/migrations/0001_init.sql` **aplicado no projeto
  Supabase real**; RLS **validado com dados reais** (2 empresas, 2 usuários,
  2 veículos — isolamento por `empresa_id` confirmado sem vazamento,
  dados de teste removidos depois).
- ✅ **Fase 2 — Cadastros — CONCLUÍDA.** CRUD de veículos (`app/(escritorio)/onibus`)
  com geração de QR permanente (`lib/qr.ts`, SVG com legenda + PNG),
  download (`/api/veiculos/[id]/qr`) e etiqueta de impressão; CRUD de
  motoristas com ativar/inativar; convite de usuários do escritório
  (`auth.admin.inviteUserByEmail`, só administrador); stub público de
  `/r/[qrToken]` resolvendo veículo+empresa via service role. Toda escrita
  passa por `getUsuarioAtual()` (checagem de papel no servidor) + grava em
  `edicoes_log` via admin client. Migrations `0002_cadastros.sql` (coluna
  `tipo_combustivel`, `edicoes_log.acao` aceita `insert`, bucket
  `fotos-veiculos`) e `0003_usuarios_rls.sql` (policies de insert/update em
  `usuarios`) aplicadas no projeto real via `supabase db push`.
  **Validado ponta a ponta no navegador**, com empresa e usuários reais
  (não é só teste isolado): veículo `EXM1A23` cadastrado pela empresa
  **Expresso Mundial**, QR gerado e baixável (SVG/PNG) + etiqueta de
  impressão; editado (modelo) e `qr_token` confirmado **idêntico** antes/depois;
  `/r/<qr_token>` resolve o veículo e a empresa certos, sem sessão; usuário
  supervisor tentando `UPDATE` direto em `veiculos` (bypassando a UI) foi
  **bloqueado pelo RLS** (0 linhas afetadas); `edicoes_log` confirmado
  gravando `insert`/`update` com o `usuario_id` correto. Primeiro usuário
  administrador real criado com o e-mail do dono do produto — senha
  temporária foi só exibida no chat, não está neste arquivo nem no git;
  trocar assim que possível.
- ✅ **Fase 3 — Fluxo do motorista sem IA — CONCLUÍDA.** `/r/[qrToken]`
  virou um wizard de página única (client component `FluxoAbastecimento` +
  `PassoNome`/`PassoFoto`/`PassoFormulario`/`PassoSucesso`): seleção de nome
  (lista de motoristas ativos da empresa OU campo livre), foto do
  comprovante (`<input capture="environment">`, sem OCR ainda), formulário
  manual completo (data/hora, litros, valor, posto, forma de pagamento,
  nota, bandeira, KM), confirmação. `POST /api/abastecimentos` resolve
  veículo+empresa a partir do `qr_token` (nunca client-supplied), sempre via
  `createAdminClient()` (motorista não tem sessão), com bloqueio real de KM
  (409 se `km_atual` < último registrado — testado direto por `fetch`
  contornando a UI, confirmado bloqueado no servidor e sem gravar linha
  nenhuma), upload da foto pro bucket `comprovantes` (migration
  `0004_comprovantes_storage.sql`) + insert em `midias`, e idempotência por
  `registro_uuid` (retry com o mesmo uuid não duplica). Trigger
  `atualiza_km_veiculo` confirmado atualizando `veiculos.km_atual` após o
  insert. **Validado no navegador** com dados reais (motorista "Joao da
  Silva", veículo `EXM1A23`, 250L/R$1450/150000km) — registro conferido
  direto no banco (abastecimento + mídia + km denormalizado).
- ✅ **Fase 4 — OCR — CONCLUÍDA.** `lib/ocr/provider.ts` (interface
  `OcrProvider` + `dadosExtraidosSchema` de validação) e
  `lib/ocr/gemini-provider.ts` (implementação, prompt versionado em
  `lib/ocr/prompts/extrair-abastecimento.v1.ts`, `responseMimeType:
  "application/json"`, heurística de confiança baseada em litros/valor_total
  presentes + proporção de campos preenchidos). `POST /api/ocr` recebe a
  foto e só devolve os dados extraídos — não grava nada. O wizard do
  motorista ganhou o passo "processando": foto → OCR → se sucesso, formulário
  pré-preenchido (editável) com aviso "revise antes de confirmar"; se falha,
  pede nova foto (até 2 tentativas), depois libera manual com aviso. Campo
  `posto_cnpj` adicionado ao formulário (a IA lê, o motorista não precisaria
  digitar). `campos_editados_manualmente` calculado no client comparando o
  valor final com o que a IA devolveu (excluindo `kmAtual`, que nunca vem da
  IA e sempre apareceria como "editado" sem significar nada). **Validado no
  navegador com chamada real ao Gemini** (comprovante sintético gerado via
  canvas, com CNPJ/litros/valor/forma de pagamento/nota/bandeira): extração
  correta em dois cupons diferentes, `ocr_confianca: "alta"` nos dois,
  mapeamento de forma de pagamento ("CARTÃO DE CRÉDITO"/"PIX" → enum)
  funcionando, `campos_editados_manualmente` populado certo quando um campo
  foi alterado (`["litros"]`) e `null` quando nada mudou.
- ✅ **Fase 5 — Offline/PWA — CONCLUÍDA.** `hooks/useOnlineStatus.ts`
  (navigator.onLine + eventos, sem mismatch de hidratação);
  `lib/offline/db.ts` (fila em IndexedDB via `idb`, store
  `fila_abastecimentos`); `lib/offline/comprimir-imagem.ts` (redimensiona
  via canvas antes de guardar, só no caminho offline); `lib/offline/sync.ts`
  (`sincronizarFila()` — reenvia pro mesmo `/api/abastecimentos`, remove em
  sucesso, marca "erro" em falha de validação/negócio, para em falha de
  rede pra tentar tudo de novo depois). No wizard: se offline no passo
  "foto", pula o OCR direto pro formulário manual (a IA não roda sem rede);
  no submit, se offline OU se o `fetch` falhar no meio do envio (conexão
  caiu), enfileira local em vez de mostrar erro — tela de sucesso muda a
  mensagem pra deixar claro que foi salvo no aparelho. Sync dispara sozinho
  ao montar a página e sempre que o evento `online` disparar. Campo
  `origem_registro` agora reflete a origem de verdade (`"online"` vs
  `"fila_offline"`), antes sempre gravava `"online"` mesmo pra itens
  sincronizados da fila. **Sem Background Sync API** — decisão deliberada,
  iOS Safari não suporta, o fallback (retry ao reabrir/reconectar) já é a
  estratégia principal, não um plano B. **Validado no navegador**
  simulando offline via `navigator.onLine`/eventos (não há rede real pra
  cortar neste ambiente): fluxo 100% offline (pula OCR, enfileira, mostra
  sucesso, sincroniza sozinho ao reconectar, remove da fila, grava no banco
  com foto comprimida e `origem_registro: "fila_offline"`); e separadamente,
  queda de conexão simulada *no meio* do envio (com `estaOnline` ainda
  `true`, só o `fetch` de `/api/abastecimentos` interceptado pra falhar) —
  confirmado que cai no mesmo fallback de fila em vez de só mostrar erro.
- ✅ **Fase 6 — Motor de validação e alertas — CONCLUÍDA.**
  `lib/validacao/regras.ts`: 4 funções puras (`avaliarCapacidadeTanque`,
  `avaliarNotaDuplicada`, `avaliarFotoDuplicada`, `avaliarConsumoForaDaFaixa`,
  `avaliarLitrosDesproporcionais` — a última pode disparar junto com a de
  consumo, são complementares, não mutuamente exclusivas) + heurísticas
  ajustáveis (`TOLERANCIA_DESVIO_CONSUMO = 25%`, `CONSUMO_MINIMO_KML_ACEITAVEL = 1`).
  Migration `0005_midias_hash.sql` (coluna `hash_sha256`). Em
  `/api/abastecimentos`: calcula o hash da foto (`node:crypto`), busca nota
  duplicada (mesmo `veiculo_id` + `numero_nota`), foto duplicada (mesmo
  hash ligado a outro abastecimento do mesmo veículo) e a média de consumo
  dos últimos 5 abastecimentos ativos do veículo — monta o contexto e roda
  o motor, grava os alertas resultantes em lote. Painel em `/alertas`
  (`app/(escritorio)/alertas`): lista pendentes/resolvidos com nível
  colorido (info/atenção/crítico), contexto (placa + data), detalhes
  técnicos, botão "Resolver" (`alertas_update` já libera qualquer usuário
  autenticado da empresa, sem exigir papel — resolver não passa por
  `edicoes_log`, não é edição de dado de negócio). Badge de contagem de
  pendentes no menu lateral. **Validado direto contra o endpoint real**
  (5 cenários via `fetch` multipart, bypassando a UI já testada nas fases
  anteriores): capacidade (350L > 300L) disparou crítico + consumo fora da
  faixa junto (esperado); nota duplicada disparou sozinho; foto duplicada
  (mesmo arquivo reenviado) disparou sozinho; consumo muito alto (33 km/L)
  disparou sozinho; litros desproporcionais (0.2 km/L) disparou junto com
  consumo fora da faixa (esperado). Confirmado visualmente no painel,
  incluindo resolver um alerta e ver a contagem cair.
- ✅ **Fase 7 — Dashboard completo — CONCLUÍDA (sem mapa — decisão do
  usuário, ver abaixo).** `lib/dashboard/agregacoes.ts`: funções puras
  (mesmo padrão de `regras.ts`) que recebem a lista bruta de abastecimentos
  dos últimos 90 dias e devolvem séries prontas — gasto por dia, preço
  médio por dia, consumo médio por veículo, consumo médio por motorista
  (agrupa por `motorista_id` OU por `motorista_nome_livre` quando não
  vinculado a um cadastro), postos mais utilizados (top 10). Um único
  componente `GraficoBarra` (recharts, client) reutilizado nos 5 gráficos —
  só muda a chave/cor. `/dashboard` real: cards de resumo do dia (litros,
  valor gasto, nº de abastecimentos, preço médio/litro, calculados
  filtrando a data de hoje) + os 5 gráficos. **Mapa dos abastecimentos:
  pulado de propósito** — pedido pelo usuário depois que eu levantei o
  conflito (precisaria de lat/long, e geolocalização foi cortada do escopo
  lá na Fase 0); fica pendente pra quando/se geolocalização entrar no
  escopo. Aba Ônibus: histórico completo de abastecimentos no detalhe do
  veículo (data, KM, litros, valor, motorista). Aba Motorista: card de
  estatísticas (abastecimentos no mês corrente, km/L médio, nº de alertas
  críticos — via count em `alertas` filtrando pelos `entidade_id` dos
  abastecimentos do motorista) + tabela de últimos registros. Novo
  `lib/formatacao.ts` (formatarMoeda, formatarDataBr) compartilhado entre
  dashboard e as duas abas. **Validado no navegador com dados reais**:
  cadastrei o primeiro motorista de verdade do projeto (Marcos Vieira) e
  fiz um abastecimento escolhendo-o da lista no wizard (nunca tinha
  testado esse caminho — sempre usei nome livre nas fases anteriores);
  conferi o dashboard (cards e os 5 gráficos populados corretamente com os
  dados acumulados das fases anteriores), o histórico no detalhe do
  veículo (motorista aparecendo certo tanto por nome livre quanto
  vinculado) e as estatísticas do motorista (1 abastecimento no mês, 8.17
  km/L — bate com 490 km rodados / 60 L —, 0 alertas críticos).
- 🔄 **Fase 8 — Validação em produção e prontidão pra piloto (escopo
  redefinido pelo usuário: a integração com o LuckFrotas foi REMOVIDA do
  plano original — o LuckTank opera sozinho, o bloqueio de KM usa só o
  histórico do próprio LuckTank).** Em andamento — ver seção própria mais
  abaixo.

## Hardening pré-piloto (pós-auditoria, antes da Fase 8)

Depois da Fase 7, foi feita uma auditoria geral do sistema (ver histórico da
conversa). Os itens 🔴 críticos estão sendo corrigidos em blocos, um de cada
vez, antes de avançar pra Fase 8.

- ✅ **Bloco 1 — Git.** O projeto inteiro (Fases 1-7) estava sem nenhum
  commit real (só o scaffold do `create-next-app`) e sem remoto — risco de
  perda total. `.gitignore` conferido (`.env*.local`, `node_modules`, `.next`
  já cobertos, nada precisou ser adicionado). Commit único criado
  (`2f79f9f`) com todo o histórico das 7 fases, sem nenhum segredo (só
  `.env.example` vazio entrou no stage). Repositório privado criado no
  GitHub (`lucktank`) e push confirmado pelo usuário.
- ✅ **Bloco 2 — Buraco de auditoria em `abastecimentos`.** As policies
  `abastecimentos_update` (supervisor+) e `abastecimentos_delete`
  (gerente+), criadas na 0001, liberavam UPDATE/DELETE direto pelo client
  autenticado do escritório (anon key + sessão) — o mesmo client usado em
  qualquer Client Component. Nenhuma tela/rota do app edita ou apaga
  abastecimento (confirmado por busca no código: o único caminho de escrita
  é o INSERT em `app/api/abastecimentos/route.ts`, via service role). Ou
  seja, essas policies eram só superfície de fraude interna sem rastro — um
  supervisor logado podia abrir o console do navegador e alterar/apagar um
  abastecimento sem passar por `edicoes_log` (que só é escrito por código de
  servidor, nunca por trigger de banco), quebrando o invariante #4 bem no
  coração do produto anti-fraude. Migration `0006_abastecimentos_rls_hardening.sql`
  removeu as duas policies (`abastecimentos_select` continua valendo,
  isolada por empresa; não há e nunca houve policy de INSERT pra client
  autenticado). **Validado contra o projeto real**: logado como
  `supervisor.teste@lucktank.test` (papel `supervisor`) via anon key,
  tentativas de `.update()` e `.delete()` num abastecimento real da empresa
  retornaram 0 linhas afetadas (RLS filtra silenciosamente, sem erro
  explícito — comportamento padrão do Postgres/PostgREST pra policy que
  nega); conferido via service role que o registro (`litros: 250`,
  `status: 'ativo'`) continuou idêntico depois das tentativas. **Se um dia
  for necessário editar/excluir abastecimento pela UI**, isso deve entrar
  como Server Action dedicada (mesmo padrão de `onibus/actions.ts` e
  `motoristas/actions.ts`): validar papel via `getUsuarioAtual()` e chamar
  `registrarLog()` antes de mutar — nunca reabrir a policy de RLS pra isso.
- ✅ **Bloco 3 — Proteção dos endpoints públicos e das fotos.**
  `lib/rate-limit.ts`: rate limit por IP via Upstash (`@upstash/ratelimit` +
  `@upstash/redis`, sliding window) — não deu pra usar contador em memória
  porque a Vercel roda funções serverless que não compartilham estado entre
  invocações (cada request pode cair numa instância nova). Se
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` não estiverem
  configuradas (dev local sem conta), os limitadores ficam `null` e a
  checagem sempre libera — **sem rate limit, não sem servidor**; precisa
  configurar antes do piloto valer em produção (passo a passo dado ao
  usuário separadamente). `/api/ocr`: 10 requisições/min por IP; `/api/abastecimentos`:
  20/min por IP. `/api/ocr` **agora exige `qr_token` válido** (antes rodava
  pra qualquer chamada anônima, sem amarrar a nenhum veículo — dava pra
  esgotar a cota gratuita do Gemini, ~1.500 leituras/dia, sem credencial
  nenhuma). Novo `lib/validacao/arquivo.ts`: valida tamanho (teto de 8MB) e
  assinatura real do arquivo (bytes mágicos de JPEG/PNG/WEBP/HEIC — nunca
  confia no `accept` do client nem no `file.type` autodeclarado), usado nos
  dois endpoints que recebem foto. Compressão de imagem padronizada: o
  caminho online agora chama `comprimirImagem()` (mesma função de
  `lib/offline/comprimir-imagem.ts`) antes de subir a foto — antes só o
  caminho offline comprimia. **Validado com testes reais**: `/api/ocr` sem
  `qr_token` barrado (400 "QR inválido"); arquivo com assinatura inválida
  barrado (400 "Arquivo não é uma imagem válida"); foto de 9,4MB barrada nos
  dois endpoints (400 "Foto muito grande"); fluxo completo no navegador
  (wizard real, veículo `EXM1A23`, motorista Marcos Vieira) com uma foto de
  1,53MB (1920x1200) enviada — conferido no Storage real que o arquivo
  gravado ficou com **71,8 KB** (compressão confirmada). Dado de teste
  (abastecimento, mídia, alerta) removido depois e `km_atual` do veículo
  restaurado para `160000`.
- ✅ **Bloco 4 — Porta de entrada limpa.** `app/page.tsx` (raiz) era a tela de
  debug da Fase 1 ("fundação rodando", showcase de design system, botão
  "Testar câmera") servida publicamente pra qualquer visitante, inclusive em
  produção. Virou um `redirect("/login")` puro. Os dois componentes que só
  existiam pra essa tela (`components/motorista/camera-teste.tsx`,
  `components/status/pwa-status.tsx`) foram **removidos** (não só
  desconectados — nada mais os usava). `middleware.ts`: tirou `/api/sync` e
  `/api/luckfrotas` da lista `PUBLICAS` (rotas que ainda não existem no
  projeto — eram referência morta, confundiam a leitura). **Título da aba
  conferido**: já estava correto ("LuckTank") em `app/layout.tsx` e
  `app/(escritorio)/layout.tsx` — o "k" a mais citado no plano não foi
  encontrado no código; nada foi alterado aí. **Validado**: build mostra a
  rota `/` caindo de 1.43kB/97.3kB para **138B/87.5kB** de First Load JS
  (prova que o showcase saiu do bundle); `curl` confirma `307` com
  `Location: /login`; testado no navegador real (nova aba, sem cache) —
  redireciona certinho pra tela de login limpa. Durante esse teste local
  descobri (e limpei) um Service Worker de **outro projeto do usuário (o
  LuckFrotas real)** ainda registrado pra `http://localhost:3000` no
  Chrome, mascarando o resultado com uma versão em cache daquele outro app —
  artefato do navegador local, não afeta produção (Vercel é outra origem) e
  não é bug deste projeto.
- ✅ **Bloco 5 — Rede de segurança no motor de validação (Vitest).**
  `lib/validacao/regras.ts` codifica os limiares de fraude e não tinha
  nenhum teste — qualquer alteração acidental passava silenciosa. Adicionado
  Vitest (`npm test` roda `vitest run`). Extraído o bloqueio de KM (invariante
  #6) de `app/api/abastecimentos/route.ts` pra uma função pura nova,
  `kmMenorQueUltimoRegistrado(kmAtual, kmUltimoRegistrado)`, exportada de
  `regras.ts` — mesmo comportamento de antes (comparação inline), só que
  agora testável isoladamente; a rota chama essa função em vez de comparar
  na mão. `lib/validacao/regras.test.ts` (21 testes): cada uma das 5 regras
  de alerta (capacidade do tanque, nota duplicada, foto duplicada, consumo
  fora da faixa, litros desproporcionais) com caso positivo, caso negativo e
  limite exato do limiar (25% de desvio, 1 km/L, litros = capacidade);
  combinação de duas regras disparando juntas pro mesmo evento (350L +
  consumo de 33 km/L, espelhando o cenário real testado na Fase 6); e os 4
  casos do bloqueio de KM (menor bloqueia, igual/maior não bloqueia,
  primeiro registro do veículo — sem km anterior — nunca bloqueia).
  **Validado que os testes realmente travam comportamento, não só
  decoram**: mudei `TOLERANCIA_DESVIO_CONSUMO` de `0.25` pra `0.5` de
  propósito, rodei `npm test` e vi 1 teste quebrar exatamente como
  esperado; revertido o valor e os 21 voltaram a passar.

## Fase 8 — Validação em produção e prontidão pra piloto

Escopo redefinido pelo usuário: **sem integração com o LuckFrotas** — o
LuckTank roda sozinho, KM e bloqueio de KM usam só o histórico do próprio
LuckTank. A coluna `luckfrotas_veiculo_id` (criada na `0001_init.sql` como
"ponto de integração futura") continua no schema, inerte — nenhuma tela ou
rota lê/escreve nela; não foi removida porque dropar coluna é uma mudança de
schema desnecessária pra algo que já não faz mal nenhum sentado ali.

- ✅ **Bloco 1 — Sincronização e sanidade do deploy.**
  - `origin/main` e o local estavam em sincronia (`043a300`) antes de
    começar; nada pendente.
  - **Variáveis de ambiente exigidas** (conferidas por leitura de código,
    cada `process.env.X` batendo com o `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
    `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
    Seis no total, nenhum nome divergente.
  - **Rate limit confirmado ativo em produção**: rajada de 14 requisições
    sem `qr_token` contra `/api/ocr` em `luck-tank.vercel.app` — as 10
    primeiras processaram normal, a partir da 11ª voltou `429` (limite de
    10/min configurado em `lib/rate-limit.ts` funcionando de verdade, não só
    em dev). Método seguro: `qr_token` ausente é barrado antes de qualquer
    chamada ao Gemini ou escrita no banco, então o teste não custou nada nem
    gravou nada.
  - **Achado durante o teste (não esperado pelo roteiro original)**: a
    raiz de produção parecia ainda servir a tela de debug da Fase 1, mesmo
    depois do deploy do Bloco 4. Investigado: **não era o deploy** (`curl`
    direto já mostrava o redirect novo) — era o **Service Worker do próprio
    LuckTank** (`public/sw.js`) fazendo cache-first pra `/` desde a Fase 1,
    com o nome do cache (`lucktank-v1`) nunca tendo mudado entre deploys, o
    que significa que qualquer navegador que já tivesse visitado o site
    antes de hoje ficaria preso na versão antiga pra sempre. Corrigido:
    navegação (documento HTML) agora é **network-first** com fallback pro
    cache só se estiver offline de verdade; assets com hash de build
    continuam cache-first (seguro). Cache renomeado pra `lucktank-v2` pra
    forçar a invalidação imediata em quem já tinha o SW instalado.
  - **Segundo achado lateral**: `request.formData()` em `/api/ocr` e
    `/api/abastecimentos` lançava exceção não tratada pra qualquer POST sem
    `Content-Type: multipart/form-data` (ex: corpo vazio), virando um `500`
    em vez de um `400` limpo — confirmado tanto em produção (durante o
    teste de rajada) quanto localmente, com stack trace apontando pro
    parsing do body. Corrigido com try/catch nos dois endpoints, devolvendo
    `400 "Requisição inválida."`. Não é falha de segurança (nada é gravado
    nesse caminho), só uma resposta de erro errada.
  - **Resquícios do LuckFrotas removidos**: `README.md` (lista de fases
    desatualizada, ainda citava "Integração LuckFrotas (mock)" na Fase 8) e
    o status da Fase 8 aqui no `PROJETO.md`. `middleware.ts` já estava limpo
    desde o Bloco 4 do hardening (sem `/api/sync`/`/api/luckfrotas`). A
    coluna `luckfrotas_veiculo_id` no banco foi mantida (ver nota acima).
  - `tsc`, `lint`, `test` (21 testes) e `build` confirmados limpos depois
    de todas as mudanças.
- ✅ **Bloco 2 — Identidade visual profissional + acabamento.**
  Redesign completo da camada visual (nada de lógica/rota/schema tocado),
  usando a paleta da Expresso Mundial (navy + ciano), referência de design
  lida direto do LuckFrota (`C:\Users\User\Desktop\luckfrota`, tailwind
  config + `index.css` + `Sidebar.jsx` + `Login.jsx`) pra manter os dois
  produtos como "família visual" — mesma paleta exata (`#0A1628`/`#050B14`/
  `#1a2638` navy, `#00D4FF`/`#33DDFF`/`#00A8CC` ciano) e mesma dupla
  tipográfica (Space Grotesk + Plus Jakarta Sans).

  **Regra de design por contexto (documentada aqui pra nunca se perder)**:
  o produto tem dois públicos opostos, então NÃO leva o mesmo tema visual.
  - **Fluxo do motorista** (`/r/[qrToken]`): tema claro, alto contraste,
    fundo `neutral-50`, botões de 48px+. Navy/ciano só entram como acento
    (cabeçalho compacto em gradiente navy no topo da tela, botão primário
    navy sólido, foco em ciano) — **nunca fundo escuro dominante**.
    Legibilidade ao sol é prioridade absoluta, não se sacrifica por
    estética.
  - **Escritório** (área autenticada): navy dominante de propósito —
    sidebar `navy-900` sobre fundo `navy-950`, cards `variant="dark"`
    (`bg-navy-900 border-navy-800`), ciano nos destaques (item de menu
    ativo, foco, links, badges). Visual mais "tecnológico", legível em
    desktop/tablet.

  **Tokens novos em `tailwind.config.ts`**: `primary`/`navy` (mesma escala,
  nomes diferentes — `primary` é o alias que os componentes de UI já
  usavam, `navy` é usado explicitamente no chrome escuro do escritório para
  deixar a intenção clara na classe), `cyan` (acento), `info`/`atencao`/
  `critico`/`sucesso` (semânticas — nomes batem 1:1 com `NivelAlerta` de
  `lib/validacao/regras.ts`). **Decisão de contraste**: o botão primário usa
  navy sólido + texto branco, não ciano sólido — testei o contraste de
  branco sobre `#00D4FF`/`#00A8CC` (~2.8:1) e não passa nem no limiar mais
  frouxo do WCAG (3:1 pra componente de UI); navy dá ~19:1. Ciano fica
  reservado pra foco, links, estado ativo, badges e acentos de gráfico —
  nunca preenchimento de texto.

  **Componentes de UI (`components/ui`)**: `Button` ganhou variante `ghost`
  e prop `loading` (spinner + `aria-busy`); `secondary` corrigido (tinha
  contraste fraco: `neutral-100`/`900` → `neutral-200` + borda + texto
  `900`, mais reconhecível como botão). `Card`/`CardTitle` ganharam prop
  `variant="light"|"dark"` — antes cada página do escritório repetia
  `className="bg-slate-900 text-slate-100"` na mão, e o `CardTitle` sempre
  saía com `text-neutral-900` (quase preto) hardcoded: como texto e fundo
  eram praticamente a mesma cor escura, **os títulos dos cards no
  escritório estavam ilegíveis antes deste bloco** — bug real, não só
  estética. Também achei (mesmo motivo) empty-states em `onibus/page.tsx`
  e `motoristas/page.tsx` usando `<Card>` sem override nenhum, ou seja,
  cards *claros* perdidos no meio de telas escuras — inconsistência visual
  real entre abas. `Input` trocou o foco de `primary` pra `cyan` (regra do
  ciano-é-foco).

  **Escritório**: sidebar reconstruída (`app/(escritorio)/layout.tsx` +
  novo `components/escritorio/sidebar-nav.tsx`, Client Component — precisa
  de `usePathname()` pra saber qual item destacar, isso não dava pra fazer
  no Server Component original) com logo/badge da marca, item ativo em
  ciano, badge de alertas pendentes em `critico-500`. Todas as páginas
  (`dashboard`, `onibus`, `onibus/[id]`, `onibus/novo`, `motoristas`,
  `motoristas/[id]`, `motoristas/novo`, `configuracoes`, `alertas`)
  migradas de `bg-slate-900`/`border-slate-800` cru pra `Card
  variant="dark"` + tokens `navy-*`. `GraficoBarra`: paleta de cores dos 5
  gráficos do dashboard alinhada à marca (ciano, azul, âmbar, verde, ciano
  claro) em vez de cores soltas sem critério. `lista-alertas.tsx`: badge de
  nível usa `info`/`atencao`/`critico` diretamente; **crítico ganhou borda
  lateral vermelha sólida + fundo levemente tingido** (`border-l-4
  border-l-critico-500 bg-critico-500/5`) pra realmente saltar aos olhos —
  antes os 3 níveis só diferiam pela cor do badge, todos do mesmo jeito
  visualmente "quietos".

  **Login** (`components/escritorio/login-form.tsx`): reconstruído como
  painel dividido — esquerda com gradiente navy + blobs em ciano, logo,
  headline (só em telas largas), direita com o formulário num card claro.
  Inspirado no `Login.jsx` do LuckFrota mas sem o conteúdo de marketing
  (depoimentos rotativos, prova social) — não faz sentido pro contexto do
  LuckTank, que não tem usuários externos se cadastrando sozinhos.

  **Fluxo do motorista**: cabeçalho ganhou uma barra compacta em gradiente
  navy com o badge da marca (mantém o resto da tela clara — regra de
  design por contexto); novo indicador de progresso (`PassosProgresso` em
  `fluxo-abastecimento.tsx`) mostrando Nome → Foto → Dados, contando
  "processando" como parte visual do passo Foto (é uma etapa transitória,
  não uma decisão do motorista). `PassoFoto` ganhou ícone na área de
  captura; `PassoProcessando` ganhou spinner com acento ciano + texto de
  apoio. Avisos/erros do wizard (`passo-formulario.tsx`, `passo-foto.tsx`)
  migrados de `amber-*`/`red-*` soltos pros tokens semânticos
  `atencao`/`critico`.

  **Acabamento**: `<title>` conferido de novo — já estava correto
  ("LuckTank"), nada pra mudar (o "k" a mais citado no plano não existe no
  código, confirmado também no Bloco 4 do hardening anterior). Nenhum
  componente de debug da Fase 1 no bundle (removidos naquele bloco).
  `app/manifest.ts`: `theme_color` trocado pra navy (`#0a1628`);
  `background_color` mantido claro (`#f8fafc`) de propósito — quem instala
  o PWA é o motorista, e a primeira tela dele é clara, não faria sentido
  uma splash escura. `public/icons/icon.svg` recolorido com gradiente
  navy→ciano. Fontes locais Geist (nunca de fato aplicadas — `globals.css`
  tinha `font-family: Arial` sobrescrevendo tudo, um resíduo do scaffold
  que nunca foi ligado) removidas e substituídas por Space Grotesk/Plus
  Jakarta Sans via `next/font/google`.

  **Validado**: `tsc`, `lint`, `test` (21) e `build` limpos depois de cada
  etapa. Testado visualmente no navegador (login, dashboard, alertas,
  wizard do motorista até o passo Foto) — confirmado: crítico salta aos
  olhos no painel de alertas (borda + fundo vermelho vs. atenção em âmbar
  discreto), sidebar com item ativo em ciano, progresso do wizard avançando
  visualmente entre passos, foco em ciano nos campos de login.
- ✅ **Bloco 3 — Roteiro de teste de fumaça em produção entregue.** Executado
  pelo usuário (não por mim) em `luck-tank.vercel.app`, com dados reais da
  Expresso Mundial — ver checklist completo na seção "Roteiro de teste de
  fumaça em produção" logo abaixo.
- ✅ **Bloco 4 — CI no GitHub Actions.** `.github/workflows/ci.yml` roda a
  cada push/PR pra `main`: `npm ci` → `tsc --noEmit` → `lint` → `test`
  (Vitest, 21 testes) → `build`. Usa env vars placeholder (documentadas
  inline no workflow) só pro build/lint/test — **confirmado localmente**
  rodando `next build` com o `.env.local` temporariamente removido (mesma
  condição do CI): passa limpo, porque nenhuma página estática chama
  Supabase/Gemini de verdade durante o `next build` (as páginas que
  precisam de dado real são todas `ƒ` dinâmicas, só rodam sob demanda em
  produção). Não tenho acesso credenciado ao GitHub Actions desta sessão
  (sem `gh` autenticado) pra confirmar o run verde direto — o usuário
  confirma na aba Actions do repositório.

## Roteiro de teste de fumaça em produção

> Executado manualmente pelo dono do produto em `luck-tank.vercel.app`, com
> dados reais da Expresso Mundial — não pelo agente. Serve como o "sinal
> verde" final antes do piloto valer pra motoristas de verdade. Cada passo
> tem o resultado ESPERADO ao lado; qualquer divergência é bug a reportar
> antes de liberar o piloto.

### 1. Login como administrador
1. Acesse `https://luck-tank.vercel.app/`.
   **Esperado:** redireciona sozinho pra `/login` (painel navy à esquerda
   em telas largas, formulário claro à direita).
2. Entre com o e-mail/senha do administrador real.
   **Esperado:** redireciona pra `/dashboard`; sidebar navy aparece com
   Dashboard/Ônibus/Motoristas/Alertas/Configurações.

### 2. Cadastrar veículo real
1. Ônibus → **Novo veículo** (só aparece pra papel administrador).
2. Preencha placa, modelo, marca, ano, **capacidade do tanque em litros**
   (importante — é o gatilho do alerta crítico do passo 6b) e **tipo de
   combustível**.
   **Esperado:** salva, volta pra `/onibus`, o veículo aparece na lista com
   badge verde "Ativo".
3. Entre no veículo cadastrado, confira o card "QR do veículo": baixe o SVG
   e o PNG, abra "Ver etiqueta para impressão".
   **Esperado:** QR baixa nos dois formatos; a etiqueta mostra o QR + placa
   + modelo/ano, pronta pra imprimir e colar no ônibus.

### 3. Cadastrar motorista real
1. Motoristas → **Novo motorista** (gerente ou administrador).
2. Preencha nome (CPF é opcional).
   **Esperado:** salva, volta pra `/motoristas`, aparece na lista com badge
   "Ativo".

### 4. Fluxo completo no celular (via QR)
1. No celular, escaneie o QR impresso (ou abra a URL `/r/<qr_token>` direto).
   **Esperado:** tela clara, cabeçalho navy compacto com o nome da empresa e
   a placa, indicador de progresso mostrando "Nome" em destaque.
2. Selecione o motorista cadastrado no passo 3 (ou "Meu nome não está na
   lista" pra testar nome livre) → Continuar.
3. Tire uma foto real e legível de um comprovante/cupom de abastecimento.
   **Esperado:** tela "Lendo o comprovante..." aparece por alguns segundos,
   depois o formulário some pré-preenchido com o que o Gemini leu, com o
   aviso "Conferimos os dados automaticamente — revise antes de confirmar."
4. Confira/corrija os campos preenchidos automaticamente, preencha o **KM
   atual do veículo** (obrigatório, não vem da foto) e confirme.
   **Esperado:** tela de sucesso "Abastecimento registrado! Obrigado. Os
   dados já foram enviados para o escritório."

### 5. Confirmar no dashboard
1. Volte pro escritório (ou atualize a página), abra o **Dashboard**.
   **Esperado:** os cards de resumo do dia (litros, valor gasto, nº de
   abastecimentos, preço médio) refletem o registro novo; os gráficos têm
   um ponto/barra a mais.
2. Ônibus → o veículo cadastrado → confira "Histórico de abastecimentos".
   **Esperado:** a linha nova aparece com data, KM, litros, valor e o nome
   do motorista corretos.
3. Confira a conta na mão: km rodado = KM informado − KM anterior do
   veículo; consumo (km/L) = km rodado ÷ litros.
   **Esperado:** os números batem com a conta manual (o banco calcula isso
   automaticamente via coluna gerada, não deveria divergir nunca).

### 6. Provocar cada alerta de propósito
Repita o fluxo do passo 4 pra cada cenário abaixo, um de cada vez:

**a) KM menor que o último registrado — deve BLOQUEAR de verdade**
1. Preencha um KM **menor** que o último registrado do veículo.
   **Esperado:** o formulário já impede confirmar (mensagem "KM não pode
   ser menor que X" aparece embaixo do campo); se forçar o envio mesmo
   assim, o servidor rejeita (nada é salvo, nenhum abastecimento novo
   aparece no histórico).

**b) Litros acima da capacidade do tanque — crítico, mas NÃO bloqueia**
1. Registre um abastecimento com litros maiores que a capacidade do tanque
   cadastrada no passo 2.
   **Esperado:** o registro é aceito normalmente (motorista vê sucesso);
   em `/alertas`, aparece um alerta **Crítico** "Litros acima da capacidade
   do tanque" com a borda vermelha lateral bem visível.

**c) Nota fiscal duplicada — crítico**
1. Registre um abastecimento usando o **mesmo número de nota fiscal** de um
   abastecimento anterior do mesmo veículo.
   **Esperado:** registro aceito + alerta crítico "Nota fiscal duplicada"
   em `/alertas`.

**d) Foto duplicada — crítico**
1. Registre outro abastecimento reenviando a **mesma foto** (mesmo arquivo)
   de um comprovante já usado nesse veículo.
   **Esperado:** registro aceito + alerta crítico "Foto do comprovante
   duplicada" em `/alertas`.

2. Em `/alertas`, confira visualmente: os críticos saltam aos olhos (fundo
   levemente vermelho + borda sólida), diferente de eventuais alertas de
   atenção (âmbar, mais discretos). Clique em "Resolver" num deles.
   **Esperado:** ele sai da lista de pendentes, a contagem no menu lateral
   cai, e ele passa a aparecer em "Resolvidos".

### 7. Caminho offline
1. No celular, abra a página do QR **antes** de cortar a conexão.
2. Ative modo avião (ou desligue wifi/dados).
3. Preencha o fluxo normalmente (nome, foto — o app pula o OCR direto pro
   formulário manual porque está offline —, dados, KM) e confirme.
   **Esperado:** tela de sucesso muda a mensagem pra "Você está sem
   internet — salvamos no aparelho e vamos enviar assim que a conexão
   voltar."
4. Reative a internet (sem precisar reabrir a página).
   **Esperado:** em pouco tempo o registro sincroniza sozinho e aparece no
   histórico do veículo/dashboard, sem precisar repetir nada manualmente.

### 8. Testar permissões (papel supervisor)
1. Convide um usuário com papel **supervisor** em Configurações (só
   administrador convida) — ou, se preferir não gastar um convite real
   agora, use a conta de teste já existente `supervisor.teste@lucktank.test`
   (criada durante o hardening da Fase 8 Bloco 2, papel supervisor).
2. Logado como esse supervisor, tente:
   - Cadastrar um veículo novo (Ônibus → Novo veículo).
     **Esperado:** o botão "Novo veículo" nem aparece pro supervisor (só
     administrador vê); se acessar `/onibus/novo` direto pela URL, a
     página mostra "Só administradores podem cadastrar veículos."
   - Cadastrar um motorista novo (Motoristas → Novo motorista).
     **Esperado:** mesma coisa — bloqueado, mensagem "Só gerente ou
     administrador podem cadastrar motoristas."
   - Ver o Dashboard, Ônibus, Motoristas e Alertas (leitura), e **Resolver**
     um alerta.
     **Esperado:** tudo isso funciona normalmente — supervisor só é
     restrito em cadastro/edição, não em leitura nem em resolver alertas.

---

Ao terminar os 8 passos, qualquer resultado diferente do "Esperado" é bug —
reportar antes de considerar o piloto liberado pra motoristas reais.

## Validação automatizada dos cenários de fraude/negócio (pós-Fase 8)

Depois do roteiro de fumaça manual, os cenários que NÃO dependem de hardware
físico (câmera, celular, modo avião) foram automatizados num script Node
único (`fetch` contra `/api/abastecimentos` + `@supabase/supabase-js` com
service role pra setup/verificação/limpeza), rodado contra o Supabase real
do projeto (mesmo banco de produção) via servidor de desenvolvimento local
— não contra `luck-tank.vercel.app` direto, pra não gastar o rate limit de
produção nem misturar tráfego de teste com telemetria real. Um veículo de
teste dedicado (placa `TST...`, isolado do `EXM1A23` real) foi criado,
usado, e **removido por completo ao final** (idem alertas, mídias e
arquivos de Storage gerados) — verificado depois com queries
independentes que não sobrou nada.

**9/9 cenários passaram**: bloqueio de KM (bloqueia mesmo, 409, não grava),
litros acima da capacidade (crítico), nota fiscal duplicada (crítico), foto
duplicada — mesmo hash SHA-256 (crítico), consumo fora da faixa histórica
(atenção), litros desproporcionais ao KM rodado (dispara junto com o
anterior, como já era esperado desde a Fase 6), idempotência por
`registro_uuid` (reenvio retorna o mesmo id, não duplica linha), permissão
do papel supervisor (bloqueado por RLS em `veiculos`/`motoristas`, mas
resolve alerta normalmente), e os cálculos derivados (`km_rodado`,
`consumo_kml`, R$/litro) batendo com a conta manual.

**Não coberto por automação (decisão deliberada, continua manual)**: OCR
com foto real de comprovante, captura de câmera, e o caminho offline (modo
avião → reconectar → sincronizar sozinho) — a fila offline roda inteira no
IndexedDB do navegador, não dá pra exercitar de um script Node sem simular
o browser inteiro.

## Relatório de consumo por veículo (dashboard do escritório)

Substituição da planilha manual do cliente (uma linha por abastecimento
com KM rodado/consumo/valor por litro calculados à mão) pela aba do
veículo no escritório. **Sem mudança de schema nem de regra de cálculo** —
`km_rodado` e `consumo_kml` já existem como generated columns desde a Fase
1; isto é só exibição + agregação em cima do que já existe.

- `lib/onibus/estatisticas.ts`: função pura `calcularEstatisticasVeiculo`
  (mesmo padrão de `lib/validacao/regras.ts`/`lib/dashboard/agregacoes.ts`)
  — recebe o histórico bruto (todo ele, sem `limit`) e devolve as 3 médias:
  - **Consumo médio (km/L)** = soma dos km rodados ÷ soma dos litros — dos
    registros com km_rodado válido. Soma/soma, não média das médias (mais
    fiel quando os abastecimentos têm tamanhos de "viagem" bem diferentes
    entre si — testado explicitamente com um caso onde as duas contas dão
    números diferentes).
  - **Custo médio por km (R$/km)** = soma dos valores totais ÷ soma dos km
    rodados — mesma regra de "só registros válidos" nos dois lados da
    conta.
  - **Gasto médio por abastecimento (R$)** = soma dos valores totais ÷
    número de abastecimentos — este SIM conta todos os registros, inclusive
    os sem km rodado válido.
  - **Regra crítica isolada explicitamente no código**: registro sem
    `km_rodado` válido (nulo — 1º abastecimento do veículo, sem KM
    anterior pra comparar — ou zero) entra no gasto médio, mas nunca no
    consumo médio nem no custo por km; misturar os dois distorceria as
    duas médias (dinheiro sem km correspondente pra atribuir).
  - `lib/onibus/estatisticas.test.ts`: 5 testes (lista vazia, soma/soma
    vs. média das médias, registro sem km válido excluído do km/L mas
    incluído no gasto médio, km_rodado=0 tratado como inválido, e o caso
    de só existir registro inválido).
- `app/(escritorio)/onibus/[id]/page.tsx`: duas queries separadas —
  histórico completo (sem `limit`, só as 4 colunas que a agregação usa) pra
  alimentar as estatísticas sobre TODO o histórico, e a query já existente
  (`limit(50)`, mais colunas) pra exibir a tabela. Cards de resumo (mesmo
  estilo dos cards do dashboard) mostram as 3 médias + período coberto +
  quantidade de registros que embasam cada uma (ex.: "média sobre 12
  registro(s) válido(s)"), com nota explícita de quantos registros ficaram
  de fora do km/L e do custo por km. Tabela ganhou as colunas **KM
  rodado**, **R$/litro** (calculado na hora, não armazenado) e **Consumo
  (km/L)**; "—" (não "0") quando `km_rodado`/`consumo_kml` são nulos.
  Linhas com alerta crítico/atenção ganham fundo tingido + borda lateral
  colorida + badge (mesmas cores semânticas do painel de alertas —
  reaproveitadas, não redefinidas).
- **Validado com dado real** (histórico acumulado do `EXM1A23` ao longo de
  todas as fases anteriores, 13 abastecimentos): consumo médio 7.69 km/L,
  custo médio R$0,77/km, gasto médio R$706,55 — **conferido à mão** somando
  os 12 registros com km_rodado válido (10.000 km / 1.301 L = 7,69 km/L;
  R$7.735,15 / 10.000 km = R$0,77) e os 13 no total (R$9.185,15 / 13 =
  R$706,55) — bate exato com o que o card mostra. O 13º registro (primeiro
  abastecimento já feito nesse veículo, sem KM anterior) aparece como "—"
  na tabela e é excluído das duas primeiras médias, mas conta no gasto
  médio, exatamente como especificado. Testado também um veículo novo
  (0 abastecimentos): estado vazio "Sem dados suficientes ainda.", sem
  erro/NaN — removido depois do teste, sem deixar lixo no banco.
- `tsc`, `lint`, `test` (26 testes) e `build` confirmados limpos.

## Melhorias de uso: filtros, galeria, foto no histórico e export

Pedido do usuário pós-Fase 8, em 4 blocos independentes de schema (só camada
de UI, queries de leitura e geração de arquivo) — implementados um de cada
vez, com validação própria.

- ✅ **Bloco 1 — Filtros (data + veículo + motorista) no dashboard e na aba
  do ônibus.** `lib/filtros/periodo.ts` (função pura `calcularPeriodo`, 4
  atalhos: hoje/7dias/esteMes/mesPassado, sempre em UTC pra não misturar
  fuso — mesmo padrão de `lib/validacao/regras.ts`), testado com 7 casos
  incluindo virada de mês/ano e ano bissexto. `lib/filtros/abastecimentos.ts`:
  `parseFiltrosAbastecimento` (lê `de`/`ate`/`veiculo_id`/`motorista_id`/
  `motorista_nome` da URL, nunca lança — formato inválido vira "ausente", já
  que a URL é editável à mão), `resolverPeriodo` (sem `de`/`ate` na URL, o
  período padrão é **"este mês"** — decisão de produto: sem isso, a página
  abriria sempre sem recorte nenhum) e `aplicarFiltrosQuery` (encadeia
  `.gte/.lte/.eq` de forma condicional, compartilhado entre dashboard, aba do
  ônibus e o export do Bloco 4 — os três precisam ler o filtro exatamente do
  mesmo jeito). `lib/filtros/opcoes.ts`: busca veículos/motoristas/nomes
  livres da empresa inteira (nunca só o que aparece no período já filtrado,
  senão o próprio seletor ficaria preso ao resultado que ele mesmo ainda vai
  produzir).

  **UI**: `components/escritorio/select-busca.tsx` (combobox mínimo,
  hand-rolled — mesma filosofia de Button/Card/Input, sem lib externa) e
  `components/escritorio/filtros-abastecimento.tsx` (Client Component único,
  reaproveitado nos dois lugares — no dashboard recebe a lista de veículos e
  mostra o seletor; na aba do ônibus não recebe `veiculos`, então o seletor
  nem aparece, porque o veículo já é fixo pela rota). Escreve só na URL
  (`router.push` com `URLSearchParams`) — quem filtra de verdade é o Server
  Component da página, então a filtragem em si é 100% no servidor, nunca no
  client. Motorista cadastrado e nome livre coexistem no mesmo seletor
  (`id:<uuid>` vs `livre:<nome>` como valor interno), com "(não cadastrado)"
  no rótulo dos nomes livres.

  **Mudança de comportamento nas duas páginas** (decisão registrada aqui pra
  não se perder): os cards de resumo do dashboard, que antes eram fixos em
  "hoje" (independente de qualquer filtro), agora refletem o período
  filtrado ("Litros no período", "Valor gasto no período", etc.) — manter um
  card não-filtrável ao lado de gráficos filtráveis seria inconsistente. Na
  aba do ônibus, as 3 médias do "Relatório de consumo por veículo" (Fase
  pós-8), que antes eram sempre sobre **todo o histórico**, agora são sobre o
  **período filtrado** (rótulo mudou pra deixar isso explícito) — pedido
  explícito do usuário neste bloco. Como o padrão sem filtro é "este mês", um
  veículo com histórico só do mês corrente não muda de número nenhum (foi o
  caso validado abaixo); histórico mais antigo precisa expandir o período
  (atalho "Mês passado" ou datas manuais) pra aparecer nas médias.

  Estado vazio unificado: "Nenhum abastecimento no período/filtro
  selecionado." em todo card/gráfico/tabela que zera, substituindo o antigo
  "Sem dados suficientes ainda." (que não distinguia "não há dado nenhum" de
  "o filtro não bateu com nada").

  **Validado com 44 testes automatizados** (18 novos: 7 de `periodo.ts`,
  11 de `abastecimentos.ts` incluindo um query builder falso pra confirmar a
  cadeia `gte→lte→eq` sem precisar de banco) e **contra o Supabase real do
  projeto, no navegador**, logado como o administrador real da Expresso
  Mundial: filtro combinado veículo (`EXM1A23`) + motorista nome livre
  (`Roberto Alves`) no dashboard retornou exatamente 1 abastecimento
  (150L/R$900/R$6,00 por litro — bate com o banco), URL refletiu
  `?veiculo_id=...&motorista_nome=Roberto+Alves`, e recarregar a URL do zero
  restaurou o mesmo estado (confirma que é compartilhável); atalho "Mês
  passado" (sem abastecimento nenhum no período) mostrou o estado vazio em
  todos os 5 gráficos; "Limpar filtros" voltou ao padrão "este mês" com os
  13 registros. Na aba do ônibus, filtro por motorista cadastrado (Marcos
  Vieira, via `motorista_id`) isolou 1 registro e recalculou as médias
  corretamente (8.17 km/L, R$0,76/km, R$372,00 — bate com o registro
  individual). `tsc`, `lint`, `test` (44) e `build` confirmados limpos.

  **Achado lateral, não relacionado a este bloco** (registrado aqui pra não
  se perder, nenhuma ação tomada): o veículo real `EXM1A23` ainda tem, em
  produção, vários abastecimentos com nomes claramente de teste ("Teste
  Capacidade", "Teste Nota Duplicada", "Teste Foto A/B", "Teste Consumo
  Alto", "Teste Desproporcional", "Teste Queda Rede", "Teste Origem") —
  parecem sobras da validação da Fase 6 (que rodou os cenários de alerta
  direto nesse veículo real, antes da disciplina de "sempre limpar depois"
  virar prática consistente a partir da Fase 8). Diferente do veículo de
  teste dedicado (placa `TST...`) usado na validação automatizada pós-Fase
  8, que foi limpo por completo. Não apaguei nada — é uma decisão do dono do
  produto, não algo pra um agente decidir sozinho.

- ✅ **Bloco 2 — Galeria na captura + EXIF como camada de alerta anti-fraude.**
  **Correção de premissa registrada no Bloco 1 (confirmada aqui)**: até este
  bloco, EXIF nunca tinha sido implementado — as colunas `midias.exif_gps`/
  `midias.exif_timestamp` já existiam desde a `0001_init.sql` (ponto de
  extensão futura), mas nada as lia ou escrevia. **Isso deixou de ser
  verdade**: liberar a galeria abre uma porta real pra reaproveitar um
  comprovante antigo, e o EXIF é a defesa que fecha essa porta — por isso os
  dois entraram juntos, não em blocos separados. Nenhuma migration nova foi
  necessária (as colunas já existiam).

  **Galeria + câmera** (`components/motorista/passo-foto.tsx`): dois botões
  lado a lado — "Tirar foto" (`capture="environment"`, força a câmera
  traseira) e "Escolher da galeria" (mesmo `<input type="file">`, sem
  `capture`, abre o seletor do sistema). Os dois alimentam o mesmo
  `handleFotoChange` — não há nenhum código diferente por origem, então a
  compressão (`comprimirImagem`), a validação de tipo/tamanho
  (`validarFoto`) e o hash de duplicata (SHA-256) já valiam igual pros dois
  caminhos antes mesmo deste bloco, por construção.

  **Achado que motivou o desenho do EXIF**: a foto que vai pro Storage
  sempre passa por `comprimirImagem()` (canvas: `createImageBitmap` +
  `drawImage` + `toBlob`), e recodificar via canvas **apaga todo o EXIF**.
  Ou seja, se o servidor só lesse o campo `foto` (like já fazia), o EXIF
  read seria sempre `null` no caminho online — a leitura problema teria que
  vir de outro lugar. Solução: o client agora também envia
  `foto_exif`, um recorte (`File.slice(0, 128KB)`, corte puro, **sem**
  recodificar) só do **início** do arquivo original — é onde o EXIF de um
  JPEG mora (marcador APP1, logo após o SOI). Isso preserva os bytes EXIF
  originais, escritos pela câmera/app de galeria, sem reenviar a foto
  inteira (que arriscaria estourar o limite de payload de function
  serverless da Vercel se o original tiver vários MB). Aplicado nos dois
  caminhos de envio: submit online (`fluxo-abastecimento.tsx`) e fila
  offline (`lib/offline/db.ts` ganhou o campo `fotoExifHeaderBlob`,
  `lib/offline/sync.ts` reenvia como `foto_exif`) — como é só um recorte de
  ~128KB (não o arquivo inteiro), o custo de guardar isso a mais no
  IndexedDB é desprezível.

  **Leitura no servidor** (`lib/exif.ts`, `server-only`, usa `exifr` — já
  era dependência do projeto, nunca usada até agora): `extrairExifFoto(buffer)`
  lê `DateTimeOriginal` e `GPSLatitude`/`GPSLongitude`, nunca lança (foto sem
  EXIF, corrompida ou formato sem suporte é sempre `{ timestamp: null, gps:
  null }`, nunca um erro). `/api/abastecimentos` prefere `foto_exif`; sem
  esse campo (ex.: caminho antigo/defensivo), cai pro fallback de tentar ler
  do próprio `foto` (que normalmente não terá metadado, mas não custa
  tentar). `exif_timestamp`/`exif_gps` gravados em `midias` junto da foto.
  **GPS é só armazenado, não usado em nenhuma regra ainda** — não existe
  hoje uma baseline de localização (garagem, posto habitual) pra comparar;
  fica pronto pra quando/se isso entrar de escopo.

  **Nova regra em `lib/validacao/regras.ts`**: `avaliarFotoAntigaOuReaproveitada`
  — dispara nível **atenção** (não crítico: EXIF é sinal de suspeita, não
  prova; câmera com relógio errado ou fuso diferente pode gerar falso
  positivo, então o nível mais brando é proposital) quando o
  `DateTimeOriginal` é **mais de 48h anterior** ao fim do dia
  (`data_abastecimento` informado). **Nunca dispara**: (a) quando não há
  EXIF (`fotoExifTimestamp: null` — o caso normal pra print, WhatsApp, PNG,
  ou qualquer app de galeria que remove metadado ao compartilhar); (b)
  quando o timestamp é malformado (trata como ausente, não quebra); (c)
  quando a foto foi tirada **depois** da data informada — registrar um
  abastecimento atrasado (foto tirada hoje, data informada de ontem) é fluxo
  legítimo e comum, não fraude, então só o sentido "foto mais antiga que o
  informado" conta. `ContextoAvaliacao` ganhou dois campos
  (`abastecimento.dataAbastecimento`, `fotoExifTimestamp`) — `contextoBase()`
  em `regras.test.ts` atualizado, mais 6 testes novos (EXIF ausente, EXIF
  coerente, dentro da tolerância de 48h, EXIF bem mais antigo — dispara,
  foto tirada depois da data informada — não dispara, timestamp malformado
  — não lança). Rótulo novo em `components/escritorio/lista-alertas.tsx`
  ("Foto do comprovante mais antiga que o esperado").

  **Validado com 50 testes automatizados** (6 novos) e **contra o endpoint
  real** (`/api/abastecimentos`, servidor de desenvolvimento local, veículo
  de teste dedicado `TSTEXIF1`, removido por completo ao final — mesmo
  padrão da validação pós-Fase 8): JPEG artesanal com EXIF de ~6 meses atrás
  → alerta `foto_antiga_ou_reaproveitada` (atenção, `horas_de_diferenca:
  4403`); mesmo JPEG com EXIF do próprio dia → nenhum alerta; PNG sem EXIF →
  nenhum alerta, registro passa limpo; reenvio dos MESMOS bytes de foto
  (simulando escolher de novo a mesma imagem da galeria) → **as duas
  regras disparam juntas** (`foto_comprovante_duplicada` E
  `foto_antiga_ou_reaproveitada`), confirmando que o hash de duplicata
  continua ativo e que as duas camadas são complementares, não mutuamente
  exclusivas (mesmo padrão de outras combinações já documentadas em
  `regras.ts`). **UI confirmada visualmente no navegador**: o passo de foto
  do wizard mostra os dois botões lado a lado ("Tirar foto" / "Escolher da
  galeria") no veículo de teste; não foi possível automatizar o clique no
  seletor de arquivo nativo do sistema a partir desta sessão (a ferramenta
  de automação de navegador bloqueia isso por design), então a escolha real
  de um arquivo da galeria não foi clicada ao vivo — mas o código por trás
  do botão é comprovadamente idêntico ao da câmera (mesmo `handleFotoChange`,
  sem ramificação por origem), e o pipeline do servidor que processa
  qualquer `File` recebido (compressão, hash, EXIF) foi validado
  end-to-end via chamada direta ao endpoint. `tsc`, `lint`, `test` (50) e
  `build` confirmados limpos.
- ✅ **Bloco 3 — Foto no histórico do escritório + fechamento de um buraco
  real de isolamento por tenant no Storage.**

  **Achado crítico, corrigido neste bloco**: o bucket `comprovantes` foi
  criado `public = true` na migration `0004` (Fase 3), com uma policy de
  `SELECT` em `storage.objects` **sem nenhum filtro de empresa**
  (`using (bucket_id = 'comprovantes')`). Bucket público + policy aberta
  significa que a URL de qualquer foto de comprovante (salva em
  `midias.url`) era acessível por qualquer pessoa com o link, de qualquer
  empresa — o path (`empresa_id/veiculo_id/arquivo`) só escondia isso por
  obscuridade, não isolava de verdade. Isso **violava o invariante #1**
  desde a Fase 3, mas nunca tinha sido explorado por nada na UI porque
  nenhuma tela do escritório chegou a exibir essas fotos até este bloco ser
  o primeiro a precisar mostrá-las. Corrigido na migration
  `0007_comprovantes_storage_privado.sql` (aplicada no projeto real via
  `supabase db push`): bucket vira privado (`public = false`), a policy
  aberta é removida — sem substituir por outra policy de `storage.objects`,
  porque o acesso agora só passa pela rota autenticada abaixo.

  **`app/api/midias/[id]/route.ts`** (nova, autenticada): duas camadas de
  isolamento, não uma só — (1) a linha de `midias` é buscada com o client de
  **sessão** (RLS ativo; `midias_select` já existia desde a `0001`, filtra
  por `empresa_id = usuario_empresa_id()`) — se a mídia for de outra
  empresa, a query volta vazia, tratada como 404 (nunca revela "existe mas
  não é sua" vs. "não existe"); (2) só depois disso, com o path já
  confirmado como da empresa certa, o arquivo é baixado do Storage via
  service role (que ignora RLS de Storage, mas nesse ponto o isolamento já
  foi garantido pelo passo 1 — mesmo padrão de duas camadas descrito no
  invariante #4). Suporta `?baixar=1` pra forçar download com
  `Content-Disposition: attachment` (mesmo padrão de
  `/api/veiculos/[id]/qr`); sem o parâmetro, serve inline pra exibição.

  **UI**: `components/escritorio/foto-comprovante.tsx` (Client Component) —
  miniatura 48×48 clicável (`<img src="/api/midias/[id]">`, nunca a URL de
  Storage direta) que abre um lightbox (overlay, fecha com Esc ou clique
  fora) com a foto em tamanho grande e um link "Baixar original"
  (`?baixar=1`). Nova coluna "Foto" na tabela de "Histórico de
  abastecimentos" (`onibus/[id]/page.tsx`) — busca todas as `midias` dos
  abastecimentos exibidos numa query só (mesmo padrão da busca de alertas
  já existente na página), mapeando `abastecimento_id → midia_id` (se um dia
  existir mais de uma foto por abastecimento, fica valendo a mais recente).
  "—" quando não há foto associada.

  **Validado**: `npx supabase migration list` confirmou a `0007` aplicada no
  projeto real; `curl` direto na URL pública antiga de uma foto real
  (formato `.../object/public/comprovantes/...`) confirmado **400** depois
  da migration (antes seria 200 — bloqueio de verdade, não só teórico).
  **No navegador**, logado como o administrador real: miniatura renderiza a
  foto de teste real (comprovante sintético da Fase 4, "POSTO BR CAMPINAS"),
  clique abre o lightbox em tamanho grande, "Baixar original" e "Fechar"
  funcionando. **Isolamento por tenant confirmado no nível que realmente
  importa (RLS)**: criada uma empresa + usuário de teste totalmente
  isolados (fora do navegador, via `@supabase/supabase-js` com uma sessão
  real trocada por `verifyOtp` — evita o viés de cookie compartilhado entre
  abas do mesmo navegador, que mascarou uma tentativa inicial de teste
  direto no Chrome), e a tentativa de ler uma `midia` da Expresso Mundial
  logado como a empresa de teste **voltou vazia** (RLS filtrou, exatamente
  como as outras tabelas já validadas desde a Fase 1). Empresa/usuário de
  teste removidos por completo depois. `tsc`, `lint`, `test` (50) e `build`
  confirmados limpos (`/api/midias/[id]` aparece na lista de rotas do
  build).

  **Não incluído neste bloco** (fora do que foi pedido, mas registrado pra
  não esquecer): a mesma coluna de foto não foi adicionada à tabela
  "Últimos registros" da página de detalhe do motorista
  (`motoristas/[id]/page.tsx`) — só a tabela explicitamente chamada
  "Histórico de abastecimentos" (aba do ônibus) ganhou a coluna. Fácil de
  estender se fizer sentido depois.
- ✅ **Bloco 4 — Export Excel + PDF, respeitando o filtro ativo.**

  **Novas dependências**: `exceljs` (Excel, com suporte nativo a hyperlink
  em célula, estilo, cores, congelar painel) e `jspdf` + `jspdf-autotable`
  (PDF). Escolhido `jspdf` em vez de `pdfkit` de propósito: `pdfkit` lê
  fontes AFM do disco em tempo de execução, o que é um risco conhecido de
  bundling em function serverless (Vercel) se o tracing de arquivo não pegar
  os `.afm` certos; `jspdf` embute as fontes padrão como dado JS, sem
  depender do sistema de arquivos — mais seguro pro alvo de deploy do
  projeto.

  **Referência do LuckFrota usada de verdade**: consegui abrir a pasta
  (`C:\Users\User\Desktop\luckfrota`) e localizei
  `src/services/exportExcelProfessional.js` e
  `exportPDFProfessional.js` — já usam exatamente `exceljs` e
  `jspdf`+`jspdf-autotable`, com a mesma paleta navy/ciano
  (`0A1628`/`00D4FF`) do LuckTank. Padrões replicados aqui: header da
  planilha em negrito branco sobre navy sólido, linhas alternadas em cinza
  claro, linha de totais destacada, formato de moeda `"R$"#,##0.00`, cor de
  aba (`tabColor`) por sheet; no PDF, faixa navy no topo com título branco +
  subtítulo em ciano, tabela via `autoTable` com cabeçalho navy/texto
  branco, linhas alternadas, `theme: "grid"`.

  **`lib/export/`** (funções puras testadas, mesmo padrão de
  `lib/validacao/regras.ts`): `resumo.ts` (`calcularResumoExport` — mesma
  regra de soma/soma de `lib/onibus/estatisticas.ts`, 5 testes) e
  `nome-arquivo.ts` (`gerarNomeArquivoExport` — `LuckTank_<Empresa sem
  acento/espaço>_<período>.<ext>`; período vira `YYYY-MM` quando o filtro
  cobre um mês corrido inteiro, senão `YYYY-MM-DD_a_YYYY-MM-DD`, 4 testes
  incluindo o caso de fevereiro bissexto). `excel.ts`/`pdf.ts` são os
  geradores de verdade (não são puros — usam as libs — mas recebem só dado
  já resolvido, sem query dentro, mesmo espírito).

  **`app/api/export/route.ts`** (nova, autenticada): usa **exatamente**
  `parseFiltrosAbastecimento`/`resolverPeriodo`/`aplicarFiltrosQuery` do
  Bloco 1 — o mesmo filtro que a tela está mostrando no momento do clique,
  nunca uma reinterpretação própria. O dashboard passa `de`/`ate` já
  **resolvidos** (não os parâmetros crus da URL) como query string do link
  de export, pra garantir que o arquivo gerado nunca possa divergir do que
  está na tela por causa de um recálculo de "hoje" entre o carregamento da
  página e o clique no botão. A foto de cada linha vira link pra
  `/api/midias/[id]` (a rota autenticada do Bloco 3 — nunca a URL antiga do
  Storage), então o link só abre pra quem tem sessão válida da empresa
  certa; no PDF, os bytes da foto são baixados (via `baixarFotoComprovante`,
  reaproveitado do Bloco 3) e embutidos como miniatura só quando o formato é
  JPEG/PNG/WEBP (HEIC — comum em foto de iPhone — não tem suporte nativo do
  jsPDF; a linha fica sem miniatura nesse caso, sem quebrar o resto do
  relatório).

  **Excel**: aba "Abastecimentos" (uma linha por abastecimento: Data,
  Veículo, Motorista, KM, KM rodado, Litros, R$/litro, Total, Consumo
  (km/L), Posto, Cidade, Nº nota, Alertas, **Foto** — célula separada com
  hyperlink clicável "Ver foto", nunca embutida em outra coluna) + linha de
  TOTAIS ao final da mesma aba + aba "Resumo" separada (empresa, período,
  filtros aplicados, quantidade de registros, total de litros, total gasto,
  preço médio/litro, consumo médio). **PDF**: faixa navy com título/período/
  filtros no topo, tabela com miniatura da foto na primeira coluna, resumo
  do período ao final.

  **Validado com dado real** — dois caminhos, porque a automação de
  navegador desta sessão bloqueia tanto ler o arquivo baixado (sem acesso ao
  diretório de downloads do Chrome automatizado) quanto extrair o binário
  via JS de página (bloqueio de segurança da própria ferramenta contra
  exfiltração de base64): (1) **clique real no botão**, no navegador,
  logado como o administrador, com filtro `veículo=EXM1A23 + este mês`
  aplicado — `fetch` teimoso, mas o log do servidor confirmou `200` pros
  dois GETs (`formato=xlsx`); (2) **geração via os módulos reais do
  projeto** (`lib/export/excel.ts`/`pdf.ts`/`resumo.ts`, mesmíssimo código,
  rodado fora do Next via `tsx` com um shim mínimo só pro guard de
  `server-only` — que não tem efeito nenhum na lógica) usando os dados reais
  do Supabase com o mesmo filtro: **13 registros, 1.551,0 L, R$ 9.185,15,
  R$ 5,92/L, 7,69 km/L** — bate exatamente com o que o dashboard e a aba do
  ônibus já mostravam (Bloco 1). Excel lido de volta linha a linha
  (`exceljs`) confirma 13 linhas de dado + linha de TOTAIS com os mesmos
  números; link da coluna Foto confirmado apontando pra
  `/api/midias/<id>` de verdade. PDF confirmado com assinatura `%PDF-`
  válida, 155KB (13 miniaturas de foto real embutidas, todas baixadas com
  sucesso), contendo a placa do veículo e o valor total do resumo no texto
  bruto do arquivo. `tsc`, `lint`, `test` (59) e `build` confirmados limpos
  (`/api/export` aparece na lista de rotas).

## Prefixo do veículo, ajustes de design e export na aba do ônibus

Pedido do usuário pós-Bloco 4 de export, em 3 blocos.

- ✅ **Bloco 1 — Prefixo do veículo (identidade operacional).** Na operação
  real da frota (Expresso Mundial), motorista e escritório se referem ao
  ônibus pelo **prefixo** (ex.: "1450"), não pela placa — a placa é só o
  dado legal/de documento. Migration `0008_veiculos_prefixo.sql`
  (`alter table veiculos add column if not exists prefixo text`, aplicada
  no projeto real via `supabase db push`) — nullable de propósito, pra não
  quebrar veículos já cadastrados. `types/database.ts` regenerado via
  `supabase gen types typescript --linked`.

  **`lib/formatacao.ts`**: nova função pura `formatarVeiculo(prefixo, placa)`
  — devolve `"1450 · EXM1A23"` quando há prefixo, só `"EXM1A23"` quando não
  há (null/undefined/string vazia) — testada (`formatacao.test.ts`, 4
  casos). Usada em **todo** lugar que exibe veículo: lista e detalhe do
  ônibus, seletor de veículo do filtro (Bloco 1 de filtros), gráfico
  "consumo por ônibus" do dashboard, painel de alertas, tabela de
  abastecimentos do motorista, QR (legenda embutida no SVG) e etiqueta de
  impressão, export Excel/PDF, e o cabeçalho do próprio fluxo do motorista
  (`/r/[qrToken]`) — o motorista também vê o prefixo, já que é ele quem usa
  esse identificador no dia a dia, por pedido explícito do usuário.

  **Cadastro/edição** (`components/escritorio/veiculo-form.tsx`): prefixo
  vira campo principal, lado a lado com a placa (grid de 2 colunas), com
  nota explicando o papel do campo. `lib/validacao/schemas.ts`:
  `veiculoSchema.prefixo` opcional (string vazia vira `null`, mesmo padrão
  de `textoOpcional`).

  **Veículos já cadastrados (ex.: `EXM1A23`) ficam sem prefixo** até
  alguém preencher — não há migração de dado automática (não daria pra
  inventar um prefixo que não existe). Preenchimento é manual, pela própria
  tela de edição do veículo (`/onibus/[id]`) — já tinha o campo antes deste
  bloco, só ganhou o input novo.

  **Validado no navegador**: antes de preencher, `EXM1A23` aparecia só com
  a placa em todo lugar (lista, detalhe, seletor, etiqueta). Preenchido o
  prefixo "1450" pela tela de edição, **todas as telas passaram a mostrar
  "1450 · EXM1A23" imediatamente**: lista de ônibus, seletor de veículo do
  dashboard, eixo do gráfico "Consumo médio por ônibus", painel de Alertas
  (8 alertas, todos com "1450 · EXM1A23" no contexto), e tanto a legenda
  do QR quanto o título da etiqueta de impressão. `tsc`, `lint`, `test`
  (63) e `build` confirmados limpos.
- ✅ **Bloco 2 — Ajustes de design (respiro) + total de KM rodado.** Paleta
  navy/ciano intocada — só espaçamento/leitura, como pedido.

  **Respiro**: `components/ui/card.tsx` ganhou padding por variante
  (`PADDING_VARIANTS`) — `dark` (escritório) foi de `p-5` pra `p-6`,
  `light` (fluxo do motorista) ficou **intocado** em `p-5` de propósito
  (tem alvo de toque/legibilidade ao sol já calibrados, não é o que estava
  "apertado" — só o escritório foi citado no pedido). Mesma lógica no
  `CardTitle` (`mb-3` light, `mb-4` dark). `app/(escritorio)/layout.tsx`:
  sidebar `p-4→p-5`, logo `mb-8→mb-10`, main `p-8→p-8 lg:p-10`.
  `sidebar-nav.tsx`: itens `py-2.5→py-3`, `gap-1→gap-1.5`.
  `filtros-abastecimento.tsx` (compartilhado dashboard/aba do ônibus):
  `p-4→p-5`, `gap-3→gap-4` nos dois níveis. Dashboard: título
  `mb-6→mb-8`, container geral `gap-8→gap-10`, cards de resumo
  `gap-4→gap-5`/`p-5→p-6`, grid de gráficos `gap-6→gap-8`. Aba do ônibus:
  container geral `gap-6→gap-8`, grid "Dados do veículo"/QR `gap-6→gap-8`,
  grid das 3 médias `gap-4→gap-5`, `CardEstatistica` `p-5→p-6`. Tabela de
  histórico: cabeçalho `py-2→py-3`, linhas `py-2→py-3.5` (mais altura de
  linha, pedido explícito).

  **Total de KM rodado**: `lib/onibus/estatisticas.ts` ganhou 3 campos
  novos em `EstatisticasVeiculo` — `totalLitros`, `totalValorGasto` (somam
  **todos** os registros do período, mesma regra do gasto médio por
  abastecimento) e `totalKmRodado` (só soma registros com km_rodado válido
  — mesma regra crítica do consumo médio; testado explicitamente que
  km_rodado nulo/zero fica de fora da soma mas litros/valor continuam
  contando). 4 testes existentes atualizados + assinaturas novas cobrindo
  os 3 totais em cada cenário. Nova linha `<tfoot>` na tabela "Histórico de
  abastecimentos" (`onibus/[id]/page.tsx`): "Total no período filtrado" com
  KM rodado, Litros e Total (R$) — usa os mesmos `estatisticas` que já
  alimentam os 3 cards de média (reflete o período filtrado inteiro, não só
  as linhas visíveis quando a tabela está limitada a 50, mesma nota já
  existente pras médias).

  **Validado no navegador**: respiro visivelmente maior nas duas telas
  (dashboard e aba do ônibus), consistente entre elas — mesmos incrementos
  de padding/gap nos dois lugares. Linha de total conferida à mão contra o
  histórico real do `EXM1A23` (13 registros): **10.000 km, 1.551,0 L,
  R$ 9.185,15** — bate exato somando as 13 linhas visíveis na tela (KM
  rodado dos 12 registros com km válido: 490+10+1000+500+500+500+1000+
  1000+500+1500+1000+2000 = 10.000; litros dos 13: soma 1.551; valor dos
  13: soma R$9.185,15). `tsc`, `lint`, `test` (63 — os 4 de
  `estatisticas.test.ts` ganharam asserts novos, sem aumentar a contagem de
  `it()`) e `build` confirmados limpos.
- ✅ **Bloco 3 — Export (Excel + PDF) dentro da aba do ônibus, com as
  médias.** Não criei uma rota nova — `/api/export` (Bloco 4 de export)
  já aceitava `veiculo_id` como filtro; esse bloco só ensinou a MESMA rota
  a ficar "consciente de veículo" quando o filtro resolve pra exatamente
  um: nesse caso, calcula as médias e troca a convenção de nome de
  arquivo. Evita duplicar toda a lógica de query/foto/alerta que já existia
  pro export do dashboard.

  **`lib/onibus/estatisticas.ts` reaproveitado, não reimplementado**: a
  rota chama `calcularEstatisticasVeiculo` — a mesma função que já
  alimenta os 3 cards de média na tela — sobre a mesma lista de
  abastecimentos já buscada pro export. Garante que os números do arquivo
  **nunca podem divergir** dos cards, porque é literalmente o mesmo
  cálculo sobre o mesmo dado. `lib/export/excel.ts`/`pdf.ts` ganharam um
  5º parâmetro opcional `medias?: EstatisticasVeiculo` — `undefined` no
  export geral do dashboard (onde "consumo médio de vários veículos
  juntos" não faz sentido do mesmo jeito), presente só quando o export sai
  de dentro da aba de um veículo específico. Nos dois formatos, a seção
  nova mostra "Consumo médio (km/L)", "Custo médio por km (R$/km)" e
  "Gasto médio por abastecimento (R$)", cada um com a contagem de
  registros que embasa (`abastecimentosComKmValido` pros dois primeiros,
  `totalAbastecimentos` pro terceiro) — mesma distinção já usada nos cards
  da tela. No PDF, o bloco de resumo ganhou uma checagem de espaço restante
  na página (`alturaEstimada` vs. altura livre) — quebra pra uma página
  nova em vez de estourar a margem inferior quando o resumo + médias não
  cabem no que sobrou depois da tabela.

  **`lib/export/tipos.ts`/`resumo.ts`**: `ResumoExport` ganhou
  `totalKmRodado` (mesma regra assimétrica de sempre — só soma registros
  com km_rodado válido) — isso beneficia os DOIS exports, não só o de
  veículo: a linha de TOTAIS do Excel e o resumo do PDF agora mostram KM
  rodado também no export geral do dashboard (multi-veículo), não só no de
  um veículo só.

  **Nome do arquivo**: `gerarNomeArquivoExport` mudou de assinatura —
  antes recebia uma string (nome da empresa), agora recebe
  `string[]` (segmentos), cada um limpo/slugificado separadamente e
  juntado com `_` (em vez de virar uma coisa só). Export geral:
  `[empresa.nome]` (comportamento idêntico a antes). Export de dentro da
  aba do ônibus: `[veiculo.prefixo, veiculo.placa]` →
  `LuckTank_1450_EXM1A23_2026-07.xlsx` (ou com o intervalo explícito
  quando o período não é um mês corrido inteiro). Veículo sem prefixo
  ainda funciona — segmento vazio é ignorado, só a placa entra no nome.

  **UI**: botões "Exportar Excel"/"Exportar PDF" na aba do ônibus
  (`onibus/[id]/page.tsx`), mesmo estilo dos botões do dashboard,
  montados a partir do `periodo`/`filtros` **já resolvidos** na página
  (mesmo motivo do dashboard: nunca deixar o clique recalcular "hoje" de
  novo e divergir do que está na tela) — veículo sempre fixo, motorista
  incluído só se filtrado.

  **Validado**: gerado o Excel e o PDF de verdade via os módulos reais do
  projeto (mesmo padrão de validação dos blocos de export anteriores —
  `tsx` fora do Next, com o guard de `server-only` neutralizado só pro
  script), com o veículo `1450 · EXM1A23` filtrado no período de julho:
  **13 registros, KM rodado total 10.000, litros 1.551,0, R$ 9.185,15** —
  bate com o Bloco 2. **Médias no arquivo idênticas aos cards da tela**:
  consumo médio 7.69 km/L (12 registros válidos), custo médio R$0,77/km
  (12 registros válidos), gasto médio R$706,55 (13 registros) — os três
  números exatos que já apareciam na tela antes deste bloco. Nome do
  arquivo confirmado: `LuckTank_1450_EXM1A23_2026-07-01_a_2026-07-03.xlsx`.
  PDF confirmado com assinatura `%PDF-` válida, contendo "1450", o total
  gasto e o gasto médio no texto bruto do arquivo. **Clique real no botão
  "Exportar Excel"** na aba do ônibus, no navegador — servidor confirmou
  `200` no log pro GET com `veiculo_id` fixo. `tsc`, `lint`, `test` (65 —
  10 novos, entre `nome-arquivo.test.ts` e `resumo.test.ts`) e `build`
  confirmados limpos.
- ✅ **Correção pós-Bloco 3: o bloco de médias e o total de KM rodado
  existiam no código, mas estavam "escondidos" demais pra serem
  encontrados.** A lógica de cálculo (KM rodado na linha de TOTAIS,
  médias via `calcularEstatisticasVeiculo`) já tinha sido implementada e
  validada no bloco anterior — o problema real era **onde** essa
  informação aparecia no arquivo: o total de KM rodado estava correto na
  linha de totais da aba "Abastecimentos", mas o bloco de médias e o
  cabeçalho de identificação (empresa/veículo/período/filtros) só
  existiam numa aba **separada** chamada "Resumo" — fácil de nunca clicar
  e achar que não existe. No PDF, o bloco de médias aparecia só **depois**
  da tabela inteira, no fim do documento (às vezes precisando de uma
  página extra), em vez de logo no topo.

  **Corrigido**: `lib/export/excel.ts` reescrito pra colocar o cabeçalho
  de identificação (título, empresa, veículo quando aplicável, período,
  filtros) e o bloco de médias **direto no topo da própria aba
  "Abastecimentos"**, antes do cabeçalho da tabela — a mesma informação
  que antes só existia na aba "Resumo" (mantida como referência
  secundária/compacta, mas não é mais o único lugar onde aparece).
  Painel congelado (`sheet.views`) ajustado pra travar logo abaixo do
  cabeçalho da TABELA (não mais da linha 1), já que agora a linha 1 é o
  título, não os nomes das colunas. `lib/export/pdf.ts`: bloco de médias
  movido pra **logo depois da faixa de identificação, antes da tabela**
  (era depois, no fim do documento) — mesmo raciocínio.
  `CabecalhoExport` (lib/export/tipos.ts) ganhou `veiculoLabel?: string`,
  preenchido pela rota só quando o export está filtrado por um veículo
  específico, pra poder mostrar "Veículo: 1450 · EXM1A23" junto do resto
  da identificação sem precisar inferir isso de `medias` estar presente.

  **Legibilidade**: colunas "Posto" (22→26) e principalmente "Alertas"
  (34→44) mais largas nos dois formatos; `wrapText` ativado nas células de
  Posto/Alertas do Excel (o valor da célula nunca foi cortado de verdade —
  cortar é só uma questão de exibição visual quando a coluna é estreita e
  o texto não quebra linha — mas sem `wrapText` dava a impressão de dado
  perdido); no PDF, colunas Posto/Alertas ganharam largura mínima maior via
  `columnStyles` (o autoTable já quebra linha automaticamente dentro da
  largura da coluna, então a única correção necessária ali era dar mais
  espaço, não mudar o comportamento de quebra).

  **Nada de recálculo divergente**: todos os números continuam vindo
  exatamente das mesmas funções já usadas pela tela — `calcularResumoExport`
  (totais) e `calcularEstatisticasVeiculo` (médias, quando o export é de um
  veículo só) — só a apresentação/posição no arquivo mudou.

  **Validado com dado real** (veículo `1450 · EXM1A23`, julho de 2026, 13
  registros): gerado o Excel de verdade via os módulos do projeto (mesmo
  padrão `tsx` + guard de `server-only` neutralizado) e **lido de volta
  linha a linha** — linha 1 é o título, linha 2 tem
  "Empresa: Expresso Mundial · Veículo: 1450 · EXM1A23 · Período: ...",
  linha 3 os filtros, linhas 5-8 as 3 médias com a contagem de registros
  ("Consumo médio (km/L): 7.69 (sobre 12 registro(s) válido(s))" etc. —
  **idênticas aos cards da tela**), linha 10 o cabeçalho da tabela, e a
  última linha "TOTAIS" com **KM rodado 10.000, Litros 1.551, Total
  R$9.185,15** — batendo exato com a soma manual (já confirmada nos
  blocos anteriores) e com os cards. Painel congelado confirmado na linha
  10 (logo abaixo do cabeçalho da tabela). PDF gerado e confirmado com
  assinatura válida, contendo o veículo, o total de KM rodado e as médias
  no texto bruto do arquivo. Testado também o **export geral do dashboard
  (sem veículo filtrado)**: cabeçalho sem a linha "Veículo" (omitida
  corretamente), sem bloco de médias (correto — não faz sentido pra
  múltiplos veículos juntos), mas com o total de KM rodado somado
  corretamente na linha de TOTAIS. **Clique real nos 4 botões** (Excel e
  PDF, tanto no dashboard geral quanto na aba do ônibus filtrada por
  veículo), no navegador — servidor confirmou `200` nos 4 casos.
  `tsc`, `lint`, `test` (65) e `build` confirmados limpos.

## Hardening pós-auditoria externa (2026-07-07)

Auditoria geral independente do sistema (banco de dados/RLS, API/server
actions e lógica de negócio revisados em paralelo, achados reconferidos
manualmente no código-fonte antes de qualquer correção — não só aceitos do
relatório). Achados e o que foi feito:

- ✅ **Corrida de concorrência no bloqueio de KM (alto).** O trigger
  `atualiza_km_veiculo` (0001) sobrescrevia `veiculos.km_atual`
  incondicionalmente, sem lock e sem comparar com o valor mais recente — a
  regra "KM não pode retroceder" (invariante #6) vivia só na aplicação,
  comparando um valor lido ANTES do insert. Dois inserts concorrentes pro
  mesmo veículo (ex.: fila offline de dois celulares sincronizando junto)
  podiam os dois passar na checagem da aplicação antes de qualquer um gravar.
  `0011_km_trava_concorrencia.sql`: novo trigger `BEFORE INSERT` que trava a
  linha do veículo (`for update`) e só então compara, com `errcode`
  customizado (`LT001`) — o lock fica retido até o fim da transação do
  insert, serializando concorrência real no Postgres. `app/api/abastecimentos/route.ts`
  atualizado pra tratar `LT001` como 409 (mesmo padrão já usado pro `23505`
  de `registro_uuid`). A checagem antiga em `route.ts` continua (feedback
  rápido, sem round-trip de erro), mas o banco passou a ser a fonte de
  verdade. **Aplicada no projeto Supabase real** (usuário rodou direto no SQL
  Editor) e **confirmada via `supabase db query --linked`**: trigger
  `valida_km_nao_retrocede` presente em `pg_trigger` de `abastecimentos`,
  ao lado do `atualiza_km_veiculo` original. Como a aplicação foi manual (não
  via `supabase db push`), a tabela de histórico de migrations do projeto não
  sabia disso — corrigido com `supabase migration repair --linked --status
  applied 0011 0012`; `supabase migration list` confirma as 12 migrations
  sincronizadas local×remoto. **Ainda não testado**: nenhum insert real
  disparou o trigger ainda (só a existência dele foi confirmada, não o
  comportamento sob concorrência de verdade).
- ✅ **`motorista_id` não revalidado contra a empresa (alto).**
  `/api/abastecimentos` resolvia `veiculo_id`/`empresa_id` a partir do
  `qr_token` (correto), mas aceitava o `motorista_id` do client sem checar se
  pertencia à mesma empresa — quebrava o invariante #2 ("nunca confiar em id
  vindo do client"). `route.ts` agora confere `motorista_id` contra
  `empresa_id` do veículo antes do insert; se não bater, trata como se não
  tivesse vindo (cai pro nome livre) e retorna 400 se nenhum dos dois
  existir.
- ✅ **Sem CHECK constraints de valor em `abastecimentos` (médio).**
  `litros`/`valor_total`/`km_atual` eram `not null` mas sem `check (> 0)` —
  garantia vivia só no Zod. `0012_abastecimentos_check_constraints.sql`
  adiciona os três `check`. Aditivo, sem risco pro dado existente (Zod
  sempre validou antes de gravar). **Aplicada e confirmada** junto com a
  0011 — `pg_constraint` de `abastecimentos` mostra
  `abastecimentos_litros_positivo`, `abastecimentos_valor_total_positivo` e
  `abastecimentos_km_atual_positivo`, os três com a definição esperada.
- ✅ **Fila offline sem visibilidade nenhuma (médio).** Um item que falhasse
  pra sempre (ex.: bloqueado pela regra de KM) ficava marcado `"erro"` no
  IndexedDB do aparelho sem nenhuma tela mostrando isso — pra um produto
  anti-fraude, "o abastecimento nunca entrou no sistema" é exatamente o
  cenário que se quer evitar, e podia acontecer em silêncio no celular do
  motorista. Novo `components/motorista/fila-pendencias.tsx`: lista os itens
  em erro (data, nº de tentativas, motivo), com "tentar enviar novamente"
  (reusa `sincronizarFila()`) e "descartar este registro"; renderizado no
  topo do wizard (`fluxo-abastecimento.tsx`), visível em qualquer passo.
  **Não testado no navegador ainda** (só `tsc`/`lint`/`test` — ver abaixo).
- ✅ **Nit — comentário desatualizado.** `lib/supabase/admin.ts` dizia que o
  client admin só podia ser importado dentro de `app/api/**`; corrigido pra
  refletir o uso real (também correto) em Server Actions.
- ⏸️ **Resolução de alerta sem checar papel (médio) — NÃO alterado.** A
  policy `alertas_update` libera qualquer usuário autenticado da empresa
  (sem checar papel), e o comentário em `alertas/actions.ts` mostra que isso
  foi uma decisão deliberada ("resolver é ação operacional leve, não edição
  de dado de negócio"), não um descuido. Fica pendente de decisão do usuário
  antes de mexer — restringir pra gerente/administrador teria efeito de
  produto (supervisor deixaria de poder resolver alerta sozinho).
- ⏸️ **Rate limit inerte (médio) — NÃO é código.** `UPSTASH_REDIS_REST_URL`/`_TOKEN`
  não configuradas neste ambiente — comportamento correto por design (falha
  aberta), mas é ação operacional do usuário (criar conta Upstash), não
  correção de código.
- ⏸️ **Cascade delete amplo a partir de `empresas` (baixo) — sem ação.** Sem
  UI de exclusão de empresa hoje, nada pra corrigir ainda; só vira relevante
  se/quando `admin-sistema` ganhar essa função.
- ⏸️ **Tolerâncias de fraude em 3 arquivos (baixo) — sem ação.** Os
  comentários em `regras.ts`/`estatisticas.ts` já explicam que são números
  INDEPENDENTES de propósito (comparam coisas conceitualmente diferentes:
  histórico do próprio veículo, ficha técnica do fabricante, exibição no
  dashboard) — unificar seria incorreto, não só reorganização.

**Verificado depois das mudanças**: `npm test` — 89/89 passando (mesmos 89
de antes, nenhum novo teste unitário adicionado pras migrations/rota, já que
a correção de concorrência só é observável com banco real); `tsc --noEmit`
limpo; `eslint` limpo nos arquivos tocados. Migrations 0011/0012 aplicadas
no projeto Supabase real pelo usuário (SQL Editor) e a EXISTÊNCIA do trigger
e das três constraints confirmada via `supabase db query --linked` contra
`pg_trigger`/`pg_constraint`; histórico de migrations reparado (`supabase
migration repair --linked --status applied 0011 0012`) pra `supabase db
push` futuro não tentar recriar o que já existe. **Ainda não verificado**:
nenhum teste de COMPORTAMENTO ponta a ponta — não foi provocado um insert
real com KM menor (nem concorrente) pra ver o 409 do `LT001` acontecer, nem
um insert com litros/valor ≤ 0 pra ver o `check` barrar; a tela de fila
pendente (`fila-pendencias.tsx`) não foi aberta num navegador real.

## Agenda, valor por litro e OCR (2026-07-07)

Quatro pedidos do usuário, sem relação com a auditoria anterior:

- ✅ **Agenda de abastecimentos (feature nova).** `/agenda`
  (`app/(escritorio)/agenda/page.tsx`): calendário mensal (grade fixa de 6
  semanas, `lib/dashboard/agenda.ts` — função pura, testada em
  `agenda.test.ts`, 12 casos), cada dia com um badge de contagem; clicar num
  dia mostra abaixo TODOS os abastecimentos daquele dia com todos os campos
  (litros, valor total, valor/litro, KM, KM rodado, consumo, posto,
  bandeira, forma de pagamento, nº da nota, motorista, veículo). Filtro
  opcional por veículo (`components/escritorio/filtro-veiculo-agenda.tsx`,
  reaproveitando o combobox `SelectBusca` já existente). Setas ← → navegam
  entre meses preservando o filtro de veículo. Link novo no menu lateral.
  **Importante sobre "tempo real"**: a agenda não usa nenhum mecanismo de
  push/websocket — mesmo padrão do resto do escritório (Server Component,
  busca fresca a cada carregamento de página). Um abastecimento novo aparece
  assim que alguém (re)carrega `/agenda`, não instantaneamente na tela de
  quem já está com ela aberta. Isso é consistente com o resto do app (não
  existe real-time em nenhuma outra tela) — implementar push exigiria
  Supabase Realtime, fora do escopo pedido.
- ✅ **Valor por litro ausente na confirmação (bug de UI).** O Gemini já
  extraía `valor_litro` desde a Fase 4 (`lib/ocr/provider.ts`), mas o valor
  nunca chegava a `ValoresFormulario` nem à tela — ficava descartado
  silenciosamente depois do OCR. Em vez de plumbar o campo extraído (que
  poderia divergir do que o motorista digitasse depois), `passo-formulario.tsx`
  agora CALCULA e mostra "Valor por litro" ao vivo (`valorTotal / litros`),
  sempre consistente com o que está nos dois campos naquele instante —
  inclusive se o motorista corrigir litros ou valor total manualmente. Não
  é um campo novo do banco nem do schema, só um derivado de exibição (mesmo
  espírito do `consumo_kml` já ser uma coluna gerada).
- ✅ **OCR mais confiável (schema estruturado + prompt v2).**
  `lib/ocr/gemini-provider.ts`: adicionado `responseSchema` (JSON Schema
  espelhando `dadosExtraidosSchema`, com `required` em todos os campos) —
  força o Gemini a devolver o TIPO certo em cada campo (número nunca vem
  como string "12,50 L"), o que deveria reduzir os casos de
  `zod.safeParse` falhando em foto nítida só por causa do tipo errado ou de
  uma chave ausente. `temperature: 0.1` (antes usava o default do modelo,
  mais alto) — isto é extração determinística de um dado que já está na
  imagem, não geração criativa; temperatura mais baixa deveria reduzir
  "chute" em texto ambíguo. Novo prompt `extrair-abastecimento.v2.ts`
  (v1 preservado, nunca editado — mesmo espírito de "não editar migrations
  antigas": abastecimentos antigos guardam `ocr_prompt_version` e continuam
  rastreáveis ao texto exato que os gerou): reforça a conversão de vírgula
  brasileira pra ponto decimal, e lista os rótulos comuns de cada campo em
  cupom brasileiro (ex.: "V.UNIT"/"PREÇO UNIT" pra valor_litro, "COO"/"NFC-e
  Nº" pra numero_nota) — a hipótese é que parte das fotos nítidas que
  falhavam simplesmente usavam um rótulo que o prompt v1 não mencionava.
- ✅ **OCR mais rápido (comprimir antes de enviar).** O maior suspeito de
  lentidão: `handleContinuarFoto` (`fluxo-abastecimento.tsx`) mandava a foto
  ORIGINAL da câmera (tipicamente vários MB) sem nenhuma compressão pro
  `/api/ocr` — só o caminho de gravação final comprimia
  (`comprimirImagem()`, já existente). Agora a foto é comprimida
  (1600px/0.85 — mais generosa que o 1280/0.75 usado pra gravação final, pra
  não perder nitidez de texto miúdo do cupom) antes do envio pro OCR. Em
  rede móvel, upload de um arquivo 80-90% menor deveria ser o ganho de tempo
  dominante — bem maior que qualquer ajuste no processamento do Gemini em
  si, que esta versão do SDK (`@google/generative-ai`, já deprecado pelo
  Google em favor de `@google/genai`) não dá controle fino sobre (não expõe
  `thinkingConfig` pra desligar "raciocínio" do modelo, se for isso que o
  "gemini-flash-latest" atual usa por baixo).

**Verificado**: `npm test` — 101/101 passando (89 de antes + 12 novos de
`agenda.test.ts`); `tsc --noEmit`, `eslint .` e `npm run build` limpos,
incluindo a rota nova `/agenda` gerada sem erro. **Não verificado**:
nenhuma chamada real ao Gemini foi feita (exigiria consumir cota de
produção) — a melhora de velocidade/precisão do OCR é uma hipótese bem
fundamentada (tamanho de payload, schema estruturado, temperatura,
prompt mais específico), não um número medido antes/depois. A tela
`/agenda` não foi aberta num navegador real. Se a lentidão do Gemini
persistir depois disso, o próximo passo seria migrar pro SDK novo
(`@google/genai`) pra poder desligar `thinkingConfig` explicitamente — não
foi feito agora por ser uma troca de dependência maior, fora do escopo deste
pedido.

## Valor por litro editável (2026-07-07, feedback do usuário em produção)

O usuário testou o item anterior ("valor por litro" calculado ao vivo,
somente leitura) e reportou que não conseguia CORRIGIR o valor quando
estava errado — sendo só a divisão de litros/valor_total, editá-lo exigia
adivinhar qual dos dois campos mexer, em vez de corrigir o valor que
realmente estava errado no cupom.

- ✅ **Campo próprio, editável, igual aos outros.** Nova coluna
  `abastecimentos.valor_litro` (`0013_abastecimentos_valor_litro.sql` —
  numeric(8,3), nullable, sem regra de consistência com litros×valor_total,
  mesmo corte de escopo da 0001_init.sql). `abastecimentoSchema` validou
  como opcional/positivo. `PassoFormulario` trocou o parágrafo somente-leitura
  por um `Input` de verdade (`valorLitro` em `ValoresFormulario`). No wizard:
  pré-preenchido com o `valor_litro` que a IA extraiu quando disponível;
  se a IA não leu esse campo específico (só litros/valor_total), calcula um
  palpite inicial — mas o motorista pode editar livremente dali, exatamente
  como qualquer outro campo pré-preenchido pela IA. Enviado em
  `/api/abastecimentos` e persistido. Agenda (`/agenda`) atualizada pra
  mostrar o valor real gravado, caindo pro cálculo só em registros antigos
  (de antes desta coluna existir) que não têm o dado.
- Migration **aplicada no projeto Supabase real** via `supabase db push
  --linked` (não manual desta vez) — já entra registrada certinha no
  histórico de migrations, sem precisar de `migration repair` depois.
  Confirmado via `supabase db query --linked` contra
  `information_schema.columns`. `types/database.ts` regenerado
  (`supabase gen types typescript --linked`) e reconciliado à mão com a
  seção de aliases de conveniência mantida no fim do arquivo (não gerada,
  preservada por cima — ver comentário no próprio arquivo).

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. **Não verificado**: nenhum teste real no wizard
(foto real, corrigir o valor por litro manualmente e conferir o que fica
gravado) — só passou pelos checks estáticos.

## PIN de segurança + exclusão de abastecimento (2026-07-07)

Pedido do usuário: mesmo padrão do LuckFrota (produto irmão) — PIN de 6
dígitos exigido pra exportar Excel/PDF/ZIP, e nova capacidade de excluir um
abastecimento, também só com PIN.

- **Diferença deliberada em relação ao LuckFrota**: lá o PIN fica em texto
  puro em `profiles.pin_acesso` e a comparação roda no client (o perfil
  inteiro, PIN incluso, já chega no navegador). Aqui o hash é gerado com
  salt (`scrypt`, `lib/auth/pin.ts`) e a verificação SEMPRE roda no
  servidor — nunca pela sessão do usuário, porque a policy `usuarios_select`
  (0001) libera ler colegas da mesma empresa; se `pin_hash` fosse lido pelo
  client autenticado, qualquer colega poderia ler o hash de qualquer outro
  só trocando o `id` na query. O LuckTank já era construído em cima de
  "nunca confiar no client" (RLS + Server Actions em todo canto) — replicar
  a comparação client-side do LuckFrota teria sido inconsistente com o
  resto do próprio projeto.
- **PIN por usuário** (não por empresa): cada um define o seu, mesmo modelo
  do LuckFrota. Sem PIN definido, as ações protegidas ficam bloqueadas até
  configurar (decisão: não deixar passar batido só porque ninguém configurou
  ainda — o pedido foi "vai precisar desse pin", não "se tiver configurado").
- ✅ **Migration `0014_usuarios_pin.sql`**: `usuarios.pin_hash text`
  (nullable). Aplicada via `supabase db push --linked` e confirmada
  (`information_schema.columns`); `types/database.ts` regenerado.
- ✅ **`lib/auth/pin.ts`**: hash com `scrypt` (nativo do Node, sem
  dependência nova) + salt aleatório por usuário; comparação com
  `timingSafeEqual` (não `===`, que vaza timing). Único lugar do projeto que
  lê `pin_hash`, sempre via service role.
- ✅ **Configurações**: novo card "PIN de segurança" (`components/escritorio/pin-form.tsx`
  + `definirPin`/`temPinDefinido` em `configuracoes/actions.ts`) — cada
  usuário só define o PRÓPRIO PIN (a policy `usuarios_update` da 0003 exige
  administrador; "definir meu PIN" precisa valer pra qualquer papel, então a
  escrita usa service role com a checagem "é o próprio usuário" feita no
  código, não pela policy).
- ✅ **Contexto de desbloqueio** (`components/escritorio/pin-context.tsx` +
  `modal-pin.tsx`, montado em `app/(escritorio)/layout.tsx`): pede o PIN uma
  vez, guarda em memória (nunca localStorage/cookie) e reusa nas próximas
  ações protegidas da mesma sessão de navegador — mesma UX do LuckFrota
  ("digite uma vez, vale até sair"), mas o valor guardado é reenviado a cada
  ação pro servidor reverificar de verdade, nunca um booleano em que o
  servidor simplesmente confia. Limpo no logout (`LogoutButton` chama
  `bloquear()` antes de `signOut()`).
- ✅ **Export protegido**: os botões de Excel/PDF/ZIP (dashboard e aba do
  ônibus) trocaram de `<a href>` puro pra `components/escritorio/link-exportacao-protegida.tsx`
  — precisa ser um clique em JS, não navegação direta, porque o PIN vai num
  header (`x-lucktank-pin`), nunca na query string (senão ficaria gravado em
  histórico do navegador/logs de acesso). Busca o arquivo via `fetch`, monta
  um blob e simula o clique num `<a>` temporário pra disparar o download.
  `/api/export` e `/api/export/fotos` reverificam o PIN no servidor
  (`verificarPinDoUsuario`) antes de gerar qualquer arquivo — nunca confiam
  que o modal já validou antes de chamar.
- ✅ **Exclusão de abastecimento** (novo): botão "Excluir" por linha no
  histórico da aba do ônibus (`components/escritorio/botao-excluir-abastecimento.tsx`),
  só visível pra gerente/administrador (mesma regra de
  `alternarAtivoVeiculo`). Confirmação nativa (`window.confirm`) antes do
  PIN. `excluirAbastecimento` (`onibus/actions.ts`) segue o invariante #4:
  checa papel, checa PIN, usa service role (a policy de RLS de
  abastecimentos não libera UPDATE pra client autenticado desde a 0006, de
  propósito), soft delete (`status = 'excluido'`, usando as colunas
  `excluido_por`/`excluido_em` que já existiam desde a 0001 mas nunca tinham
  sido usadas), grava em `edicoes_log`. **Efeito colateral tratado**: como
  `veiculos.km_atual` só é setado pelo trigger de INSERT, excluir o
  abastecimento mais recente de um veículo não reverte isso sozinho —
  `excluirAbastecimento` recalcula `km_atual` a partir do abastecimento
  ativo mais recente que sobrar (fica como estava se não sobrar nenhum, por
  não haver um valor "original" registrado em lugar nenhum pra restaurar).

**Verificado inicialmente**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos; migration aplicada e coluna confirmada no projeto
real; histórico de migrations sincronizado (`supabase migration list`).

### Teste real no navegador (2026-07-07, mesmo dia)

Rodado contra `npm run dev` local, apontando pro MESMO projeto Supabase
real (não um banco de teste separado) — logado como o administrador de
verdade da Expresso Mundial.

- ✅ **Login, dashboard, aba do ônibus, Agenda, Alertas** — todos renderizam
  com dados reais, sem erro nenhum no log do servidor (nenhum 500 em toda a
  sessão).
- ✅ **Criar PIN** em Configurações — mensagem muda corretamente de "você
  ainda não configurou" pra "você já tem um PIN configurado".
- ✅ **Export Excel/PDF/ZIP com PIN**: bloqueado sem PIN (mensagem "PIN
  incorreto" — ver nit abaixo), desbloqueado com o PIN certo, arquivo
  confirmado válido nos 3 formatos (`file`/`unzip` na máquina real, não só
  "download não deu erro"). PIN reaproveitado em cliques seguintes na mesma
  sessão de navegador, sem re-pedir. **Nota sobre o ZIP**: nas duas
  primeiras tentativas o arquivo pareceu não ter baixado (nem no log nem no
  disco, checado cedo demais) — era só demora real de baixar várias fotos
  do Storage; os 3 ZIPs apareceram alguns segundos depois, todos válidos e
  com o número certo de arquivos. Não é bug, é o tempo de espera não ter
  sido dado antes de checar.
- ✅ **Exclusão de abastecimento**: criado um abastecimento de teste real
  via `/api/abastecimentos` (mesmo endpoint do motorista — o upload de foto
  real pela UI automatizada não foi possível neste ambiente, mas a foto é
  opcional na API), disparou alerta de consumo corretamente (motor de
  fraude confirmado funcionando em produção), excluído pela tela com PIN —
  confirmado no banco: `status = 'excluido'`, `excluido_por`/`excluido_em`
  gravados, `edicoes_log` com `acao: delete`, e `veiculos.km_atual`
  recalculado de volta pro valor correto (160000, não ficou preso em
  160100). Dado de teste removido do banco depois (linha e alertas).
- 🔴 **Bug real encontrado e corrigido**: excluir um abastecimento não
  resolvia os alertas gerados por ele — ficavam pendentes pra sempre em
  `/alertas`, sem indicação nenhuma de que o registro que os originou já
  tinha sido excluído (confirmado: os 2 alertas do abastecimento de teste
  continuaram `resolvido: false` depois da exclusão). Corrigido em
  `excluirAbastecimento` (`onibus/actions.ts`): agora resolve automaticamente
  qualquer alerta pendente da entidade excluída (mesmo raciocínio de
  `resolverAlerta` — não é edição de dado de negócio, não passa por
  `edicoes_log`). Os 2 alertas órfãos já existentes foram limpos
  manualmente no banco antes do dado de teste ser removido.
- **Nit não corrigido**: a mensagem do modal de PIN é sempre "PIN
  incorreto", mesmo quando a causa real é "você nunca configurou um PIN"
  (testado sem PIN configurado ainda). Funcionalmente correto (bloqueia do
  mesmo jeito), só a mensagem podia ser mais precisa nesse caso específico
  — não corrigido agora por ser cosmético, fica registrado caso valha a
  pena ajustar depois.

`npm test` (101/101), `tsc`, `eslint`, `npm run build` limpos de novo depois
do fix dos alertas órfãos.

## Cadastro centralizado no LuckTank (2026-07-07, mudança de modelo de negócio)

Contexto: modelo de venda é direto e manual (contrato pessoal, R$1000/ano,
onboarding feito pela própria dona do produto). A partir desta mudança, uma
empresa cliente **não gerencia mais a própria estrutura** — só usa o
sistema no dia a dia (motoristas abastecendo, escritório acompanhando
dashboard/agenda/alertas). Cadastro de veículo e de usuário novo viraram
ferramentas exclusivas do dono do sistema.

- ✅ **"Convidar usuário" saiu de Configurações.** `convidarUsuario`
  removido de `configuracoes/actions.ts`; card removido de
  `configuracoes/page.tsx` (texto novo: "fale com o suporte"); componente
  `convidar-usuario-form.tsx` apagado (não só desconectado). **Não mexeu**
  em `/definir-senha` nem no mecanismo de convite por e-mail do Supabase
  Auth — são compartilhados com `criarEmpresa` (usado pela própria dona pra
  onboardar cliente novo), então continuam existindo, só que agora só
  acionados a partir de `admin-sistema`.
- ✅ **Substituto em `admin-sistema`**: `convidarUsuarioParaEmpresa` (nova
  action) + `ConvidarUsuarioEmpresaForm` — mesmo mecanismo de convite, só
  que com um seletor de EMPRESA (a empresa já existe, diferente de
  `criarEmpresa` que cria tenant novo). Restrito a `ehDonoSistema`.
- ✅ **"Novo veículo" saiu da aba Ônibus.** Botão removido de `onibus/page.tsx`;
  rota `/onibus/novo` apagada inteira; `criarVeiculo` removido de
  `onibus/actions.ts`. **Edição de veículo já cadastrado não mudou** —
  `atualizarVeiculo` continua liberado pra gerente/administrador da própria
  empresa (só cadastro NOVO ficou restrito). `VeiculoForm` simplificado pra
  só editar (o modo "criar" que ele tinha morreu junto com `/onibus/novo` —
  removido de vez, não deixado morto no código).
- ✅ **Substituto em `admin-sistema`**: `criarVeiculoParaEmpresa` (nova
  action) + `CriarVeiculoEmpresaForm` — mesmos campos de `VeiculoForm`,
  **sem upload de foto** (o bucket `fotos-veiculos` é isolado por sessão da
  própria empresa; o dono do sistema agindo fora de qualquer empresa não
  teria essa sessão — se o cliente quiser foto, edita depois pela própria
  conta). Restrito a `ehDonoSistema`.
- ✅ **Nenhuma das duas novas actions grava em `edicoes_log`** — mesmo
  motivo de `criarEmpresa` já não gravar: `edicoes_log.usuario_id` tem FK
  pra `usuarios(id)`, e o dono do sistema normalmente não tem linha própria
  na tabela `usuarios` das empresas que ele não administra. Logar com o id
  dele seria uma FK tecnicamente válida mas atribuiria a ação à pessoa
  errada.
- ✅ **Motivo de negócio por trás da mudança** (registrado aqui pra não se
  perder): sem essa restrição, uma empresa cliente podia cadastrar veículos
  de OUTRA empresa (que não pagou nada) na própria conta — like "emprestar"
  o contrato pra terceiros. Com só o LuckTank cadastrando, isso fica
  fechado.
- ✅ **E-mail e WhatsApp de contato atualizados** em `/privacidade` e
  `/termos`: `luckfrotas@gmail.com` · (13) 99770-0901.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. Testado no navegador (dev local): "Novo veículo"
confirmado ausente da aba Ônibus (km_atual do veículo de teste continua
160000, sem regressão); "Convidar usuário" confirmado ausente de
Configurações, com o texto novo no lugar; `/admin-sistema` confirmado
bloqueando corretamente uma conta que não é dona do sistema (o gate de
acesso continua funcionando). **Não verificado**: os dois formulários
novos (`ConvidarUsuarioEmpresaForm`, `CriarVeiculoEmpresaForm`) nunca foram
abertos num navegador de verdade — não há credencial de dono do sistema
disponível nesta sessão pra testar. Passaram por `tsc`/`eslint`/`build`,
não por uso real ainda.

## "Ônibus" → "Veículos" no texto da interface (2026-07-07)

Pedido comercial (análise de venda): a marca inteira falava "Ônibus" no
menu/telas mesmo o banco já sendo genérico (qualquer tipo de combustível,
sem coluna nenhuma específica de ônibus). Isso fechava a porta pra vender
pra transportadora de carga/utilitário sem nem abrir a conversa.

- ✅ Texto trocado onde aparecia pro usuário: menu lateral ("Ônibus" →
  "Veículos"), título da aba, gráfico do dashboard ("Consumo médio por
  veículo"), coluna da ficha do motorista, texto de ajuda do formulário de
  veículo, instrução impressa na etiqueta do motorista ("KM atual do
  veículo"). Emoji do estado vazio trocado de 🚌 pra 🚚.
- ✅ **Rotas (`/onibus/...`) e o módulo `lib/onibus/` NÃO foram renomeados**
  — decisão deliberada: motorista nunca vê essa URL (usa `/r/<qr_token>`),
  escritório nunca digita a URL na mão (só clica no menu), então renomear
  rota/pasta seria um refactor bem maior (toda `revalidatePath`, todo
  import, rename de pasta) sem ganho nenhum a mais pro cliente — o que
  importa pra venda é o texto visível, não a URL interna.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. Testado no navegador local: menu e título da tela
confirmados mostrando "Veículos".

## Conta de demonstração + página pública em "/" (2026-07-07)

Pedido comercial: material pra usar em reunião de venda, sem gastar nada
novo.

- ✅ **Empresa "Frota Demonstração"** criada no projeto Supabase real (não
  um ambiente separado — não existe staging): 3 veículos (prefixos
  2201/2202/2203), 2 motoristas, ~29 abastecimentos distribuídos nos
  últimos 30 dias com litros/km/preço realistas, e 2 anomalias
  deliberadas (nota fiscal duplicada + litros acima da capacidade do
  tanque) já geradas como alertas críticos pendentes — pra já abrir
  `/alertas` numa reunião e mostrar o sistema pegando fraude de verdade,
  sem precisar simular nada ao vivo. Login:
  `demo@lucktank.com.br` — **senha só passada no chat com o usuário,
  nunca escrita aqui nem versionada** (mesmo cuidado já usado desde a
  Fase 2 com a senha do primeiro administrador real).
  Semeado via script único (`_seed-demo-temp.mjs`, na raiz do projeto,
  **apagado logo depois de rodar** — não é parte do app, não deveria
  voltar a existir no repo).
- ✅ **Página pública em `/`** (`app/page.tsx`): antes era só um
  `redirect("/login")` puro (Fase 8, Bloco 4). Virou uma página de
  apresentação de verdade — hero, "mockup" da tela do dashboard (mesmas
  classes de cor do dashboard real, não é screenshot), 4 cards de
  proposta de valor, um card de alerta crítico de exemplo, "como
  funciona" em 3 passos, preço (R$ 1.000/ano) com CTA de WhatsApp
  ((13) 99770-0901, link `wa.me` com mensagem pré-preenchida) e e-mail
  (`luckfrotas@gmail.com`), rodapé com link pra `/privacidade`/`/termos`.
  Detecta sessão ativa: se já estiver logado, o botão do topo vira "Ir
  para o Dashboard" em vez de "Entrar" — não força redirect, só troca o
  CTA.
- ✅ **Nenhum gasto novo**: sem domínio customizado, sem serviço de
  imagem/hospedagem extra — os "screenshots" da página são recriados em
  HTML/CSS com as mesmas classes Tailwind do app de verdade.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. Testado no navegador contra produção
(`luck-tank.vercel.app`): login na conta demo confirmado funcionando,
dashboard populado, `/alertas` mostrando os 2 críticos, `/onibus` com os
3 veículos — tudo com dado real (fake), não mockado na tela. Página `/`
testada em dev local, os dois estados (logado/deslogado) confirmados.

## Cadastro de veículo em lote (2026-07-07)

Depois de centralizar o cadastro de veículo no dono do sistema, cadastrar
veículo virou trabalho manual repetitivo pra ela mesma em todo onboarding
de cliente novo. Item pra economizar esse tempo (o gargalo real do
modelo de negócio, não o cliente).

- ✅ **`criarVeiculosEmLote`** (`admin-sistema/actions.ts`) +
  `CriarVeiculosLoteForm`: cola uma lista copiada de planilha (uma linha
  por veículo — placa, prefixo, modelo, marca, ano, separados por TAB ou
  vírgula), valida e cadastra cada linha separadamente. Só a placa é
  obrigatória. **Nunca falha tudo por causa de uma linha ruim** — resultado
  parcial (X cadastrados, lista de erro por linha com o motivo exato:
  placa inválida, placa duplicada, etc.), não tudo-ou-nada. Capacidade de
  tanque/combustível/consumo de referência ficam de fora do lote de
  propósito (menos comum saber "de cabeça" pra frota inteira) — entram no
  cadastro individual depois, que a própria empresa cliente já pode
  editar.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. Lógica de parsing (TAB, vírgula, placa sozinha,
minúsculo) validada isoladamente com `node -e` fora do navegador.

**Testado de verdade no navegador** (sessão seguinte, a pedido do
usuário): sem credencial real de dono do sistema disponível, adicionado
temporariamente o e-mail da conta de demonstração
(`demo@lucktank.com.br`) em `DONO_SISTEMA_EMAILS` — só no `.env.local`
(nunca commitado, nunca afetou produção), revertido logo depois do
teste. Colado um lote de 4 linhas (2 válidas, 1 com placa curta demais,
1 duplicando a placa da primeira) na empresa "Frota Demonstração":
resultado "2 veículo(s) cadastrado(s)" + as duas mensagens de erro
corretas por linha ("Placa muito curta" / "Já existe um veículo com
essa placa nesta empresa"), confirmado depois na aba Veículos que só os
2 válidos foram criados. Os 2 veículos de teste removidos do banco em
seguida.

## Notificação por e-mail de alerta crítico — adiada (2026-07-07)

Considerada, não implementada. Hoje um alerta crítico só aparece se
alguém entrar em `/alertas` — sem notificação nenhuma, uma fraude pode
ficar dias sem ninguém perceber mesmo já detectada. Ficou de fora desta
rodada por decisão do usuário ("vamos pular isso"), não por limitação
técnica.

Contexto pra retomar depois: exigiria um serviço de e-mail transacional
(cotado Resend, camada grátis de 3.000 e-mails/mês). Pra mandar direto
pro administrador de cada empresa cliente (em vez de só pra
`luckfrotas@gmail.com`), precisa verificar um domínio de verdade no
Resend — o usuário tem `luckfrotas.com.br` disponível pra isso, mas a
verificação (adicionar registros DNS onde o domínio foi registrado) não
foi concluída nesta sessão. Nenhuma conta foi criada, nenhuma env var
foi adicionada, nenhum código foi escrito.

## Auditoria adversarial de segurança (2026-07-07)

A pedido do usuário ("trabalhe como um hacker... tente invadir meu
sistema, não invada realmente"): revisão ofensiva-mas-defensiva do
sistema inteiro, sem exploração real contra produção, achados corrigidos
na mesma sessão.

**Achado 1 — PIN sem rate limit.** `verificarPinDoUsuario`
(`lib/auth/pin.ts`) é o único ponto de leitura/comparação de
`usuarios.pin_hash` no projeto, usado pelas 3 ações protegidas por PIN
(exclusão de abastecimento, export Excel/PDF, export de fotos em ZIP) —
mas nada limitava quantas vezes um PIN podia ser tentado. Um atacante com
uma sessão válida (roubada, ou computador destravado) podia tentar força
bruta as 1.000.000 de combinações de um PIN de 6 dígitos sem nenhum
throttling, esvaziando o propósito do PIN como segunda camada contra
sessão comprometida. Corrigido adicionando `limitarPin` em
`lib/rate-limit.ts` (5 tentativas / 5 min, chave por `usuarioId` — não
por IP, porque o atacante relevante aqui já tem sessão, então trocar de
rede não pode resetar a contagem) e chamando de dentro do próprio
`verificarPinDoUsuario`, garantindo que as 3 call sites fiquem protegidas
automaticamente sem precisar lembrar de aplicar em cada uma. Estourar o
limite retorna `false` — igual a PIN errado, nunca revela ao chamador que
o motivo foi rate limit (evita dar pista extra pra quem tenta adivinhar).

**Achado 2 — nome de arquivo do client controlava chave no Storage e
header HTTP.** `/api/abastecimentos` (endpoint público, sem sessão —
usado pelo motorista via QR) construía a chave do Storage como
`${empresa_id}/${veiculo_id}/${registro_uuid}-${foto.name}`, usando
`foto.name` — o nome de arquivo declarado no FormData multipart, portanto
totalmente controlável por quem chama o endpoint direto (curl, script),
sem passar pela compressão/nome sanitizado que o client legítimo gera.
Esse valor seguia sem sanitização até `/api/midias/[id]`, que monta
`Content-Disposition: attachment; filename="${nomeArquivo}"` a partir do
mesmo caminho — ou seja, um campo nunca confiável alimentando um header
HTTP. Corrigido descartando `foto.name` inteiramente: a chave agora usa só
`registro_uuid` (já validado como UUID pelo schema) + uma extensão de uma
lista fechada (`extensaoSeguraFoto`, baseada no `foto.type` mas mapeada
pra um conjunto pequeno e conhecido, nunca repassando o valor cru).

**Achado 3 — zero security headers.** `next.config.mjs` não configurava
nenhum header de segurança. Adicionado CSP (escopada só ao que o app
realmente usa: self + Supabase, sem terceiros soltos), `X-Frame-Options:
DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy` (geolocalização desabilitada, coerente com a regra
de negócio de não mexer com GPS) e HSTS. Testado em build de produção
real (`next build` + `next start`, não só `next dev` — Fast Refresh do
dev mode usa `eval()`, que a CSP bloqueia de propósito, então testar só
em dev geraria um falso positivo): dashboard com gráficos Recharts,
listagem/detalhe de veículo, geração de QR (SVG/PNG) e o fluxo completo
do motorista em `/r/[qrToken]` — todos carregando sem nenhum erro de CSP
no console.

**Descartado por baixo risco prático**: `npm audit` aponta 14 CVEs em
`next@14.2.35` (já a última patch da série 14.2.x — corrigir de verdade
exige pular pra 14→16, uma mudança maior demais pra forçar nesta sessão)
e uma CVE moderada em `uuid`. Nenhuma delas se aplica de fato ao uso real
deste app: as CVEs de `next` cobrem `next/image` (o app usa `<img>` puro),
upgrade de WebSocket (não usado), i18n do Pages Router (app é só App
Router) e nonce de CSP em `next/script` (não usado) — o risco residual
real é da classe DoS/cache-poisoning, não vazamento de dado. A CVE de
`uuid` é sobre `v3`/`v5`/`v6` com buffer fornecido pelo caller;
confirmado por leitura do código-fonte que `exceljs` (única dependência
que usa `uuid` neste projeto) só chama `v4()`, função não afetada —
não-exploitável na prática, independente da versão.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. CSP testada ao vivo contra build de produção
(`next start`), não só `next dev`.

## Data de renovação por empresa + argumento de ROI na landing (2026-07-07)

Dois itens de custo zero de uma análise de "o que mais falta pra vender
por R$ 1.000/ano", escolhidos por serem os de menor esforço/maior efeito
pro momento atual do negócio (poucos clientes, venda pessoal).

**Data de renovação.** `empresas.proxima_renovacao` (migration 0015, date
nullable — empresa nova não tem renovação marcada ainda). Editável inline
em `/admin-sistema` (`RenovacaoEmpresaEditor`, `atualizarProximaRenovacao`
em `admin-sistema/actions.ts`, gate `ehDonoSistema` igual ao resto da
página) com badge de status calculado no client a partir da data (vencida
/ vence em ≤30 dias / em dia) — mesmos tokens semânticos de cor
(critico/atencao/sucesso) do resto do app. Só um lembrete visual pro dono
do sistema; não bloqueia nada no acesso do cliente (cobrança continua
manual, fora do sistema).

**Argumento de ROI.** Seção nova em `app/page.tsx`, entre o mockup de
alerta e "Como funciona": liga o exemplo de alerta já mostrado (nota
duplicada) a um cálculo simples e honesto — 4 fraudes do tamanho de um
abastecimento médio (~R$ 280) ao longo do ano já cobrem o valor da
assinatura. Número redondo, não promessa de economia garantida.

**Testado ao vivo** (build de produção, `next start`): landing carrega a
seção de ROI corretamente; `/admin-sistema` com elevação temporária de
`DONO_SISTEMA_EMAILS` (revertida logo depois, mesmo padrão de sempre)
confirmou os 3 estados do badge (vencida, vence em breve, em dia) e o
fluxo de editar/salvar/cancelar. Dados de teste (`proxima_renovacao` nas
empresas de demonstração) limpos via script depois do teste.

**Verificado**: `npm test` (101/101), `tsc --noEmit`, `eslint .` e
`npm run build` limpos. Migration aplicada em produção via
`supabase db push --linked`; `types/database.ts` regerado via
`supabase gen types typescript --linked`.

## Redesign da landing page + planos por periodicidade (2026-07-08)

Três pedidos do usuário sobre `app/page.tsx` (a página pública de vendas em
"/", criada em 2026-07-07): visual mais rico, tirar o preço fixo, corrigir o
botão que ia direto pro dashboard.

- ✅ **Visual mais rico, sem pesar o bundle.** Referência visual lida direto
  de `C:\Users\User\Desktop\luckfrota\src\pages\LandingPage.jsx` (produto
  irmão) — usados como inspiração: blobs de gradiente com blur no fundo,
  grid pattern sutil, mockup do dashboard dentro de uma "janela de
  navegador" (barra com 3 bolinhas + URL fake), cards flutuantes decorativos
  sobre o mockup, ícone por card de valor, círculo numerado + linha
  conectora nos 3 passos de "como funciona". **Não copiados do LuckFrota**:
  números fabricados ("500+ transportadores", "50.000+ viagens") e
  depoimentos de clientes fictícios — LuckTank tem 1 cliente piloto real
  (Expresso Mundial); inventar prova social seria mentira, então essa parte
  da referência foi descartada de propósito. Nova dependência
  `lucide-react` (mesma versão usada no LuckFrota, `^0.323.0`) — ícones SVG
  tree-shaken, sem custo de runtime. `tailwind.config.ts` ganhou 2 keyframes
  novos (`float`, `fadeInUp`) — só CSS, sem JavaScript de scroll/observer.
  **A página continua um Server Component puro** (nenhum `"use client"`
  novo) — toda a riqueza visual é CSS/Tailwind + SVG estático, então o
  bundle da rota "/" não engordou de verdade: **181 B / 96,2 kB** de First
  Load JS depois do redesign (antes: 138 B / 87,5 kB — a diferença é o
  bundle do ícone, não JS de interação).
- ✅ **Preço fixo removido, seção de periodicidade no lugar.** A seção
  "Plano único — R$ 1.000/ano" virou "Formas de pagamento": 4 cards (Mensal,
  Trimestral, Semestral, Anual — sem nenhum valor em R$, só a cadência),
  card Anual com badge "Mais econômico" (sem número, só indica que existe
  desconto na conversa de venda). Abaixo, um card de destaque com o texto
  pedido pelo usuário: "Assim que fecharmos, sua conta já está pronta — a
  gente cadastra os veículos, gera os QR Codes e cria os acessos do seu
  escritório antes de você perguntar. Você só chega e usa — e ensinamos
  exatamente tudo que precisar, no seu ritmo." CTA "Pedir uma proposta"
  (WhatsApp) no lugar de "Falar no WhatsApp" genérico, reforçando que o
  valor é negociado por conversa, não uma tabela fixa. O parágrafo de ROI
  (seção separada, "por que isso se paga sozinho") foi mantido — ele cita
  "R$ 280" (ticket médio de abastecimento) e "cobre o valor da assinatura",
  mas nunca menciona a mensalidade em si, então não conflita com o pedido
  de tirar o preço fixo.
- ✅ **Botão do cabeçalho sempre manda pro login.** Antes: `Link href={user
  ? "/dashboard" : "/login"}` — se a sessão do Supabase estivesse ativa no
  navegador, o botão virava "Ir para o Dashboard" e pulava a tela de login.
  O usuário reportou que isso estava acontecendo e pediu pra sempre passar
  pelo login primeiro. Removida a checagem de sessão inteira (o
  `createClient()` + `getUser()` que existia só pra essa decisão) — a
  página deixou de precisar ser `async`, o botão é estático `<Link
  href="/login">Entrar</Link>`, sem branch nenhuma. **Validado no
  navegador** (`npm run dev`): clique no botão leva direto pro formulário
  de login (`/login`), independente de estado de sessão — não há mais
  caminho que pule a tela de login a partir da página pública.

**Validado**: `tsc --noEmit`, `eslint`, `npm test` (101/101) e `npm run
build` limpos (rota `/` continua estática, `○`). **No navegador** (`npm run
dev`, Chrome automatizado): hero, mockup com cards flutuantes, os 4 cards de
valor, "como funciona" com a linha conectora, e a nova seção de planos —
todos renderizando como esperado, sem quebra de layout. Único item no
console foi o erro de CSP/`eval()` do Fast Refresh do modo dev, já
documentado como falso-positivo (só existe em `next dev`, não em produção —
ver "Auditoria adversarial de segurança").

## Login sem acesso + convite falhando + suspender/excluir conta (2026-07-08)

Sessão de suporte urgente: usuária relatou não conseguir logar com o e-mail
de dono do sistema, convite de empresa nova falhando ("Não foi possível
enviar o convite"), veículo não sendo cadastrado, e ausência total de um
jeito de suspender/excluir acesso de cliente.

- ✅ **Login com "senha incorreta" — causa raiz encontrada.** Diagnóstico
  (script read-only contra o Supabase real, sem mexer em nada) confirmou que
  as duas contas de dono do sistema (`luanabarassal123@gmail.com`,
  `luckfrotas@gmail.com`) **existem e estão confirmadas**, ambas concluíram
  o cadastro de senha em 2026-07-06 e nunca fizeram login de novo depois
  disso — ou seja, não é conta ausente nem convite não recebido, só senha
  esquecida. Não existe fluxo de "esqueci minha senha" na UI do LuckTank
  ainda (só o link de convite inicial) — resolvido dessa vez disparando
  manualmente `supabase.auth.resetPasswordForEmail()` pras duas contas
  (mesmo mecanismo/página `/definir-senha` já usada pro convite, só que com
  link de recuperação). **Considerar adicionar um link "Esqueci minha
  senha" de verdade em `/login`** se isso se repetir — não implementado
  ainda porque não foi pedido nesta sessão.
- ✅ **"Não foi possível enviar o convite" — causa raiz encontrada e é
  infraestrutura, não bug de código.** Reproduzido direto (convite de teste
  pra um e-mail descartável): Supabase devolveu **429 "email rate limit
  exceeded"**. O provedor de e-mail padrão do Supabase (sem SMTP próprio
  configurado) tem uma cota MUITO baixa (poucas mensagens por hora) — os 2
  e-mails de recuperação de senha enviados minutos antes (item acima) muito
  provavelmente já tinham consumido essa cota, explicando por que a criação
  de empresa nova falhou logo em seguida. **Ação recomendada pra não se
  repetir**: configurar um provedor de SMTP próprio no Supabase (Project
  Settings → Authentication → SMTP Settings) — Resend já tinha sido cotado
  antes (ver "Notificação por e-mail de alerta crítico — adiada") e resolve
  os dois casos de uma vez (esse rate limit E o e-mail de alerta crítico
  que ficou pendente). **Sem isso configurado, qualquer sequência de vários
  convites/recuperações de senha em pouco tempo vai voltar a esbarrar nessa
  cota.** Nenhum código foi alterado pra esse item — é configuração de
  infraestrutura, fora do escopo de uma mudança de código.
- ✅ **Suspender/reativar/excluir usuário — feature nova em
  `/admin-sistema`.** Não existia NENHUM jeito de cortar acesso de um
  cliente que parasse de pagar, nem de apagar uma conta — só cadastrar.
  Implementado em `admin-sistema/actions.ts` + novo componente
  `components/escritorio/usuarios-empresa-lista.tsx`:
  - `suspenderUsuario(usuarioId, suspender)` — usa o banimento nativo do
    Supabase Auth (`ban_duration: "87600h"` pra suspender, `"none"` pra
    reativar). Bloqueia login/renovação de sessão em nível de autenticação,
    **reversível a qualquer momento**, não toca em nenhum dado. Uma sessão
    já aberta no navegador pode demorar até ~1h pra cair de vez (tempo de
    expiração do access token atual) — login NOVO é bloqueado na hora.
  - `suspenderEmpresa(empresaId, suspender)` — mesma coisa, mas pra todos
    os usuários de uma empresa de uma vez (o caso mais comum: "esse cliente
    parou de pagar, corta tudo").
  - `excluirUsuario(usuarioId)` — exclusão de verdade (`auth.admin.deleteUser`,
    que cascade-deleta a linha em `usuarios` via a FK já existente desde a
    0001). **Achado importante durante a validação**: `edicoes_log.usuario_id`,
    `alertas.resolvido_por` e `abastecimentos.editado_por/excluido_por`
    referenciam `usuarios(id)` sem `on delete cascade`/`set null` — ou
    seja, o Postgres BLOQUEIA a exclusão de um usuário que já editou/excluiu
    algo ou resolveu um alerta (protegendo o invariante #4, trilha de
    auditoria não pode sumir). **Testado ao vivo que o erro que o Supabase
    devolve nesse caso vem VAZIO** (`{}`, sem `message` nenhuma) — a
    primeira versão do código tentava detectar isso lendo o texto do erro
    (`.includes("foreign key")`) e NUNCA funcionaria. Corrigido: a função
    agora consulta as 3 tabelas ANTES de tentar excluir e devolve uma
    mensagem clara ("use Suspender em vez de excluir") sem nem chamar
    `deleteUser` se encontrar qualquer rastro — reconfirmado com um teste
    isolado depois da correção.
  - UI: cada empresa em `/admin-sistema` agora lista seus usuários (nome,
    e-mail, papel, badge Ativo/Suspenso) com botões "Suspender/Reativar
    acesso" e "Excluir conta" por pessoa, mais dois botões em lote no rodapé
    do card ("Suspender/Reativar todos os acessos desta empresa"). Status
    de banimento vem de uma única chamada `admin.auth.admin.listUsers()`
    (não 1 chamada por usuário) cruzada por id com a lista de `usuarios`.
  - **Validado inteiramente por script isolado** contra empresa/usuários
    descartáveis (criados e removidos por completo ao final, confirmado por
    query independente que não sobrou nada): suspender bloqueia login
    (`"User is banned"`), reativar libera de novo, excluir funciona pra
    usuário sem histórico (cascade confirmado — linha em `usuarios` some
    junto), excluir é corretamente recusado pra usuário com uma linha em
    `edicoes_log` (e a mensagem de erro específica é a que aparece, não a
    genérica). **Não testado clicando de verdade na UI do navegador** —
    a sessão real da conta de demonstração já ativa no Chrome da usuária
    (fora do controle desta automação) atrapalhou o teste visual; a lógica
    do servidor foi validada 100% por fora, e a UI passou por
    `tsc`/`eslint`/`build` limpos.
  - **Decisão consciente**: não existe (ainda) exclusão de EMPRESA inteira
    (só de usuário individual) — dropar uma empresa cascade-apagaria todo o
    histórico de abastecimentos/alertas dela, o que contradiz o valor
    central do produto (trilha de auditoria). Suspender a empresa inteira
    (via `suspenderEmpresa`) cobre o caso de uso real ("cliente parou de
    pagar") sem esse risco. Ver "Cascade delete amplo a partir de empresas"
    na auditoria de 2026-07-07 — mesma decisão, reafirmada aqui.
- ⏸️ **Veículo não cadastrado — não reproduzido ainda.** Usuária reportou
  que tentou adicionar um veículo e "não apareceu erro nenhum, só não
  salvou" — não foi possível confirmar a causa por leitura de código (schema
  de validação revisado, nada suspeito). Hipótese mais provável: ela pode
  ter tentado durante a mesma janela em que o login/acesso ao
  `/admin-sistema` também estava com problema (mesma sessão de suporte),
  então o formulário pode nem ter chegado a renderizar de verdade. **Pedir
  pra ela tentar de novo** depois de resolver o login — se persistir,
  precisa do erro exato (ou dos logs do Vercel na hora da tentativa) pra
  diagnosticar.

**Verificado**: `tsc --noEmit`, `eslint` e `npm test` (101/101) limpos depois
da correção da checagem de FK; `npm run build` limpo (rota `/admin-sistema`
subiu de 5,21 kB pra 6,06 kB de bundle da página). Nenhuma migration nova —
tudo em cima do schema/Auth já existentes.

## Resend configurado + notificação por e-mail de alerta crítico (2026-07-08)

Continuação direta da sessão anterior ("Login sem acesso + convite falhando
+ suspender/excluir conta") — resolve a causa raiz do rate limit de e-mail
e implementa o item que tinha ficado adiado em 2026-07-07.

- ✅ **Domínio e conta do Resend configurados pela usuária.** Domínio
  usado: `luckfrotas.com.br` (raiz, não um subdomínio — o plano grátis do
  Resend só permite 1 domínio verificado por conta, e ela já tinha esse
  domínio verificado ali de antes por causa do LuckFrota; um subdomínio
  novo pediria upgrade pago, então a decisão foi usar o domínio raiz
  direto). `RESEND_API_KEY` adicionada ao `.env.local` (e precisa ser
  adicionada também nas env vars do Vercel em produção — **confirmar que
  isso foi feito**, não foi validado nesta sessão se já está lá).
  **Validado com envio real**: e-mail de teste via API do Resend direto
  (sem passar pelo Supabase) entregue com sucesso; convite real do
  Supabase (`inviteUserByEmail`) também funcionou sem cair no erro de rate
  limit de antes — confirma que o Custom SMTP do Supabase (configurado
  pela usuária em Authentication → Emails → SMTP Settings, host
  `smtp.resend.com`, porta 587, usuário `resend`, senha = chave da API)
  está de fato ativo e roteando pelo Resend.
- ✅ **Notificação por e-mail de alerta crítico — implementada.** Módulo
  novo `lib/email/`:
  - `cliente.ts` (`server-only`): `enviarEmail()`, POST direto pra API do
    Resend via `fetch` (sem SDK novo — é uma chamada só, mesmo espírito de
    `lib/gemini/client.ts`/`lib/rate-limit.ts` de usar a API do provedor
    direto). Remetente fixo `LuckTank <naoresponda@luckfrotas.com.br>`.
  - `conteudo-alerta.ts`: função PURA `montarEmailAlertaCritico()` (monta
    assunto/HTML a partir de dado já resolvido, sem I/O) — mesmo padrão de
    `lib/validacao/regras.ts`, testável isoladamente. Reaproveita
    `ROTULO_REGRA` (`lib/validacao/rotulos.ts`, já existente) pra traduzir
    o `tipo_regra` técnico pro texto legível que já aparece no painel de
    Alertas — nunca duplicou o mapeamento. 5 testes
    (`conteudo-alerta.test.ts`): singular/plural no assunto, tradução do
    rótulo, fallback pro código bruto quando não há rótulo mapeado, link do
    painel presente.
  - `notificar-alerta-critico.ts`: orquestra de verdade — busca todos os
    `usuarios` com `papel = 'administrador'` da empresa (service role),
    monta o e-mail e chama `enviarEmail()`. **Nunca lança** (try/catch
    interno, `console.error` em falha) — mesmo invariante #7 do motor de
    alertas ("nunca bloqueiam"): se o Resend cair, a `RESEND_API_KEY`
    sumir, ou a empresa não tiver nenhum administrador cadastrado, o
    abastecimento e o alerta já foram gravados antes desta função ser
    chamada, então uma falha aqui é só um e-mail a menos, nunca um dado
    perdido.
  - **Só dispara pra alertas nível `critico`** — info/atenção continuam só
    no painel (mesmo corte de "não incomodar à toa" já usado nas cores do
    painel de Alertas). Um e-mail só, mesmo se vários alertas críticos
    dispararem juntos no mesmo abastecimento (assunto já muda pra plural
    nesse caso).
  - `app/api/abastecimentos/route.ts`: a query de veículo ganhou
    `placa, prefixo` (precisava disso pra identificar o veículo no e-mail,
    via `formatarVeiculo()` já existente); `avaliarEGravarAlertas` chama
    `notificarAlertaCritico()` logo depois do insert dos alertas, filtrando
    só os de nível crítico.
  - **URL do painel de alertas fixa** (`https://luck-tank.vercel.app/alertas`)
    de propósito — diferente do `redirectTo` de convite (que usa
    `lib/url-atual.ts`, dinâmico por request), este e-mail não tem
    "request" nenhum de onde derivar o host (dispara a partir do fluxo do
    motorista, que não tem esse contexto de origem fazendo sentido usar) e
    o LuckTank só tem um deploy real.
  - **Achado durante a implementação**: o `@/` (alias do TypeScript/Next)
    não é resolvido pelo Vitest neste projeto (não há `vitest.config.ts`
    nem plugin de tsconfig-paths) — nenhum outro módulo *testado* até hoje
    importava outro módulo de `lib/` usando esse alias, então isso nunca
    tinha aparecido. `conteudo-alerta.ts` importa `rotulos.ts` por caminho
    relativo (`../validacao/rotulos`) por causa disso — se um teste novo
    algum dia precisar de um import cruzado entre pastas de `lib/`, usar
    caminho relativo, não `@/`.
  - **Validado ponta a ponta de verdade**: empresa + administrador + veículo
    descartáveis criados só pra este teste (removidos por completo depois,
    confirmado por query independente); abastecimento real enviado via
    `POST /api/abastecimentos` (o mesmo endpoint que o motorista usa) com
    litros acima da capacidade do tanque — alerta crítico
    (`litros_acima_capacidade_tanque`) confirmado gravado no banco, log do
    servidor sem nenhum erro de envio de e-mail (silêncio = sucesso, já que
    a função só loga em caso de falha), e-mail de teste anterior já
    confirmado recebido pela usuária na mesma caixa de entrada usada nesse
    cenário.
- **Não incluído nesta rodada**: nenhuma notificação pra alertas
  info/atenção (decisão deliberada, mesmo corte de sempre); nenhuma
  configuração de preferência (usuária não pode desligar/religar esse
  e-mail ainda) — se isso incomodar no uso real, é fácil adicionar um
  toggle depois.

**Verificado**: `tsc --noEmit`, `eslint` e `npm test` (106/106 — 5 novos)
limpos; `npm run build` limpo. Nenhuma migration nova.

## Identidade visual nos e-mails (2026-07-08)

Pedido do usuário: os e-mails do sistema (alerta crítico, convite, redefinir
senha) estavam em texto simples, sem nenhuma cor/identidade — pediu pra
ficarem "bonitos e bem estruturados".

- ✅ **`lib/email/envelope.ts`** (novo): envelope visual compartilhado —
  `envolverEmail()` (cabeçalho navy `#0a1628` com o badge "LT", corpo
  branco, rodapé) e `botaoEmail()` (botão ciano `#00bfe6`/texto navy, mesmo
  par de cores do botão primário do app). HTML de e-mail de verdade —
  tabela (`role="presentation"`), não flexbox/grid, e estilo inline em cada
  elemento, porque é isso que webmails (Gmail, Outlook) realmente suportam;
  `<style>` em bloco é removido por vários clientes.
- ✅ **`lib/email/conteudo-alerta.ts`** atualizado pra usar o envelope — a
  caixa de alertas críticos ganhou a mesma borda esquerda vermelha + fundo
  levemente tingido que já existe no card de alerta crítico do painel real
  (`components/escritorio/lista-alertas.tsx`), pra quem já usa o painel
  reconhecer o mesmo peso visual no e-mail. Testes existentes
  (`conteudo-alerta.test.ts`) continuam batendo sem alteração (checam
  substring, não o HTML inteiro).
- ✅ **Templates do Supabase Auth (convite e redefinir senha) — não são
  código do LuckTank**, vivem dentro do painel do Supabase
  (Authentication → Emails → Templates). Gerados com o MESMO envelope
  (rodando `envolverEmail()`/`botaoEmail()` via script `tsx` descartável,
  não escritos à mão — garante que os 3 e-mails ficam pixel-idênticos no
  cabeçalho/rodapé) e salvos em `supabase/email-templates/convite.html` e
  `redefinir-senha.html` só como referência/backup dentro do repo (esses
  arquivos não são lidos por nenhum código, é documentação de quando algo
  precisar ser reconfigurado — ex.: projeto Supabase recriado do zero).
  Variáveis Go template do Supabase (`{{ .ConfirmationURL }}`) preservadas
  literalmente no HTML gerado. Assuntos (editados separadamente no painel,
  não fazem parte do HTML): "Você foi convidado pro LuckTank" e "Redefinir
  sua senha do LuckTank". **A usuária precisa colar isso manualmente no
  painel do Supabase** — nenhuma API permite fazer isso por fora (não é
  algo que dá pra automatizar com a service role key).
- **Validado enviando de verdade** (via Resend, mesmo domínio
  `luckfrotas.com.br` já configurado) os 3 e-mails pro e-mail de teste da
  usuária — convite, redefinir senha e alerta crítico (2 alertas
  combinados, pra conferir o assunto no plural) — confirmados recebidos e
  com o visual esperado.

**Verificado**: `tsc --noEmit`, `eslint` e `npm test` (106/106) limpos;
`npm run build` limpo. Nenhuma migration nova.

## Instabilidade do OCR investigada + retry automático (2026-07-08)

Usuária relatou: uma foto de comprovante funcionou perfeitamente ontem
(depois da melhoria de prompt/schema de 2026-07-07), e hoje a MESMA imagem
não é lida — sem mudança nenhuma de código entre as duas tentativas.

**Diagnóstico (scripts diretos contra a API real do Gemini, sem passar
pelo app)**:
- `GET /v1beta/models` e `/v1beta/models/gemini-flash-latest` confirmam que
  o alias segue existindo e respondendo (200) — não é o mesmo tipo de
  quebra por descontinuação já visto na Fase 4.
- **Achado real**: o modelo por trás do alias hoje faz **"thinking"**
  (raciocínio interno) antes de responder — confirmado via
  `usageMetadata.thoughtsTokenCount > 0` numa chamada de teste. Isso é
  novo (o Google atualiza o que "latest" aponta sem aviso) e introduz
  variação genuína de resultado entre chamadas com a MESMA imagem, mesmo
  prompt, mesma `temperature: 0.1` — explica o "funcionou ontem, não
  funciona hoje" sem precisar de nenhuma mudança de dado ou de código.
- **Testado desligar thinking** via `thinkingConfig: { thinkingBudget: 0 }`
  (não documentado no SDK `@google/generative-ai` usado — TS não tipa esse
  campo, mas a API aceita o objeto extra): **piorou**. Numa imagem sem
  nenhum dado de verdade, com thinking ligado o modelo respondeu
  corretamente `null`/`null`; com thinking desligado, o modelo **alucinou**
  valores plausíveis (`30.0` litros, `R$170,70`) em vez de reconhecer que
  não havia nada pra ler. Decisão: **não desligar thinking** — trocaria
  "falha visível" por "erro silencioso mais perigoso" (dado inventado que
  parece real), pior ainda num produto anti-fraude.
- **Causa raiz aceita**: não-determinismo do próprio provedor (fora do
  controle do LuckTank), não um bug de código nem um limite de cota
  (nenhum 429/erro de rate limit apareceu em nenhum teste).

**Correção aplicada**: `lib/ocr/gemini-provider.ts` reestruturado — a
lógica de uma chamada virou `tentarExtrairUmaVez()` (privada), e
`geminiOcrProvider.extrair()` (a função pública, interface inalterada)
agora tenta a MESMA foto até 2 vezes antes de devolver "falhou" pro
cliente — sem pedir nova captura ao motorista (isso já existe separado, no
client, até 2 tentativas *com foto nova*; este retry é só a nível de
chamada ao Gemini, transparente pro fluxo). Loga quando o sucesso só veio
na 2ª tentativa, pra dar visibilidade futura (Vercel logs) de quão comum
é essa variação na prática.

**Validado**: `tsc --noEmit`, `eslint` e `npm test` (106/106, sem teste
novo — `gemini-provider.ts` nunca teve cobertura unitária, é validado
contra a API real como sempre foi) limpos; `npm run build` limpo. Testado
de ponta a ponta contra o endpoint real (`POST /api/ocr`, veículo
descartável criado/removido só pra isso): confirmado que a chamada demorou
~8,7s (compatível com 2 tentativas reais ao Gemini, não 1) e devolveu o
resultado esperado sem nenhum erro no log do servidor.

**Não resolvido/fora de escopo**: não há como fixar o modelo numa versão
exata sem reintroduzir o risco já documentado (nome de versão fixo quebra
quando descontinuado — Fase 4). O retry é uma mitigação, não elimina o
não-determinismo do provedor; se a taxa de falha real (medida pelos logs
"só teve sucesso na tentativa 2") for alta demais no uso real, o próximo
passo seria considerar `@google/genai` (SDK novo, dá controle mais fino) —
troca de dependência maior, não feita agora.

## Diagnóstico e correção do OCR: encanamento (timeout/retry/modelo) + campos vazios (2026-07-10)

Usuária relatou dois sintomas em produção: OCR "falha/trava com frequência"
(não é ler errado, é não responder) e, separadamente, em fotos **nítidas e
legíveis**, o Gemini respondia mas devolvia litros/valor_total/valor_litro
vazios ou errados. Investigado antes de qualquer correção (pedido
explícito da usuária), com evidência real contra a API, não só teoria.

### Causa raiz — testada, não só hipótese

Chamadas reais contra `gemini-flash-latest` (fora do app, sem gastar cota
de produção) nesta sessão: **1 sucesso em 79s** (imagem trivial, sem dado
real pra ler) e **4 falhas seguidas com 503 "high demand/UNAVAILABLE"**
(entre 2,5s e 70s de espera até falhar) — 5 tentativas reais, 1 sucesso
"vazio". `GET /v1beta/models/gemini-flash-latest` confirma `"thinking":
true` como característica fixa do modelo atual por trás do alias (não mais
ocasional, como achado em 2026-07-08). O alias hoje resolve pro Gemini 3.5
Flash (GA em maio/2026, um modelo "frontier"/agentic, não o Flash leve
original pro qual o prompt de extração foi calibrado na Fase 4) —
confirmado via busca externa, e consistente com relatos de outros projetos
sobre esse mesmo alias.

**As duas queixas têm a mesma raiz**: o modelo por trás do alias mudou (de
novo) pra uma versão mais pesada e instável. Sem `maxDuration` configurado
em nenhuma rota, e sem timeout de requisição no SDK, uma chamada de 70-79s
quase certamente estoura o teto do plano Hobby da Vercel (60s por
function) — a function é morta pela plataforma antes que qualquer retry
interno rode, então o motorista só vê a conexão cair, não um erro
controlado.

### Parte A — Encanamento (`lib/ocr/gemini-provider.ts`, `app/api/ocr/route.ts`)

- **Timeout de requisição por tentativa**: `TIMEOUT_MS_POR_TENTATIVA =
  20_000` via `requestOptions.timeout` do SDK (campo existe, mas o código
  nunca passava isso) — falha rápido e controlado em vez de deixar a
  Vercel matar a function sem aviso.
- **`export const maxDuration = 55`** em `app/api/ocr/route.ts` — teto real
  do plano Hobby é 60s; pior caso calculado (20s + até 4s de backoff + 20s
  de 2ª tentativa) fica em ~44s, com folga.
- **Retry deixou de ser "sempre tenta 2x"**: `chamarGeminiUmaVez` agora
  RELANÇA a exceção em vez de engolir (quem decide se retry vale a pena é
  `extrair()`). Só ganha uma 2ª tentativa (com backoff, 1,5s padrão ou o
  `retryDelay` do próprio erro do Google quando presente, sempre limitado a
  4s) quem falhar com **503 ou 429 respondido DENTRO do timeout** — sinal
  de sobrecarga real e transitória. Timeout/abort, erro de parse/schema ou
  qualquer outro status **não ganham retry aqui** — não adianta repetir do
  mesmo jeito, e cada tentativa custa até 20s do orçamento apertado da
  function. A segunda chance nesses casos já existe numa camada acima (o
  client pede foto nova, até 2x — `MAXIMO_TENTATIVAS_OCR` em
  `fluxo-abastecimento.tsx`, inalterado).
- **Logging de diagnóstico temporário** (`[ocr-diagnostico]` nos logs da
  Vercel): tentativa, modelo usado, resultado, tempo de resposta, tamanho
  da imagem, `thoughtsTokenCount`, e no erro: status HTTP/mensagem/detalhes
  (nunca a API key nem o buffer da foto). Deixado no código pra
  acompanhar a taxa real de 503/timeout/fallback em produção por mais
  alguns dias — considerar reduzir depois.

### Parte B — Modelo fixo em vez do alias (`lib/gemini/client.ts`)

Testado direto contra a API, **mesma foto real de comprovante** (cupom de
Diesel, Auto Serviços Pit Stop, 430L, R$6,54/L, R$2.812,20 — fornecida pela
usuária), mesmo prompt/schema exatos da produção:

- `gemini-flash-latest`: **503 em todas as tentativas** nesta foto (não foi
  possível nem completar uma comparação de campos — o alias não respondeu
  com sucesso nenhuma vez contra este comprovante real na sessão).
- `gemini-2.5-flash` (nome estável, não é alias nem snapshot datado):
  **200 OK em 9,4s**, com **todos os campos essenciais corretos**: litros
  `430`, valor_total `2812.2`, valor_litro `6.54` — batendo exato com o
  cupom físico. Também acertou data, hora, posto, CNPJ e número da nota.

**Achado lateral importante**: candidatos com sufixo de snapshot datado
(`gemini-2.0-flash-001`, `gemini-2.0-flash-lite-001`) devolveram **429 com
`limit: 0`** — cota **zero** no free tier deste projeto pra esses IDs
específicos (não é cota consumida, é ausência de alocação free tier pra
modelo "congelado"). Ou seja, não dá pra simplesmente fixar em qualquer
nome de modelo — snapshots datados não funcionam no free tier deste
projeto. `gemini-2.5-flash` (nome "solto", sem sufixo de data) tem cota
real e funcionou.

**Decisão**: `MODELO_FLASH_PRINCIPAL = "gemini-2.5-flash"` vira o modelo
usado por padrão (`lib/gemini/client.ts`). `gemini-flash-latest` continua
no código como `MODELO_FLASH_FALLBACK` — só entra em jogo se o principal
um dia devolver 404 (descontinuação real), via
`chamarComFallbackDeModelo` em `gemini-provider.ts`. Isso muda o
trade-off documentado desde a Fase 4: antes, "nome fixo quebra quando
descontinuado" pesava mais que a instabilidade do alias; hoje, o alias já
provou ser a fonte da instabilidade (2 mudanças de comportamento sem aviso
em menos de um ano), e uma descontinuação de modelo nomeado costuma vir
com aviso prévio do Google — risco mais gerenciável que um remapeamento
silencioso.

**Prompt não foi alterado**: a mesma versão (`extrair-abastecimento.v2`,
inalterada) que falhava/vinha vazia no modelo pesado extraiu tudo certo no
modelo fixo — evidência de que o problema era o modelo, não o prompt
(conforme a hipótese a testar). Ponto não coberto por este teste (não
havia exemplo disponível nas fotos fornecidas): valor com separador de
milhar (ex.: "2.750,00") — o prompt só instrui conversão de vírgula
decimal, não desambiguação de ponto como milhar; fica como possível gap a
observar se aparecer em produção.

### Validação

`tsc --noEmit`, `eslint .`, `npm test` (116/116) e `npm run build`
confirmados limpos depois de todas as mudanças. **Testado ponta a ponta
contra o endpoint real** (`npm run dev`, empresa/veículo descartáveis
criados só pra isso e removidos por completo depois, confirmado por query
independente): a MESMA foto real do comprovante enviada via `POST
/api/ocr` retornou `sucesso: true`, `confianca: "alta"`, todos os campos
essenciais corretos, em **7,9s** (bem dentro do timeout de 20s por
tentativa e do `maxDuration` de 55s), usando `gemini-2.5-flash` na
primeira tentativa (log `[ocr-diagnostico]` confirma `"modelo":
"gemini-2.5-flash"`, sem necessidade de fallback nem retry).

**Não testado**: o caminho de fallback pro alias (404 do modelo principal)
e o retry com backoff em 503/429 real — ambos exigiriam forçar
artificialmente essas condições (não reproduzido nesta sessão; a lógica foi
revisada por leitura, não por execução real desses ramos específicos).

## Três fotos (cupom + bomba + hodômetro) com conferência cruzada — Bloco 1 (2026-07-10)

Pedido do usuário: em vez de só a foto do cupom, guiar o motorista a fotografar
também o visor da bomba e o hodômetro, pra o sistema **conferir uma foto
contra a outra** (bomba × cupom, hodômetro × KM confirmado) — o valor
anti-fraude está no cruzamento, fotos que concordam entre si são prova difícil
de forjar. Pedido em 5 blocos; este registro cobre só o **Bloco 1 — captura
guiada**. Blocos 2-5 (Gemini lendo bomba/hodômetro, KM auto-preenchido,
regras de divergência, exibição no escritório) ficam para as próximas sessões.

- ✅ **Wizard do motorista virou 1 foto por vez, com progresso claro.**
  `components/motorista/passo-foto.tsx` generalizado (título/instrução/
  número/total via props, em vez de texto fixo de cupom) — reaproveitado nas
  3 etapas, cada uma com o rótulo "Foto X de 3" e instrução específica:
  cupom ("Tire uma foto legível do cupom..."), bomba ("Fotografe o visor da
  bomba mostrando litros e valor"), hodômetro ("Fotografe o painel/hodômetro
  mostrando o KM atual"). `components/motorista/fluxo-abastecimento.tsx`:
  `Passo` ganhou `"foto-cupom" | "foto-bomba" | "foto-hodometro"` no lugar do
  antigo `"foto"` único; sequência nome → foto-cupom (com OCR, como já era) →
  foto-bomba → foto-hodometro → formulário. Indicador de progresso (3
  segmentos) trocou o rótulo "Foto" por "Fotos" (plural), sem adicionar
  segmentos novos — o "Foto X de 3" fica dentro do próprio card, não na barra
  superior.
- ✅ **Bomba e hodômetro são opcionais, cupom continua obrigatório.** As duas
  etapas novas têm botão "Pular esta foto" (`obrigatoria={false}` em
  `PassoFoto`) — motorista sem ângulo bom pro visor da bomba ou hodômetro
  quebrado não fica travado. Cupom não ganhou esse botão (`obrigatoria` não
  passada, default `true`, mantém o comportamento de sempre: Continuar só
  habilita com uma foto selecionada). Nenhuma das 3 é OCR'd ainda neste
  bloco — bomba/hodômetro só são capturadas e enviadas; a leitura por IA
  entra no Bloco 2.
- ✅ **Câmera + galeria nas 3 fotos** (mesmo padrão do cupom desde o Bloco 2
  de melhorias de uso) — a defesa continua sendo hash SHA-256 + EXIF, não
  a origem do arquivo.
- ✅ **`app/api/abastecimentos/route.ts` aceita 3 fotos.** Campos multipart
  renomeados: `foto` → `foto_cupom`/`foto_cupom_exif` (nome antigo não
  mantido como alias — client e servidor mudaram juntos neste mesmo commit,
  sem consumidor externo do endpoint), mais `foto_bomba`/`foto_bomba_exif` e
  `foto_hodometro`/`foto_hodometro_exif`. Nova função `processarFoto()`
  reaproveita a MESMA validação/hash/EXIF/upload que o cupom já usava
  (nenhuma lógica duplicada) — recebe um flag `obrigatoria`: cupom inválido
  barra com 400 (comportamento de sempre); bomba/hodômetro ausente OU
  inválida nunca bloqueia o registro, só resulta em "sem foto" pra aquela
  etapa (mesmo espírito do invariante #7 — prova a mais é bônus, nunca
  trava o motorista). Cada foto grava sua própria linha em `midias` com
  `tipo`: `foto_comprovante` (cupom, nome mantido — não renomeado, para não
  quebrar o painel/export que já filtram por esse valor), `foto_bomba`,
  `foto_hodometro`. **Nenhuma migration nova** — `midias.tipo` já era texto
  livre sem CHECK constraint desde a `0001_init.sql`.
- ✅ **Achado e corrigido durante este bloco**: a regra de "foto duplicada"
  (`avaliarFotoDuplicada`, motor de fraude) comparava hash sem filtrar por
  `tipo` — inofensivo enquanto só existia um tipo de foto, mas passaria a
  comparar hashes entre tipos diferentes (cupom vs. bomba vs. hodômetro)
  assim que a captura de 3 fotos existisse. Adicionado `.eq("tipo",
  "foto_comprovante")` na query — a regra continua sendo especificamente
  "o CUPOM foi reaproveitado", não uma mistura de tipos.
- ✅ **Fila offline estendida sem quebrar itens já enfileirados.** `ItemFila`
  (`lib/offline/db.ts`) ganhou `fotoBombaBlob`/`fotoBombaExifHeaderBlob`/
  `fotoBombaNome` e os 3 equivalentes de hodômetro, todos **opcionais** —
  os campos antigos (`fotoBlob`/`fotoExifHeaderBlob`/`fotoNome`, agora
  implicitamente "cupom") NÃO foram renomeados de propósito: um item já
  salvo no IndexedDB do celular de um motorista real, de antes deste deploy,
  não tem as chaves novas (viram `undefined`) e continua sincronizando
  normalmente só com a foto do cupom, sem erro. `lib/offline/sync.ts`
  (`construirFormData`) envia os 3 pares de campo com os novos nomes
  multipart, cada bomba/hodômetro só se presente.
- **Validado**: `tsc`, `lint`, `test` (116/116) e `build` limpos.
  **Ponta a ponta contra o endpoint real** (script Node, veículo
  descartável): envio com as 3 fotos reais (cupom + 2 fotos de outros
  cupons reaproveitadas só pra testar o pipeline de bomba/hodômetro, já
  que ainda não há OCR pra elas neste bloco) confirmou os 3 registros em
  `midias` com `tipo` correto, hash distinto e path distinto
  (`.../registro_uuid-cupom.jpg`, `-bomba.jpg`, `-hodometro.jpg`); envio só
  com cupom (sem bomba/hodômetro) confirmou que o comportamento antigo
  continua idêntico. **No navegador, contra build de produção** (`next
  build` + `next start` — `next dev` foi descartado pro teste porque a CSP
  bloqueia o `eval()` do Fast Refresh e quebra a hidratação, mascarando
  TODA interação como se estivesse travada; achado um Service Worker
  antigo (`lucktank-v2`, de uma sessão de dev anterior) também interferindo,
  limpo antes do teste real — mesma classe de armadilha já registrada na
  Fase 8 Bloco 1): fluxo completo clicado de verdade (seleção de motorista,
  captura de foto via `File`/`DataTransfer` sintético — seletor de arquivo
  nativo do SO não é automatizável, mesma limitação já documentada em
  blocos anteriores), 2 tentativas de OCR falhando de propósito (imagem
  sintética sem dado de cupom real) confirmando o fallback pro manual,
  "Pular esta foto" em bomba e hodômetro levando corretamente a "Foto 2 de
  3" → "Foto 3 de 3" → formulário, bloqueio de KM confirmado (tentativa com
  KM igual ao último registrado barrada na hora, mensagem certa), e envio
  final confirmado no banco: `abastecimento` gravado com os valores
  manuais, `midias` com só `foto_comprovante` (bomba/hodômetro
  corretamente ausentes por terem sido puladas). Todo o dado de teste
  (2 empresas, veículos, motorista, abastecimentos, mídias e arquivos de
  Storage) removido depois, confirmado por query independente.
- **Pendências explícitas pro Bloco 2 em diante**: Gemini ainda não lê
  bomba/hodômetro (fotos só são capturadas/guardadas); KM não é
  auto-preenchido a partir do hodômetro; nenhuma regra de divergência
  bomba×cupom ou hodômetro×KM existe ainda; escritório ainda não exibe as
  3 fotos separadamente (herda a exibição genérica de `midias` que já
  existia).

### Bloco 2 — Gemini lê bomba e hodômetro (2026-07-10)

- ✅ **Motor de chamada ao Gemini virou genérico, reaproveitado pelos 3
  tipos de foto.** Extraído `lib/ocr/motor-gemini.ts`
  (`executarExtracaoGemini<TDados>`) — timeout de 20s por tentativa, retry
  só em 503/429 com backoff, fallback pro alias em 404, logging de
  diagnóstico: tudo isso saiu de `gemini-provider.ts` (específico de cupom)
  pra cá, parametrizado por `prompt`/`responseSchema`/`schemaZod`/
  `calcularConfianca`/`rotulo`. `lib/ocr/gemini-provider.ts` (cupom) virou
  um wrapper fino chamando o motor; `lib/ocr/gemini-bomba-provider.ts` e
  `lib/ocr/gemini-hodometro-provider.ts` (novos) seguem o mesmo padrão —
  **nenhuma lógica de retry/timeout/fallback duplicada**, só prompt e
  schema diferentes por tipo, como pedido.
- ✅ **`OcrResultado`/`OcrProvider` (lib/ocr/provider.ts) viraram genéricos**
  (`<TDados = DadosExtraidos>`) — todo uso existente (sem parâmetro de tipo)
  continua significando "resultado de cupom", sem quebrar nada; bomba usa
  `OcrProvider<DadosBomba>`, hodômetro usa `OcrProvider<DadosHodometro>`.
- ✅ **Prompts novos**: `lib/ocr/prompts/extrair-bomba.v1.ts` (lê litros/
  valor_total/valor_litro do visor digital da bomba — 2 ou 3 contadores
  separados, cada um com seu rótulo) e `extrair-hodometro.v1.ts` (lê só o
  KM, avisando pra ignorar o dígito de décimos quando existir e nunca
  estimar se o painel não estiver legível). Mesma regra do cupom: campo
  não lido com certeza vira `null`, nunca um palpite.
- ✅ **`/api/ocr` ganhou um campo `tipo`** (`"cupom" | "bomba" |
  "hodometro"`, ausente ou desconhecido cai em `"cupom"` — mantém o client
  antigo funcionando sem mudança) que escolhe o provider certo. Mesmo
  campo `foto`/`qr_token`/rate limit/validação de arquivo de sempre —
  só o roteamento pro provider é novo.
- ✅ **Wizard do motorista chama a leitura de verdade.** Depois de capturar
  bomba ou hodômetro (se online e não pulou a foto), `handleContinuarFotoBomba`/
  `handleContinuarFotoHodometro` chamam `/api/ocr` com o `tipo` certo,
  mostrando "Lendo o visor da bomba..."/"Lendo o hodômetro..." (
  `PassoProcessando` ganhou props `titulo`/`subtitulo` em vez de texto
  fixo). **Nunca bloqueia o fluxo**: sem internet, sem arquivo, ou
  qualquer falha na leitura, o motorista segue em frente do mesmo jeito —
  essas 2 fotos continuam evidência complementar opcional (Bloco 1). O
  resultado fica guardado em estado (`bombaOcrResultado`/
  `hodometroOcrResultado`) pros próximos blocos consumirem (KM
  auto-preenchido com confirmação, conferência cruzada) — **ainda não
  grava nada no banco nem preenche nenhum campo do formulário sozinho**.
- ✅ **Confirmação visual do que foi lido** (só quando a leitura teve
  sucesso — `PassoFoto` ganhou `mensagemInfo`, estilo `sucesso` diferente
  do `mensagemErro`): "Lemos da bomba: X L · R$ Y" aparece na etapa do
  hodômetro; "Lemos do hodômetro: X km" aparece no topo do formulário
  (marcado no código pra ser substituído pelo preenchimento automático do
  Bloco 3). Nada aparece quando a leitura falha ou a foto foi pulada —
  confirmado no teste que não sobra nenhuma legenda "fantasma".
- **Validado**: `tsc`, `lint`, `test` (116/116) e `build` limpos. **Contra
  o endpoint real** (`POST /api/ocr`, veículo descartável): `tipo=bomba` e
  `tipo=hodometro` confirmados usando os prompts certos (`versaoPrompt`
  no corpo da resposta bate), respondendo em ~4s (`gemini-2.5-flash`
  estável, nenhum 503 na sessão de teste) e devolvendo `null`/`"falhou"`
  corretamente numa foto que não é nem visor de bomba nem hodômetro (o
  modelo não alucinou nenhum número plausível a partir de uma foto de
  cupom — comportamento conservador confirmado). **No navegador** (build
  de produção): fluxo completo clicado — "Lendo o visor da bomba..." e
  depois "Foto 3 de 3 — Hodômetro" aparecendo na sequência certa; pulando
  o hodômetro e chegando limpo em "Dados do abastecimento", sem legenda
  nenhuma de bomba/hodômetro aparecendo quando a leitura falhou/foi
  pulada (confirma que `mensagemInfo` só aparece com dado de verdade).
  Dado de teste removido depois, confirmado por query independente.
- **Pendências explícitas pro Bloco 3 em diante**: KM ainda não é
  preenchido a partir do hodômetro (motorista sempre digita, mesmo
  quando `hodometroOcrResultado` tem um valor); nenhuma regra de
  divergência ainda; escritório ainda não distingue as 3 fotos.

### Bloco 3 — KM do hodômetro preenche, motorista confirma (2026-07-10)

- ✅ **`handleContinuarFotoHodometro` agora preenche `valores.kmAtual`**
  quando a leitura tem `km` não nulo (`resultado.dados.km`) — antes só
  guardava o resultado em estado sem usar em nenhum campo. O motorista
  chega no formulário já com o campo preenchido, mas **sempre pode ver e
  corrigir** antes de confirmar — nunca grava direto sem passar pelo
  formulário (mesmo padrão já usado pros campos do cupom desde a Fase 4).
  Sem leitura (`km` null) ou foto pulada/offline, o campo continua vazio,
  motorista digita manualmente — comportamento de antes, inalterado.
  Confiança do hodômetro é binária (`"alta"` só com `km` presente,
  `"falhou"` senão — ver Bloco 2); não existe "baixa confiança" separada
  pra esse tipo de leitura, então "sem leitura confiável" e "km null" são
  a mesma coisa aqui.
- ✅ **Legenda de confirmação atualizada**: "Preenchemos o KM com a leitura
  do hodômetro (X km) — confira antes de confirmar." (antes, Bloco 2, era
  só um aviso informativo sem o campo estar de fato preenchido).
- ✅ **Bloqueio de KM continua valendo sobre o valor CONFIRMADO** — nenhuma
  mudança no endpoint nem na checagem (`kmMenorQueUltimoRegistrado`
  continua comparando o que está em `parsed.data.km_atual`, que é
  exatamente o que veio no campo do formulário no momento do envio,
  independente de ter sido preenchido pela IA ou digitado). Como o valor
  confirmado é o que sempre trafegou por esse campo, o invariante #6 não
  precisou de nenhum ajuste.
- **Validado no navegador** (build de produção, veículo descartável):
  gerei uma imagem sintética de hodômetro digital (dígitos grandes estilo
  LCD, "154823") e confirmei primeiro via `/api/ocr` direto que o Gemini
  lê exatamente esse número; depois rodei o wizard completo — cupom
  falhando de propósito (foto sem dado real), bomba pulada, hodômetro
  com essa imagem: campo "KM atual" chegou no formulário já com
  `154823` e a legenda de confirmação certa. **Editei o valor pra 154825**
  (simulando o motorista corrigindo uma leitura errada) e confirmei o
  abastecimento — `abastecimentos.km_atual` gravado no banco confirmado
  como **154825** (o valor confirmado/editado), não 154823 (a leitura
  bruta) — prova que a confirmação/edição do motorista é respeitada, a
  IA só sugere. Dado de teste removido depois, confirmado por query
  independente. `tsc`, `lint`, `test` (116/116) e `build` limpos.
- **Pendências explícitas pro Bloco 4 em diante**: nenhuma regra de
  divergência bomba×cupom ou hodômetro×confirmado existe ainda — as
  leituras de bomba/hodômetro não são enviadas ao servidor na submissão
  (ficam só no estado do client); isso entra no Bloco 4, junto com as
  colunas/migration necessárias pra persistir o que foi lido vs. o que
  foi confirmado. Escritório ainda não distingue as 3 fotos.

### Bloco 4 — Conferência cruzada anti-fraude (2026-07-10)

O coração anti-fraude da captura de 3 fotos: bomba deve bater com cupom
(litros/valor), hodômetro deve bater com o KM confirmado. Fotos que
concordam entre si são prova difícil de forjar.

- ✅ **Migration `0016_abastecimentos_leituras_bomba_hodometro.sql`**
  (aplicada via `supabase db push --linked`, `types/database.ts`
  regenerado): 3 colunas novas em `abastecimentos`, todas nullable com
  CHECK de positividade quando presentes — `bomba_litros_lido`,
  `bomba_valor_total_lido`, `hodometro_km_lido`. Guardam o que a IA LEU,
  separado do que foi CONFIRMADO (`litros`/`valor_total`/`km_atual`, já
  existentes) — é essa comparação que alimenta as regras novas.
- ✅ **3 regras novas em `lib/validacao/regras.ts`**, todas nível
  **`atencao`** (não `critico`) de propósito: diferente de nota/foto
  duplicada (evidência quase inequívoca), aqui existe explicação inocente
  plausível e comum — reflexo no visor da bomba, ângulo ruim do
  hodômetro, dígito confundido pela IA em qualquer uma das duas leituras
  comparadas. Tratado como suspeita a investigar, não como prova (mesmo
  espírito de `avaliarFotoAntigaOuReaproveitada`).
  - `divergencia_bomba_cupom_litros`: tolerância = maior entre **0,5L
    absoluto** e **2% do valor do cupom** (cobre abastecimento pequeno,
    onde 2% seria apertado demais, e abastecimento grande, onde um piso
    fixo seria frouxo demais).
  - `divergencia_bomba_cupom_valor`: mesma lógica, **R$2 absoluto** ou
    **2%**.
  - `km_hodometro_diverge_do_confirmado`: tolerância bem mais larga,
    **50km fixo** — um hodômetro mal lido pela IA erra fácil por dezenas
    de km (reflexo, ângulo, dígito de décimos confundido com o de
    unidades), e o motorista CORRIGINDO essa leitura no formulário
    (Bloco 3) é o caso normal esperado, não suspeita. Validado justamente
    com o cenário do Bloco 3 (leitura 154823, confirmado 154825 — 2km de
    diferença, bem dentro da tolerância, não dispararia).
  - **Nenhuma das 3 regras dispara quando a leitura correspondente é
    `null`** (foto não tirada, pulada, ou IA não conseguiu ler) — ausência
    de prova nunca é tratada como fraude, só a presença de uma leitura que
    DIVERGE é que é o sinal. Cada alerta grava os dois valores comparados
    (`_bomba`/`_cupom` ou `_hodometro`/`_confirmado`) mais a divergência
    numérica em `detalhes`, pro escritório ver a diferença exata.
  - `ROTULO_REGRA` (`lib/validacao/rotulos.ts`) ganhou os 3 rótulos novos.
  - **14 testes novos** (`regras.test.ts`, 130 no total): cada regra com
    caso "sem foto" (não dispara), "valores idênticos" (não dispara),
    limite exato da tolerância (não dispara) e acima da tolerância
    (dispara, com `detalhes` conferidos exatamente) — litros e valor
    também testam o piso absoluto em abastecimento pequeno, onde o
    percentual sozinho seria frouxo demais.
- ✅ **`lib/validacao/schemas.ts`**: `abastecimentoSchema` ganhou
  `bomba_litros_lido`/`bomba_valor_total_lido`/`hodometro_km_lido`,
  todos opcionais/nullable — o fluxo sem essas fotos (sempre válido desde
  o Bloco 1) continua funcionando sem eles.
- ✅ **`app/api/abastecimentos/route.ts`**: parseia os 3 campos novos do
  FormData, grava nas colunas novas, e alimenta `ContextoAvaliacao` com
  eles (mais `valorTotal`/`kmAtual` do próprio abastecimento, que a
  interface não tinha antes — precisos como "esperado"/"confirmado" nas
  novas regras).
- ✅ **`fluxo-abastecimento.tsx` envia as leituras já feitas nos Blocos
  2/3** (`bombaOcrResultado`/`hodometroOcrResultado`, já em estado) junto
  da submissão — só quando o valor lido não é null. Caminho offline
  herda de graça: `campos` (que já inclui os novos campos condicionalmente)
  é o mesmo objeto reenviado pela fila (`lib/offline/sync.ts` já forwarda
  `Object.entries(item.payload)` genericamente, nenhuma mudança
  necessária lá).
- **Validado**: `tsc`, `lint`, `test` (130/130) e `build` limpos.
  **Contra o endpoint real** (veículo descartável): 3 cenários via `POST
  /api/abastecimentos` — (1) bomba/cupom/hodômetro **concordando** dentro
  da tolerância → **zero alertas**; (2) bomba/cupom/hodômetro
  **divergindo** bastante (120L lido vs. 100L cupom, R$700 vs. R$550,
  hodômetro 300km do confirmado) → **os 3 alertas dispararam juntos**,
  cada um com `detalhes` exatos (`litros_bomba: 120, litros_cupom: 100,
  divergencia: 20` etc.); (3) **sem nenhuma leitura de bomba/hodômetro**
  (só cupom) → **zero alertas, sem erro** — confirma "ausência de prova
  ≠ fraude" na prática, não só na regra. Dado de teste removido depois,
  confirmado por query independente.
- **Pendências explícitas pro Bloco 5**: escritório ainda não exibe as 3
  fotos separadamente (miniaturas rotuladas cupom/bomba/hodômetro) nem
  destaca os alertas de divergência; export ainda não inclui as 3 fotos.

## Regras invariantes (não podem quebrar)

1. **RLS isola por empresa.** Toda leitura do escritório passa pelas
   policies de `empresa_id` (via `usuario_empresa_id()`); nenhuma query
   nova pode contornar isso usando a service role fora de `app/api/**`.
2. **`/r/<qr_token>` resolve veículo e empresa a partir do token no
   servidor** — nunca confiar em `empresa_id`/`veiculo_id` vindo do client.
   O token é a única credencial do fluxo do motorista. Validado na Fase 3
   também para a escrita: `/api/abastecimentos` resolve o veículo de novo a
   partir do `qr_token` recebido, ignora qualquer id vindo do client, e
   nunca fica com dado desatualizado (`force-dynamic` na página — ver
   "Lições aprendidas").
3. **`qr_token` é permanente.** Gerado uma vez no cadastro do veículo, nunca
   regenerado por troca de motorista/celular/reimpressão.
4. **Toda escrita de edição/exclusão valida o papel no servidor** (não só
   confiar na policy de RLS) **e grava em `edicoes_log`** (antes/depois,
   quem, quando) — é a defesa contra fraude interna do próprio escritório.
   Implementado desde a Fase 2 (`lib/auth/contexto-usuario.ts` +
   `lib/edicoes-log.ts`, usado em veículos/motoristas/usuários) e validado
   com dados reais. Todo novo módulo (abastecimentos na Fase 3+) segue o
   mesmo padrão: checar papel via `getUsuarioAtual()` antes de mutar, depois
   chamar `registrarLog()`. **`abastecimentos` não tem policy de
   UPDATE/DELETE pra client autenticado desde a 0006** (hardening
   pós-auditoria) — é somente leitura pro escritório; qualquer edição futura
   precisa nascer como Server Action que segue esse mesmo padrão, nunca como
   policy de RLS aberta.
5. **O banco nunca é recriado.** O schema só evolui por novas migrations
   (`0002_*.sql`, `0003_*.sql`, ...) aplicadas em cima do que já existe.
   `0001_init.sql` não é mais editado — é histórico.
6. **KM não pode ser menor que o último registrado do veículo — bloqueio
   real, não alerta.** Enforced em `/api/abastecimentos` comparando com
   `veiculos.km_atual` (fresco, nunca cacheado); testado contornando a
   validação do client via `fetch` direto e confirmado 409 sem gravar
   nada. A fila offline (Fase 5) reusa o mesmo endpoint pra sincronizar, então
   ganha essa checagem de graça — se dois abastecimentos ficarem na fila
   offline do mesmo veículo em ordem trocada, o segundo a sincronizar é
   bloqueado (fica marcado como "erro" na fila local, não é descartado
   silenciosamente). Qualquer novo caminho de escrita de abastecimento
   precisa da mesma checagem.
7. **Alertas nunca bloqueiam o motorista, só o escritório vê.** O motor de
   validação (Fase 6) roda depois que o abastecimento já foi gravado, e um
   erro nele nunca derruba a resposta de sucesso pro motorista (try/catch
   silencioso em `/api/abastecimentos`). Qualquer regra nova entra em
   `lib/validacao/regras.ts` como função pura (sem query dentro) e é
   avaliada só a partir do contexto já resolvido pelo route handler.
