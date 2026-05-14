import { ScalesIcon } from "@/components/icons";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
        <ScalesIcon className="h-9 w-9 text-white" />
      </div>
      <div className="text-center">
        <h1 className="font-heading text-4xl font-semibold text-fg mb-2">
          AdvMartins
        </h1>
        <p className="font-body text-base text-muted">
          Painel em construção — em breve aqui estará o dashboard completo.
        </p>
      </div>
      <a
        href="/"
        className="font-body text-sm text-primary hover:text-primary-dark transition-colors duration-150 cursor-pointer"
      >
        ← Voltar ao login
      </a>
    </div>
  );
}
