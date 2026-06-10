import LoginForm from "@/components/login-form";
import { CheckIcon } from "@/components/icons";
import Image from "next/image";

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
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row">
      {/* ── Left Brand Panel ── */}
      <aside
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #000D25 0%, #001848 60%, #003080 100%)",
        }}
      >
        {/* Decorative rings */}
        <div
          className="pointer-events-none select-none absolute inset-0 opacity-[0.07]"
          aria-hidden="true"
        >
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full border border-[#8FBEFF]" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full border border-[#8FBEFF]" />
        </div>

        <div className="relative flex flex-col justify-between w-full h-full p-10">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/logo1.png"
              alt="LiderAdv"
              width={240}
              height={240}
              className="brightness-[1.7] contrast-[1.1] drop-shadow-[0_0_45px_rgba(201,168,76,0.75)]"
              priority
            />
          </div>

          {/* Headline + descrição */}
          <div className="text-center">
            <h2 className="font-body text-2xl font-bold leading-snug text-white mb-3 whitespace-nowrap">
              Gestão jurídica completa na palma da sua mão.
            </h2>
            <p className="font-body text-base leading-relaxed text-[#8FBEFF]/80">
              Tudo o que um advogado precisa para organizar, controlar e
              expandir seu escritório.
            </p>
          </div>

          {/* Feature list */}
          <div>
            <div className="border-t border-[#8FBEFF]/20 mb-5" />
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8FBEFF]" />
                  <p className="font-body text-sm">
                    <span className="font-semibold text-white">{f.label}</span>
                    <span className="text-[#8FBEFF]/70"> — {f.desc}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="font-body text-xs text-white/30 text-center">
            © {new Date().getFullYear()} LiderAdv. Todos os direitos reservados.
          </p>
        </div>
      </aside>

      {/* ── Right Form Panel ── */}
      <main className="login-form-panel flex flex-1 items-center justify-center p-8 lg:w-1/2 overflow-auto">
        <LoginForm />
      </main>
    </div>
  );
}
