"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DocumentArrowUpIcon } from "@/components/icons";

const AiDocumentImport = dynamic(() => import("./ai-document-import"), {
  ssr: false,
});

export default function ImportarDocumentoButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
      >
        <DocumentArrowUpIcon className="h-4 w-4" />
        Importar por documento (IA)
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              {/* Sem onSuccess: ao criar com sucesso, AiDocumentImport já
                  redireciona pra /dashboard/clientes por conta própria —
                  faz sentido aqui, já que estamos na página de cadastro
                  vazia, não em cima da lista de clientes. */}
              <AiDocumentImport compact onClose={() => setAberto(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
