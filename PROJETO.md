# LuckTank — Estado do Projeto

> Fonte de verdade do projeto. Se uma sessão nova (ou outro agente) perder o
> contexto da conversa, este arquivo é o ponto de partida — atualize-o ao
> final de cada fase, antes de avançar para a próxima.

Última atualização: 2026-07-03 (fim da Fase 7).

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
  do veículo, litros desproporcionais ao KM rodado. O bloqueio de KM menor
  é separado (invariante #6, roda antes do insert). Rodam em
  `/api/abastecimentos` logo depois do insert, nunca derrubam a resposta de
  sucesso se falharem (try/catch silencioso — alerta é bônus informativo).
  Nada de preço regional/ANP, geolocalização ou EXIF por enquanto — escopo
  enxuto, cortado deliberadamente.
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
- ⬜ **Fase 8 — Integração LuckFrotas (mock) + hardening + deploy.**

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
- ⬜ Bloco 4 — limpar a porta de entrada (`/`, middleware, título).
- ⬜ Bloco 5 — testes automatizados do motor de validação (Vitest).

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
