export const metadata = { title: "Termos de Uso — LuckTank" };

export default function TermosDeUsoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-14 text-neutral-800">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">LuckTank</p>
        <h1 className="mt-1 font-title text-2xl font-bold text-neutral-900">Termos de Uso</h1>
        <p className="mt-1 text-sm text-neutral-500">Última atualização: 07/07/2026</p>
      </div>

      <p>
        Estes termos regem o uso do LuckTank pela empresa que contratou o serviço
        (&ldquo;Empresa Contratante&rdquo;) e por seus usuários autorizados.
      </p>

      <Secao titulo="O serviço">
        <p>
          O LuckTank é uma ferramenta de controle de combustível e prevenção de fraude pra frotas. O
          acesso é fornecido mediante contratação direta, nos valores e condições combinados
          individualmente entre as partes.
        </p>
      </Secao>

      <Secao titulo="Responsabilidades da Empresa Contratante">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cadastrar corretamente seus veículos, motoristas e usuários do escritório.</li>
          <li>Garantir que os usuários com acesso administrativo protejam suas credenciais (senha e PIN).</li>
          <li>Informar seus motoristas sobre o uso do sistema, conforme a <a href="/privacidade" className="font-medium text-primary-700 underline underline-offset-2">Política de Privacidade</a>.</li>
          <li>Usar o sistema apenas pros fins de controle de frota descritos aqui — não é permitido uso para finalidade diferente do combinado.</li>
        </ul>
      </Secao>

      <Secao titulo="Responsabilidades do LuckTank">
        <ul className="list-disc space-y-2 pl-5">
          <li>Manter o sistema disponível dentro do razoável, com esforço comercial pra resolver problemas reportados.</li>
          <li>Não acessar nem usar os dados da Empresa Contratante além do necessário pra prestar suporte técnico quando solicitado.</li>
          <li>Comunicar com antecedência razoável qualquer mudança relevante no serviço.</li>
        </ul>
      </Secao>

      <Secao titulo="Pagamento">
        <p>
          O valor e a forma de pagamento são definidos individualmente com cada Empresa Contratante,
          conforme acordado no momento da contratação.
        </p>
      </Secao>

      <Secao titulo="Cancelamento">
        <p>
          Qualquer uma das partes pode encerrar o contrato mediante aviso prévio combinado entre as
          partes. Os dados da Empresa Contratante podem ser exportados (Excel, PDF, fotos) antes do
          encerramento.
        </p>
      </Secao>

      <Secao titulo="Limitação de responsabilidade">
        <p>
          O LuckTank é uma ferramenta de apoio à gestão — as decisões finais sobre fraude, disciplina
          de motoristas ou qualquer ação administrativa são de responsabilidade exclusiva da Empresa
          Contratante.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>luwebdesigners@gmail.com</p>
      </Secao>

      <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        Texto de referência pra formalizar a relação comercial — não substitui um contrato revisado
        por advogado se isso for necessário pro seu caso.
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
