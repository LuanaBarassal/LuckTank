# LuckTank — Estado do Projeto

> Fonte de verdade do projeto. Se uma sessão nova (ou outro agente) perder o
> contexto da conversa, este arquivo é o ponto de partida — atualize-o ao
> final de cada fase, antes de avançar para a próxima.

Última atualização: 2026-07-03 (pós-Fase 8: validação automatizada de fraude/negócio + relatório de consumo por veículo).

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
- **Testes: Vitest** (`npm test`), só cobrindo `lib/validacao/regras.ts` por
  enquanto (o motor de fraude, que é o que mais custa caro errar em
  silêncio). Não cobre o resto do app ainda — decisão deliberada do
  hardening pós-Fase 7, não uma meta de cobertura total.
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
- **(Fase 4) Nomes de modelo fixos do Gemini quebram.** `gemini-1.5-flash`
  (usado desde a Fase 1 só pro health check) retornou 404 "not found" na
  hora de usar de verdade — o modelo foi descontinuado. Troquei pra
  `gemini-flash-latest`, um alias que o Google mantém apontando pro Flash
  atual. Se o OCR começar a falhar do nada, checar
  `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
  pra ver os modelos realmente disponíveis antes de qualquer outro
  diagnóstico.
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
