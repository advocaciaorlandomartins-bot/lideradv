"use client";

import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "Funcionalidades", href: "#features" },
  { label: "Benefícios", href: "#benefits" },
  { label: "Depoimentos", href: "#testimonials" },
  { label: "Planos", href: "#pricing" },
];

const stats = [
  { number: "+5.000", label: "Escritórios" },
  { number: "+80.000", label: "Usuários ativos" },
  { number: "+5 milhões", label: "Processos monitorados" },
  { number: "+R$ 1 Bi", label: "Em honorários cobrados" },
];

const features = [
  {
    icon: "👥",
    title: "Gestão de Clientes",
    desc: "Cadastro completo e histórico centralizado. Tenha toda a informação do cliente em um único lugar, acessível quando precisar.",
  },
  {
    icon: "📋",
    title: "Controle de Processos",
    desc: "Acompanhamento em tempo real com automação de prazos. Nunca perca um prazo importante e tenha visibilidade total de cada processo.",
  },
  {
    icon: "💰",
    title: "Controle Financeiro Avançado",
    desc: "Gestão de honorários, custas e despesas. Dashboard financeiro com visibilidade total da receita e rentabilidade por cliente.",
  },
  {
    icon: "🔒",
    title: "Cofre de Senhas Seguro",
    desc: "Gerencie senhas de clientes com segurança de nível enterprise. Criptografia end-to-end com acesso controlado por usuário.",
  },
  {
    icon: "📄",
    title: "Repositório Centralizado",
    desc: "Organização completa de perícias, petições e documentos. Busca rápida, indexação automática e controle de acesso.",
  },
  {
    icon: "🔍",
    title: "Busca Automática por OAB",
    desc: "Consulte automaticamente os portais da justiça. Economize horas de pesquisa manual com integração inteligente.",
  },
];

const benefits = [
  {
    title: "Mais tempo para estratégia, menos burocracia",
    desc: "Automatize prazos, intimações e tarefas repetitivas. Sua equipe trabalha no que realmente gera valor e crescimento.",
  },
  {
    title: "Mais controle sobre resultados, menos margem para erros",
    desc: "Tenha visibilidade completa da sua operação com métricas em tempo real, controle financeiro integrado e relatórios inteligentes.",
  },
  {
    title: "Mais clientes atendidos com a mesma equipe",
    desc: "Quando processos complexos rodam automaticamente, você consegue aceitar mais casos sem comprometer a qualidade do trabalho.",
  },
];

const testimonials = [
  {
    text: '"Há 7 anos o LiderAdv traz a gestão que meu escritório precisa para crescer cada vez mais."',
    initials: "FC",
    name: "Fernando Cavalcante",
    role: "Sócio — FC Advocacia",
  },
  {
    text: '"O sistema do LiderAdv transformou minha gestão: trouxe controle real da produção, segurança ao delegar e estrutura para escalar."',
    initials: "ML",
    name: "Marina Lopes",
    role: "Sócia — Lopes & Cia",
  },
  {
    text: '"O LiderAdv me proporciona algo raro na rotina jurídica, mas que valorizo imensamente: liberdade para advogar com estratégia."',
    initials: "PR",
    name: "Paulo Ribeiro",
    role: "CEO — Ribeiro & Partners",
  },
];

const plans = [
  {
    name: "Starter",
    price: "R$ 99",
    period: "/mês",
    desc: "Para advogados solo e pequenos escritórios que estão começando",
    features: [
      "Até 100 processos ativos",
      "2 usuários inclusos",
      "Gestão básica de clientes",
      "Controle de prazos",
      "Suporte por e-mail",
    ],
    popular: false,
    cta: "Começar Agora",
  },
  {
    name: "Profissional",
    price: "R$ 299",
    period: "/mês",
    desc: "Ideal para escritórios em crescimento",
    features: [
      "Até 1.000 processos ativos",
      "Até 10 usuários",
      "Gestão completa integrada",
      "Relatórios avançados",
      "Busca automática por OAB",
      "Cofre de senhas",
      "Suporte prioritário",
    ],
    popular: true,
    cta: "Começar Agora",
  },
  {
    name: "Empresarial",
    price: "Sob Consulta",
    period: "",
    desc: "Para escritórios estabelecidos e com grande operação",
    features: [
      "Processos ilimitados",
      "Usuários ilimitados",
      "Integrações customizadas",
      "API completa",
      "Suporte 24/7 dedicado",
      "Treinamento personalizado",
    ],
    popular: false,
    cta: "Solicitar Demo",
  },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden font-body text-fg">
      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 border-b border-[#5b8fee]/20 shadow-lg"
        style={{
          background: "rgba(10,20,50,0.96)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="LiderAdv"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="font-heading text-xl font-bold text-white tracking-tight">
            Lider<span className="text-[#5b8fee]">Adv</span>
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="text-white/70 hover:text-[#5b8fee] text-sm font-medium transition-colors duration-200"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <Link
          href="/registro"
          className="rounded-full bg-gradient-to-r from-[#5b8fee] to-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_15px_rgba(91,143,238,0.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(91,143,238,0.45)] transition-all duration-200"
        >
          <span className="whitespace-nowrap">Começar Grátis</span>
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative flex min-h-screen items-center pt-20 pb-16 px-6 sm:px-10 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0a1432 0%, #1a2d5c 100%)",
        }}
      >
        {/* blob */}
        <div
          className="pointer-events-none absolute -top-1/4 -right-20 h-[700px] w-[700px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #5b8fee, transparent)",
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20 items-center w-full">
          {/* Text */}
          <div>
            <h1 className="font-heading text-4xl sm:text-5xl font-extrabold leading-tight text-white mb-6 tracking-tight">
              Comande seu escritório{" "}
              <span
                className="bg-gradient-to-r from-[#5b8fee] to-[#0066ff] bg-clip-text"
                style={{
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                com inteligência de dados, automações e IA jurídica
              </span>
              , em um único software
            </h1>
            <p className="text-white/85 text-lg leading-relaxed mb-8 max-w-lg">
              Conecte todas as áreas do seu escritório em um único ecossistema e
              tenha prazos sob controle, financeiro integrado e rotinas
              inteligentes.
            </p>

            <div className="flex flex-wrap gap-4 mb-6">
              <Link
                href="/registro"
                className="rounded-full bg-gradient-to-r from-[#5b8fee] to-[#0066ff] px-8 py-3.5 font-bold text-white shadow-[0_10px_30px_rgba(91,143,238,0.3)] hover:-translate-y-1 hover:shadow-[0_15px_45px_rgba(91,143,238,0.45)] transition-all duration-200"
              >
                Teste Grátis por 7 Dias
              </Link>
              <button
                onClick={() => scrollTo("features")}
                className="rounded-full border-2 border-white/30 px-8 py-3.5 font-bold text-white hover:border-[#5b8fee] hover:bg-[#5b8fee]/10 hover:text-[#5b8fee] transition-all duration-200"
              >
                Ver Funcionalidades
              </button>
            </div>

            <p className="text-white/60 text-sm font-medium">
              ✓ Sem cartão de crédito &nbsp;•&nbsp; Sem compromisso
              &nbsp;•&nbsp; Cancele quando quiser
            </p>
          </div>

          {/* Dashboard mock */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="animate-float w-full max-w-xs sm:max-w-sm rounded-3xl border border-[#5b8fee]/40 p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(91,143,238,0.2), rgba(0,102,255,0.1))",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* fake top bar */}
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <div className="ml-auto h-2 w-24 rounded bg-white/10" />
              </div>
              {/* fake KPI row */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {["💼 Processos", "💰 Receita", "📅 Prazos", "👥 Clientes"].map(
                  (k) => (
                    <div key={k} className="rounded-xl bg-white/10 p-3">
                      <p className="text-[11px] text-white/60 mb-1">{k}</p>
                      <div className="h-4 w-3/4 rounded bg-[#5b8fee]/50" />
                    </div>
                  )
                )}
              </div>
              {/* fake list */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 mb-1.5"
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-[#5b8fee]/60" />
                  <div className="h-2 flex-1 rounded bg-white/15" />
                  <div className="h-2 w-10 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white py-20 px-6 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-[#5b8fee] uppercase tracking-widest mb-2">
              Nós temos o
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-fg mb-4 leading-tight">
              Software jurídico completo para a gestão do seu escritório de
              advocacia.
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Da captação do cliente à entrega final do processo, centralize
              toda a operação em uma única plataforma inteligente.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-gradient-to-br from-[#f8f9fa] to-white p-6 text-center hover:border-[#5b8fee] hover:shadow-[0_10px_30px_rgba(91,143,238,0.1)] hover:-translate-y-1 transition-all duration-300"
              >
                <p
                  className="font-heading text-3xl sm:text-4xl font-black mb-1"
                  style={{
                    background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.number}
                </p>
                <p className="text-sm font-semibold text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="bg-[#f8f9fa] py-20 px-6 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-fg mb-4 leading-tight">
              Tudo que seu escritório precisa, integrado em um único lugar
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Gestão completa de processos, clientes e financeiro. Uma solução
              profissional para quem quer crescer sem burocracia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-white p-7 shadow-sm hover:-translate-y-2 hover:border-[#5b8fee] hover:shadow-[0_15px_40px_rgba(91,143,238,0.15)] transition-all duration-300"
              >
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl text-2xl shadow-[0_4px_15px_rgba(91,143,238,0.3)]"
                  style={{
                    background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                  }}
                >
                  {f.icon}
                </div>
                <h3 className="font-heading text-lg font-bold text-fg mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section id="benefits" className="bg-white py-20 px-6 sm:px-10">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-fg mb-10 leading-tight">
              Comece hoje mesmo e transforme seu escritório
            </h2>
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-5 mb-8">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl text-white shadow-[0_4px_15px_rgba(91,143,238,0.3)]"
                  style={{
                    background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                  }}
                >
                  ✓
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-fg mb-1">
                    {b.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Visual placeholder */}
          <div
            className="hidden lg:flex h-96 rounded-2xl shadow-[0_20px_50px_rgba(91,143,238,0.2)] items-center justify-center"
            style={{ background: "linear-gradient(135deg, #5b8fee, #0066ff)" }}
          >
            <div className="text-center text-white/80 p-8">
              <p className="text-6xl mb-4">⚖️</p>
              <p className="font-heading text-2xl font-bold">LiderAdv</p>
              <p className="text-sm mt-2 opacity-75">
                Gestão Jurídica Completa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section
        id="testimonials"
        className="py-20 px-6 sm:px-10"
        style={{
          background: "linear-gradient(135deg, #0a1432 0%, #1a2d5c 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-[#5b8fee] uppercase tracking-widest mb-2">
              Alcance seu potencial
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
              Mais de 5.000 escritórios já transformaram seus resultados com o
              LiderAdv
            </h2>
            <p className="text-white/70">O próximo pode ser o seu.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-[#5b8fee]/30 bg-white/8 p-7 hover:border-[#5b8fee] hover:bg-[#5b8fee]/15 hover:-translate-y-1 transition-all duration-300"
                style={{ backdropFilter: "blur(10px)" }}
              >
                <p className="text-white/90 italic leading-relaxed mb-6 text-[0.95rem]">
                  {t.text}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm text-white shadow-[0_4px_15px_rgba(91,143,238,0.3)]"
                    style={{
                      background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                    }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-white/50 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="bg-[#f8f9fa] py-20 px-6 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-fg mb-3 leading-tight">
              Cada escritório tem sua realidade
            </h2>
            <p className="text-muted">
              Nós temos a estrutura para todas elas. Escolha o plano que melhor
              se adequa ao seu crescimento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl p-8 text-center transition-all duration-300 ${
                  p.popular
                    ? "border-2 border-[#5b8fee] bg-white shadow-[0_20px_50px_rgba(91,143,238,0.2)] md:scale-105"
                    : "border border-border bg-white shadow-sm hover:-translate-y-2 hover:border-[#5b8fee] hover:shadow-[0_15px_40px_rgba(91,143,238,0.15)]"
                }`}
              >
                {p.popular && (
                  <span
                    className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-5 py-1.5 text-xs font-bold text-white shadow-[0_4px_15px_rgba(91,143,238,0.3)]"
                    style={{
                      background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                    }}
                  >
                    MAIS POPULAR
                  </span>
                )}

                <p className="font-heading text-xl font-bold text-fg mb-3">
                  {p.name}
                </p>
                <p
                  className="font-heading text-4xl font-black mb-1"
                  style={{
                    background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {p.price}
                  <span
                    className="text-base font-semibold text-muted"
                    style={{ WebkitTextFillColor: "initial" }}
                  >
                    {p.period}
                  </span>
                </p>
                <p className="text-sm text-muted mb-6 mt-1">{p.desc}</p>

                <ul className="text-left mb-8 space-y-3">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-muted border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-[#5b8fee] font-bold text-base leading-none mt-0.5">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/registro"
                  className="block w-full rounded-full py-3 font-bold text-sm text-white text-center shadow-[0_4px_15px_rgba(91,143,238,0.25)] hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(91,143,238,0.4)] transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #5b8fee, #0066ff)",
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section
        className="py-20 px-6 sm:px-10 text-center"
        style={{ background: "linear-gradient(135deg, #5b8fee, #0066ff)" }}
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
            Pronto para transformar seu escritório?
          </h2>
          <p className="text-white/90 text-lg mb-8 leading-relaxed">
            Junte-se a mais de 5.000 escritórios que já automatizaram sua gestão
            jurídica e crescem com o LiderAdv.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/registro"
              className="rounded-full bg-white px-8 py-3.5 font-bold text-[#0066ff] hover:bg-white/90 hover:-translate-y-1 transition-all duration-200 shadow-lg"
            >
              Começar Gratuitamente
            </Link>
            <Link
              href="/login"
              className="rounded-full border-2 border-white/50 px-8 py-3.5 font-bold text-white hover:border-white hover:bg-white/10 transition-all duration-200"
            >
              Já tenho conta
            </Link>
          </div>
          <p className="mt-6 text-white/70 text-sm">
            Sem cartão de crédito • Setup em menos de 5 minutos
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0a1432] pt-14 pb-8 px-6 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="LiderAdv"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="font-heading text-lg font-bold text-white">
                  Lider<span className="text-[#5b8fee]">Adv</span>
                </span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                Gestão jurídica completa para advogados que querem crescer com
                eficiência.
              </p>
            </div>

            <div>
              <h3 className="text-[#5b8fee] font-semibold text-sm mb-4 uppercase tracking-wide">
                Produto
              </h3>
              <ul className="space-y-2.5">
                {["Funcionalidades", "Planos", "Integrações", "Segurança"].map(
                  (l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-white/50 hover:text-[#5b8fee] text-sm transition-colors duration-150"
                      >
                        {l}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h3 className="text-[#5b8fee] font-semibold text-sm mb-4 uppercase tracking-wide">
                Empresa
              </h3>
              <ul className="space-y-2.5">
                {["Sobre nós", "Blog", "Carreiras", "Imprensa"].map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-white/50 hover:text-[#5b8fee] text-sm transition-colors duration-150"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[#5b8fee] font-semibold text-sm mb-4 uppercase tracking-wide">
                Suporte
              </h3>
              <ul className="space-y-2.5">
                {[
                  "Central de Ajuda",
                  "Contato",
                  "Termos de Uso",
                  "Privacidade",
                ].map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-white/50 hover:text-[#5b8fee] text-sm transition-colors duration-150"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-[#5b8fee]/15 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} LiderAdv. Todos os direitos
              reservados.
            </p>
            <div className="flex gap-6">
              <Link
                href="/login"
                className="text-white/30 hover:text-[#5b8fee] text-xs transition-colors duration-150"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="text-white/30 hover:text-[#5b8fee] text-xs transition-colors duration-150"
              >
                Cadastrar
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
