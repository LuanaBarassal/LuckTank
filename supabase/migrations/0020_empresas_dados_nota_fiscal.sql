-- LuckTank — dados que o motorista informa no posto pra pedir a nota fiscal
-- eletrônica, POR EMPRESA (cada empresa cliente tem os seus): CNPJ em que a
-- NF deve ser emitida e pra onde o posto/motorista manda o comprovante.
-- Regra de ouro: não editar migrations antigas. Isto só ADICIONA em cima do schema existente.
--
-- Usado na etiqueta impressa do QR (seção "DADOS PARA A NOTA FISCAL"), na
-- etapa da NF do fluxo do motorista e nos botões de envio (WhatsApp/e-mail).
-- Três colunas em vez de um "contato" texto livre: o botão de WhatsApp
-- precisa do número isolado (link wa.me) e o de e-mail do endereço isolado.
--
-- Formato canônico = só dígitos (cnpj: 14; whatsapp: DDD + número, 10 ou 11
-- dígitos, sem o 55 — o código do país é adicionado ao montar o link). A
-- formatação pra exibição fica em lib/formatacao.ts. CHECKs como defesa em
-- profundidade (mesmo padrão da 0017): a validação de verdade, inclusive
-- dígito verificador do CNPJ, é o Zod em lib/validacao/schemas.ts.
-- Todas nullable: empresa sem dados configurados só não mostra a seção.

alter table empresas
  add column if not exists nota_fiscal_cnpj text,
  add column if not exists nota_fiscal_whatsapp text,
  add column if not exists nota_fiscal_email text,
  add constraint empresas_nota_fiscal_cnpj_formato
    check (nota_fiscal_cnpj is null or nota_fiscal_cnpj ~ '^\d{14}$'),
  add constraint empresas_nota_fiscal_whatsapp_formato
    check (nota_fiscal_whatsapp is null or nota_fiscal_whatsapp ~ '^\d{10,11}$'),
  add constraint empresas_nota_fiscal_email_formato
    check (nota_fiscal_email is null or nota_fiscal_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Valores iniciais do cliente piloto (pedido do usuário, 2026-09-23). Só
-- preenche se ainda estiver vazio — reaplicar não sobrescreve o que o
-- administrador já tiver editado em Configurações.
update empresas
set
  nota_fiscal_cnpj = coalesce(nota_fiscal_cnpj, '18785716000107'),
  nota_fiscal_whatsapp = coalesce(nota_fiscal_whatsapp, '13974064858'),
  nota_fiscal_email = coalesce(nota_fiscal_email, 'expressomundialturismo@gmail.com')
where nome ilike 'expresso mundial%';
