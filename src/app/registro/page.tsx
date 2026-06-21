import Link from "next/link";
import RegisterForm from "@/components/register-form";
import { ScalesIcon } from "@/components/icons";

const steps = [
  {
    number: "01",
    title: "Crie sua conta",
    desc: "Preencha seus dados e inscrição na OAB",
  },
  {
    number: "02",
    title: "Configure o escritório",
    desc: "Adicione seus clientes e processos",
  },
  {
    number: "03",
    title: "Trabalhe com eficiência",
    desc: "Controle tudo em um só lugar",
  },
];

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left Brand Panel ── */}
      <aside className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative rings */}
        <div
          className="pointer-events-none select-none absolute inset-0 opacity-[0.06]"
          aria-hidden="true"
        >
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full border-2 border-white" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full border-2 border-white" />
        </div>

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
              <ScalesIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="font-heading text-3xl font-semibold leading-none text-white">
                LiderAdv
              </div>
              <div className="mt-1 font-body text-sm text-white/60">
                Gestão Jurídica
              </div>
            </div>
          </div>

          {/* Headline */}
          <h2 className="font-heading text-4xl font-semibold leading-snug text-white mb-4 max-w-xs">
            Seu escritório organizado em minutos.
          </h2>
          <p className="font-body text-base leading-relaxed text-white/70 max-w-sm">
            Cadastre-se agora e tenha acesso completo ao sistema de gestão
            jurídica mais completo do mercado.
          </p>

          <div className="my-8 border-t border-white/20" />

          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-start gap-4">
                {/* Step number + connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 font-body text-sm font-bold ${
                      i === 0
                        ? "border-amber-400 bg-amber-400 text-white"
                        : "border-white/30 text-white/40"
                    }`}
                  >
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="mt-1 h-8 w-px bg-white/20" />
                  )}
                </div>
                <div className="pt-1">
                  <p
                    className={`font-body text-sm font-semibold ${
                      i === 0 ? "text-white" : "text-white/40"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`font-body text-sm mt-0.5 ${
                      i === 0 ? "text-white/70" : "text-white/30"
                    }`}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between">
          <p className="font-body text-xs text-white/40">
            © {new Date().getFullYear()} LiderAdv. Todos os direitos reservados.
          </p>
          <Link
            href="/login"
            className="font-body text-xs text-white/50 hover:text-white/80 transition-colors duration-150"
          >
            ← Já tenho conta
          </Link>
        </div>
      </aside>

      {/* ── Right Form Panel ── */}
      <main className="flex flex-1 items-center justify-center bg-bg p-8 lg:w-1/2 lg:overflow-y-auto">
        <RegisterForm />
      </main>
    </div>
  );
}
