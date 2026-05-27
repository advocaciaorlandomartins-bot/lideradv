import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import ModeloForm from "@/components/dashboard/modelos/modelo-form";
import { createModeloAction } from "@/lib/modelo-actions";

export default function NovoModeloPage() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 font-body text-sm text-muted">
        <Link
          href="/dashboard/modelos"
          className="hover:text-primary transition-colors"
        >
          Modelos
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="text-fg font-semibold">Novo modelo</span>
      </nav>

      <div>
        <h1 className="font-heading text-2xl font-semibold text-fg">
          Novo Modelo de Documento
        </h1>
        <p className="mt-1 font-body text-sm text-muted">
          Escreva o conteúdo e insira variáveis que serão preenchidas com os
          dados de cada cliente.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <ModeloForm action={createModeloAction} />
      </div>
    </div>
  );
}
