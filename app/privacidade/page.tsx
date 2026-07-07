export const metadata = { title: "Política de Privacidade — LuckTank" };

export default function PoliticaPrivacidadePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-14 text-neutral-800">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">LuckTank</p>
        <h1 className="mt-1 font-title text-2xl font-bold text-neutral-900">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-neutral-500">Última atualização: 07/07/2026</p>
      </div>

      <p>
        O LuckTank é uma ferramenta de controle de combustível e prevenção de fraude pra frotas,
        fornecida como software pra empresas de transporte (&ldquo;Empresa Contratante&rdquo;). Esta
        política explica quais dados tratamos, pra quê, e como protegemos — descrevendo o que o
        sistema realmente faz nesta versão, não um texto genérico.
      </p>

      <Secao titulo="Quem é responsável pelos dados">
        <p>
          <strong>LuckTank (operador):</strong> fornece a tecnologia e a infraestrutura. Não decide
          como os dados dos motoristas são usados além do propósito de controle de combustível e
          anti-fraude descrito aqui.
        </p>
        <p>
          <strong>Empresa Contratante (controladora):</strong> é a empregadora dos motoristas e dos
          usuários cadastrados no sistema. É responsável por informar seus motoristas e colaboradores
          sobre o uso do LuckTank, e por ter base legal (ex.: vínculo empregatício, interesse legítimo
          de controle patrimonial da própria frota) pra registrar os dados deles no sistema.
        </p>
      </Secao>

      <Secao titulo="Dados que coletamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Usuários do escritório:</strong> nome, e-mail, papel de acesso (supervisor,
            gerente ou administrador) e PIN de segurança — o PIN é guardado com hash (uma
            transformação irreversível), nunca em texto puro; nem a própria equipe do LuckTank
            consegue ver o PIN de alguém.
          </li>
          <li>
            <strong>Motoristas:</strong> nome e, opcionalmente, CPF — só se a Empresa Contratante
            optar por cadastrar esse dado.
          </li>
          <li>
            <strong>Veículos:</strong> placa, modelo, ano e dados técnicos (sem dado pessoal).
          </li>
          <li>
            <strong>Abastecimentos:</strong> data, litros, valor, posto, forma de pagamento e KM do
            veículo.
          </li>
          <li>
            <strong>Foto do comprovante:</strong> dependendo do celular usado, a foto pode trazer
            metadado técnico embutido pela câmera (data/hora e, às vezes, coordenadas de GPS). Esse
            dado de localização, quando presente, é armazenado — mas hoje não é exibido em nenhuma
            tela nem usado por nenhuma regra do sistema.
          </li>
        </ul>
      </Secao>

      <Secao titulo="Para que usamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Registrar abastecimentos e permitir consulta pelo escritório da Empresa Contratante.</li>
          <li>
            Sinalizar possíveis inconsistências (ex.: nota fiscal duplicada, consumo fora do padrão)
            — sempre como um alerta revisado por uma pessoa do escritório, nunca uma penalidade
            automática contra o motorista.
          </li>
          <li>Gerar relatórios (Excel/PDF) e cópias de fotos, quando solicitado por um usuário autorizado da própria empresa.</li>
        </ul>
      </Secao>

      <Secao titulo="Com quem compartilhamos">
        <p>
          Não vendemos nem compartilhamos dados com terceiros pra fins de marketing. Usamos os
          seguintes prestadores de infraestrutura, só pra operar o serviço:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Supabase</strong> — banco de dados e armazenamento das fotos de comprovante.</li>
          <li>
            <strong>Google Gemini</strong> — lê automaticamente o texto da foto do comprovante
            (litros, valor, posto); a foto é enviada só pra essa extração.
          </li>
          <li><strong>Vercel</strong> — hospedagem da aplicação.</li>
        </ul>
      </Secao>

      <Secao titulo="Segurança">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cada empresa só enxerga os próprios dados — isolamento reforçado no próprio banco de dados, não só na tela.</li>
          <li>PIN e senha nunca são armazenados em texto puro.</li>
          <li>Fotos de comprovante ficam num espaço de armazenamento privado, acessível só por usuário autenticado da própria empresa.</li>
          <li>Toda edição ou exclusão de dado fica registrada com usuário, data e hora (trilha de auditoria).</li>
        </ul>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto durar o contrato com a Empresa Contratante, e por um período razoável depois
          (para eventuais obrigações fiscais/contábeis da empresa), a menos que a empresa solicite a
          exclusão antes.
        </p>
      </Secao>

      <Secao titulo="Direitos do titular dos dados">
        <p>
          Motoristas e usuários podem solicitar — através da Empresa Contratante ou diretamente pelo
          contato abaixo — a correção ou exclusão dos seus dados, dentro do que a lei permitir.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>luwebdesigners@gmail.com</p>
      </Secao>

      <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        Este texto foi escrito pra refletir o funcionamento real do sistema nesta versão. Não
        substitui orientação jurídica — vale revisão por um advogado se for necessária garantia
        formal de conformidade completa com a LGPD.
      </p>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-title text-lg font-bold text-neutral-900">{titulo}</h2>
      {children}
    </section>
  );
}
