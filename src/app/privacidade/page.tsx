import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — LiderAdv",
  description: "Como coletamos, usamos e protegemos seus dados pessoais.",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Última atualização: junho de 2026 · Versão 1.0
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            1. Quem somos (Controlador)
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            O <strong>LiderAdv</strong> é operado pela{" "}
            <strong>Advocacia Orlando Martins</strong>, pessoa física inscrita
            na OAB/AL sob nº 14.381. Para fins de LGPD, somos o{" "}
            <strong>Controlador</strong> dos dados pessoais tratados nesta
            plataforma.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Contato do Encarregado (DPO):{" "}
            <a
              href="mailto:advocaciaorlandomartins@gmail.com"
              className="text-blue-600 underline"
            >
              advocaciaorlandomartins@gmail.com
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            2. Dados pessoais que coletamos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">
                    Categoria
                  </th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">
                    Dados
                  </th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">
                    Finalidade
                  </th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">
                    Base Legal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 text-gray-700 font-medium align-top">
                    Identificação
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Nome, CPF/CNPJ, RG, data de nascimento, gênero, estado
                    civil, profissão, nacionalidade, filiação
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Abertura de processo, elaboração de documentos jurídicos,
                    representação legal
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Execução de contrato (art. 7º, V)
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700 font-medium align-top">
                    Contato
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Endereço, CEP, telefone, e-mail
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Comunicação sobre o processo, envio de documentos
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Execução de contrato (art. 7º, V)
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700 font-medium align-top">
                    Saúde / Previdenciário
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    CID, tipo de incapacidade, data do diagnóstico, afastamento,
                    NIS, número de benefício, tipo e valor de benefício
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Condução de processos previdenciários no INSS e Justiça
                    Federal
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Exercício regular de direito pelo advogado + consentimento
                    específico (art. 11, II, a e f)
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700 font-medium align-top">
                    Financeiro
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Honorários, valores de causa, lançamentos financeiros
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Gestão do contrato de honorários advocatícios
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Execução de contrato (art. 7º, V)
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-700 font-medium align-top">
                    Usuários do sistema
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Nome, e-mail (login), senha (hash), perfil de acesso
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Autenticação e controle de acesso à plataforma
                  </td>
                  <td className="px-3 py-2 text-gray-600 align-top">
                    Execução de contrato (art. 7º, V)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            3. Compartilhamento com terceiros
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Seus dados podem ser processados pelos seguintes operadores, todos
            com medidas de segurança adequadas:
          </p>
          <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
            <li>
              <strong>Neon (Supabase/PostgreSQL)</strong> — hospedagem do banco
              de dados (servidores na região sa-east-1, Brasil/AWS)
            </li>
            <li>
              <strong>Vercel</strong> — hospedagem da aplicação web (EUA; dados
              em trânsito criptografados via TLS)
            </li>
            <li>
              <strong>Resend</strong> — envio de e-mails transacionais (EUA;
              apenas endereço de e-mail e conteúdo do aviso)
            </li>
            <li>
              <strong>Anthropic (Claude AI)</strong> — resumo automático de
              e-mails recebidos (EUA; conteúdo anonimizado, sem armazenamento)
            </li>
            <li>
              <strong>Google Calendar</strong> — integração de agenda (EUA;
              mediante consentimento explícito do usuário)
            </li>
            <li>
              <strong>TramitaSign</strong> — assinaturas digitais de contratos
              (Brasil; nome, e-mail e CPF quando você solicita assinatura)
            </li>
            <li>
              <strong>PrevBot</strong> — triagem inicial via WhatsApp (Brasil;
              telefone e status do processo, mediante opt-in)
            </li>
          </ul>
          <p className="text-gray-600 text-sm leading-relaxed">
            Não vendemos, alugamos nem cedemos dados pessoais a terceiros para
            fins comerciais ou publicitários.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            4. Seus direitos (art. 18 LGPD)
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Como titular de dados, você tem direito a:
          </p>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>
              <strong>Acesso</strong> — confirmar a existência e obter cópia dos
              seus dados
            </li>
            <li>
              <strong>Correção</strong> — atualizar dados incompletos, inexatos
              ou desatualizados
            </li>
            <li>
              <strong>Anonimização ou exclusão</strong> — quando os dados forem
              desnecessários ou tratados em desconformidade
            </li>
            <li>
              <strong>Portabilidade</strong> — receber seus dados em formato
              estruturado
            </li>
            <li>
              <strong>Revogação do consentimento</strong> — a qualquer momento,
              sem prejudicar o tratamento anterior
            </li>
            <li>
              <strong>Oposição</strong> — quando o tratamento não atender às
              hipóteses legais
            </li>
          </ul>
          <p className="text-gray-600 text-sm leading-relaxed">
            Para exercer qualquer desses direitos, envie e-mail para{" "}
            <a
              href="mailto:advocaciaorlandomartins@gmail.com"
              className="text-blue-600 underline"
            >
              advocaciaorlandomartins@gmail.com
            </a>{" "}
            com o assunto <em>&quot;LGPD — [Direito solicitado]&quot;</em>.
            Responderemos em até 15 dias.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            5. Retenção de dados
          </h2>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>
              Dados de <strong>clientes ativos</strong>: mantidos pelo prazo do
              mandato + 5 anos (prescrição geral — art. 206, CC)
            </li>
            <li>
              Dados de <strong>clientes encerrados</strong> (soft-delete): 90
              dias, depois anonimizados automaticamente
            </li>
            <li>
              <strong>Leads/prospectos</strong> não convertidos: 180 dias após o
              último contato
            </li>
            <li>
              <strong>Logs de auditoria</strong>: 2 anos
            </li>
            <li>
              <strong>Tokens de redefinição de senha</strong>: 1 hora de
              validade, purge automático após 7 dias
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">6. Segurança</h2>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>Senhas armazenadas com hash SHA-256 + salt aleatório</li>
            <li>
              Sessões autenticadas por token HMAC-SHA256 com expiração de 8
              horas
            </li>
            <li>Cookie de sessão: HttpOnly, Secure, SameSite=Lax</li>
            <li>Comunicação criptografada via TLS (HTTPS)</li>
            <li>
              Controle de acesso por perfil (RBAC): Administrador, Sócio,
              Advogado, Estagiário, Colaborador
            </li>
            <li>Log de auditoria de todas as ações no sistema</li>
            <li>Headers de segurança HTTP: X-Frame-Options, CSP, nosniff</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            7. Transferência internacional
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Alguns operadores estão nos EUA (Vercel, Resend, Anthropic, Google).
            Essas transferências ocorrem com base nas salvaguardas previstas no
            art. 33 da LGPD (cláusulas contratuais padrão e políticas
            corporativas de privacidade desses provedores) e se limitam ao
            estritamente necessário para prestação do serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">8. Cookies</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Utilizamos apenas um cookie de sessão (<code>adv_session</code>),
            estritamente necessário para manter você autenticado. Não utilizamos
            cookies de rastreamento, publicidade ou analytics de terceiros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            9. Contato e reclamações
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Para dúvidas, solicitações LGPD ou reclamações, contate nosso
            Encarregado:
          </p>
          <p className="text-gray-600 text-sm">
            <strong>E-mail:</strong>{" "}
            <a
              href="mailto:advocaciaorlandomartins@gmail.com"
              className="text-blue-600 underline"
            >
              advocaciaorlandomartins@gmail.com
            </a>
            <br />
            Você também pode recorrer à ANPD (
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              www.gov.br/anpd
            </a>
            ).
          </p>
        </section>

        <div className="pt-4 border-t border-gray-100 flex gap-4 text-sm">
          <Link href="/registro" className="text-blue-600 hover:underline">
            ← Voltar ao cadastro
          </Link>
          <Link href="/termos" className="text-blue-600 hover:underline">
            Termos de Uso
          </Link>
        </div>
      </div>
    </div>
  );
}
