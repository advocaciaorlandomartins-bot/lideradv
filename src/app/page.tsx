import LoginForm from "@/components/login-form";
import { CheckIcon, ScalesIcon } from "@/components/icons";

const features = [
  { label: "Gestão de Clientes", desc: "Cadastro completo e histórico" },
  { label: "Controle de Processos", desc: "Acompanhamento em tempo real" },
  { label: "Controle Financeiro", desc: "Honorários, custas e despesas" },
  { label: "Perícias e Documentos", desc: "Organização centralizada" },
  { label: "Cofre de Senhas", desc: "Senhas dos clientes protegidas" },
  {
    label: "Busca Automática por OAB",
    desc: "Consulta nos portais da justiça",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left Brand Panel ── */}
      <aside className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle decorative rings */}
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
            Gestão jurídica completa na palma da sua mão.
          </h2>
          <p className="font-body text-base leading-relaxed text-white/70 max-w-sm">
            Tudo o que um advogado precisa para organizar, controlar e expandir
            seu escritório.
          </p>

          <div className="my-8 border-t border-white/20" />

          {/* Feature list */}
          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <p className="font-body text-sm text-white">
                  <span className="font-semibold">{f.label}</span>
                  <span className="text-white/60"> — {f.desc}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative font-body text-xs text-white/40">
          © {new Date().getFullYear()} LiderAdv. Todos os direitos reservados.
        </p>
      </aside>

      {/* ── Right Form Panel ── */}
      <main className="flex flex-1 items-center justify-center bg-bg p-8 lg:w-1/2">
        <LoginForm />
      </main>
    </div>
  );
}
