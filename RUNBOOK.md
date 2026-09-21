# RUNBOOK — Credenciais críticas do LuckTank

> Achado de auditoria (2026-07-20): toda a operação do LuckTank — deploy, banco,
> OCR, e-mail, rate limit e onboarding de clientes novos — depende hoje de uma
> única pessoa ter acesso a um punhado de contas externas. Este documento existe
> pra reduzir esse "bus factor de 1": qualquer pessoa (você mesma num dia ruim,
> ou alguém que precise assumir o sistema) deve conseguir, a partir daqui, saber
> **onde cada credencial vive, o que ela destrava, e como trocá-la** sem precisar
> vasculhar `.env.local`/Vercel/memória.
>
> Este arquivo é a ESTRUTURA/checklist — nenhum segredo real está (nem deve
> estar) escrito aqui. Preencha a coluna "Onde fica" com o e-mail/conta real
> depois de ler.

## Como usar isto

1. Preencha a tabela da seção 1 com o e-mail de login de cada serviço.
2. Ative 2FA em CADA um desses serviços (se ainda não tiver) — eles são,
   juntos, a superfície de ataque mais valiosa contra o LuckTank, mais do que
   qualquer coisa no próprio código.
3. Adicione um segundo e-mail de confiança em `DONO_SISTEMA_EMAILS` (seção 3)
   — sem isso, uma perda de acesso sua trava cadastro de empresa/veículo/
   usuário novo pra sempre, não só até você recuperar a senha.
4. Guarde uma cópia deste runbook (preenchido) fora do GitHub também — um
   gerenciador de senhas com campo de nota, por exemplo. Se a única cópia
   estiver no repositório e o acesso ao GitHub for o problema, o runbook não
   ajuda.

---

## 1. Credenciais e onde vivem

| Credencial | Onde fica | O que destrava | Impacto se vazar/perder |
|---|---|---|---|
| Login da conta **Vercel** | vercel.com — preencher e-mail | Deploy, domínio, todas as env vars de produção (inclusive as linhas abaixo) | Controle total do app em produção |
| Login da conta **Supabase** | supabase.com — preencher e-mail | Banco de dados, Auth (todos os usuários/senhas com hash), Storage (fotos de comprovante), templates de e-mail (convite/redefinir senha) | Acesso a todos os dados de todos os clientes; é o maior raio de impacto de todos |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | Ignora TODO o RLS — usada só em `app/api/**` e Server Actions | Equivalente a acesso root ao banco inteiro, de qualquer lugar, sem precisar da conta Supabase |
| Login da conta **GitHub** (repositório) | github.com — preencher e-mail | Código-fonte, histórico, Actions (CI) | Quem tem push consegue alterar o que vai pra produção no próximo deploy |
| `GEMINI_API_KEY` | Google AI Studio (aistudio.google.com/apikey) — preencher conta Google | OCR das 3 fotos (cupom/bomba/hodômetro) | Sem ela, cai pro preenchimento manual (não trava o produto, mas perde a conferência cruzada) |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | console.upstash.com — preencher conta | Rate limit (login, PIN, OCR, recuperação de senha) — desde a correção de 2026-07-20, produção **recusa operar** sem isso configurado (fail-closed, ver `lib/rate-limit.ts`) | Sem isso configurado em produção, login/PIN/OCR/recuperação de senha ficam fora do ar (não inseguros — fora do ar) |
| Conta **Resend** (envio de e-mail) | resend.com — preencher conta | E-mails de convite, redefinir senha, alerta crítico, abastecimento registrado — configurado como SMTP customizado dentro do Supabase Auth | Sem isso, convites e recuperação de senha param de sair (Supabase cai pro SMTP padrão, com limites bem menores) |
| Domínio de e-mail (`luckfrotas.com.br` no Resend) | Registrador do domínio + Resend → Domains | Reputação de entrega dos e-mails acima | Verificação de domínio pendente era um item conhecido — confirmar status atual |
| Registrador do **domínio** de produção | preencher registrador (ex.: Registro.br) | O domínio em si (`NEXT_PUBLIC_SITE_URL`) | Perder o domínio derruba o link de convite/recuperação de senha (usa esse valor pra montar a URL, ver `.env.example`) |
| `DONO_SISTEMA_EMAILS` | Vercel → Settings → Environment Variables | Quem consegue abrir `/admin-sistema` (criar empresa, cadastrar veículo/usuário, suspender conta) — ver seção 3 | Hoje é 1 pessoa: se essa conta Google/e-mail ficar inacessível, ninguém mais cadastra cliente novo |

## 2. Ordem de prioridade se algo vazar

Se suspeitar de vazamento, gire credenciais nesta ordem (maior raio de
impacto primeiro):

1. **`SUPABASE_SERVICE_ROLE_KEY`** — regenerar em Supabase → Project Settings
   → API → "Reset service role key", atualizar na Vercel, redeploy.
2. **Senha da conta Supabase** (2FA se ainda não tiver).
3. **Senha da conta Vercel** (2FA se ainda não tiver).
4. **`GEMINI_API_KEY`** — revogar/recriar em aistudio.google.com/apikey.
5. **`UPSTASH_REDIS_REST_TOKEN`** — regenerar no console Upstash.
6. Senha de qualquer `usuarios.papel = 'administrador'` que possa ter sido
   comprometida — via `/admin-sistema` (suspender) ou diretamente no
   Supabase Auth.

## 3. `DONO_SISTEMA_EMAILS` — o ponto único de falha mais simples de resolver

Hoje só um e-mail está nessa variável (Vercel → Environment Variables). É a
lista de quem pode abrir `/admin-sistema` — criar empresa nova, cadastrar
veículo/usuário, suspender conta (ver `lib/auth/dono-sistema.ts`).

**Ação recomendada:** adicionar um segundo e-mail de alguém de confiança
(sócio, contador, ou até um e-mail seu alternativo com senha guardada em
lugar separado), separado por vírgula:

```
DONO_SISTEMA_EMAILS=email-principal@exemplo.com,backup@exemplo.com
```

Isso não dá acesso a NADA além do painel administrativo (não é dono de
nenhuma empresa/tenant) — é só uma segunda pessoa capaz de operar o sistema
se a primeira ficar indisponível.

## 4. MFA (verificação em duas etapas) — LuckTank

Desde 2026-07-20 o LuckTank tem MFA (TOTP) nativo, self-service, em
Configurações (ver `lib/auth/mfa.ts`). Recomendado ativar para:
- Toda conta com papel `administrador` em qualquer empresa.
- O e-mail (ou e-mails) listado em `DONO_SISTEMA_EMAILS`.

**Limitação a saber:** o Supabase TOTP puro não tem códigos de backup. Se
alguém perder o autenticador (celular trocado/perdido), a ÚNICA forma de
destravar a conta é um `administrador`/dono do sistema remover o fator pelo
painel administrativo do Supabase (Authentication → Users → esse usuário →
remover fator MFA) — não existe fluxo de autorrecuperação dentro do próprio
LuckTank. Vale documentar esse passo manual em algum lugar acessível pro dia
em que precisar dele.

## 5. O que NÃO está aqui (de propósito)

- Nenhuma senha, chave ou token real — só onde encontrá-los.
- Cobrança/renovação de contrato: hoje é 100% manual (campo
  `empresas.proxima_renovacao` é só um lembrete visual, sem gateway de
  pagamento) — fora do escopo deste runbook de credenciais técnicas.
