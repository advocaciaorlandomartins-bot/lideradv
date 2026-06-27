import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — LiderAdv",
  description: "Termos e condições de uso da plataforma LiderAdv.",
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
          <p className="mt-2 text-sm text-gray-500">
            Última atualização: junho de 2026 · Versão 1.0
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">1. Aceitação</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Ao criar uma conta e utilizar o <strong>LiderAdv</strong>, você
            concorda com estes Termos de Uso e com nossa{" "}
            <Link href="/privacidade" className="text-blue-600 underline">
              Política de Privacidade
            </Link>
            . Se não concordar, não utilize a plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            2. Sobre o serviço
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            O LiderAdv é um sistema de gestão jurídica destinado exclusivamente
            a advogados e escritórios de advocacia devidamente inscritos na OAB.
            A plataforma oferece funcionalidades de gestão de clientes,
            processos, financeiro, documentos, CRM, publicações e integrações
            com serviços jurídicos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            3. Cadastro e credenciais
          </h2>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>
              Você é responsável pela confidencialidade de suas credenciais de
              acesso.
            </li>
            <li>
              Não compartilhe sua senha com terceiros. Cada usuário deve ter
              acesso individual.
            </li>
            <li>
              Notifique-nos imediatamente em caso de acesso não autorizado:{" "}
              <a
                href="mailto:advocaciaorlandomartins@gmail.com"
                className="text-blue-600 underline"
              >
                advocaciaorlandomartins@gmail.com
              </a>
            </li>
            <li>
              Reservamo-nos o direito de encerrar contas utilizadas de forma
              irregular.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            4. Uso adequado
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            É <strong>proibido</strong>:
          </p>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>Utilizar a plataforma para fins ilícitos ou antiéticos.</li>
            <li>Tentar acessar dados de outros usuários sem autorização.</li>
            <li>
              Realizar engenharia reversa, scraping ou ataques ao sistema.
            </li>
            <li>
              Inserir dados falsos de clientes ou processos que possam causar
              prejuízos a terceiros.
            </li>
            <li>
              Utilizar as integrações com IA (Claude) para fins que violem os
              Termos de Uso da Anthropic.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            5. Dados inseridos
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Você é o <strong>controlador</strong> dos dados pessoais de seus
            clientes que insere na plataforma. O LiderAdv atua como{" "}
            <strong>operador</strong> (art. 5º, VII, LGPD) e processará esses
            dados apenas conforme suas instruções e para a finalidade de
            prestação do serviço.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Você é responsável por obter o consentimento ou ter base legal
            adequada para inserir dados sensíveis (saúde, dados previdenciários)
            de seus clientes, conforme determina a LGPD.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            6. Disponibilidade e limitação de responsabilidade
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Fazemos nosso melhor esforço para manter a plataforma disponível
            24/7, mas não garantimos disponibilidade ininterrupta. Não nos
            responsabilizamos por perdas decorrentes de indisponibilidade
            temporária, falhas de terceiros (Vercel, Neon, etc.) ou eventos de
            força maior.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            As funcionalidades de IA (resumo de e-mails, geração de documentos)
            são auxiliares e não substituem o julgamento profissional do
            advogado. Revise sempre os resultados gerados por IA antes de
            usá-los.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            7. Propriedade intelectual
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            O LiderAdv, seu código-fonte, design e funcionalidades são
            propriedade da Advocacia Orlando Martins. Os dados inseridos por
            você permanecem de sua propriedade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">8. Rescisão</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Você pode encerrar sua conta a qualquer momento solicitando ao
            administrador ou via e-mail. Após o encerramento, seus dados serão
            mantidos pelo prazo legal aplicável e depois anonimizados ou
            excluídos conforme nossa{" "}
            <Link href="/privacidade" className="text-blue-600 underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">9. Alterações</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Podemos atualizar estes Termos a qualquer momento. Alterações
            significativas serão comunicadas por e-mail com antecedência de 15
            dias. O uso continuado após a vigência das alterações implica
            aceitação.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            10. Lei aplicável e foro
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Estes Termos são regidos pelas leis brasileiras, especialmente a
            LGPD (Lei 13.709/2018) e o Marco Civil da Internet (Lei
            12.965/2014). Fica eleito o foro da comarca de Maceió/AL para
            dirimir quaisquer controvérsias.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-100 flex gap-4 text-sm">
          <Link href="/registro" className="text-blue-600 hover:underline">
            ← Voltar ao cadastro
          </Link>
          <Link href="/privacidade" className="text-blue-600 hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
