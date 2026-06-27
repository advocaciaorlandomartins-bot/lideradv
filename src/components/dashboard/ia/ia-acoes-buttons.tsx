"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const IaPeticaoModal = dynamic(() => import("./ia-peticao-modal"), {
  ssr: false,
});
const IaAnalisarModal = dynamic(() => import("./ia-analisar-modal"), {
  ssr: false,
});

interface Props {
  clienteId?: string;
  processoId?: string;
  areaProcesso?: string;
}

export default function IaAcoesButtons({
  clienteId,
  processoId,
  areaProcesso,
}: Props) {
  const [modal, setModal] = useState<"peticao" | "analisar" | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModal("peticao")}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          ✍️ Gerar petição
        </button>
        <button
          onClick={() => setModal("analisar")}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg hover:border-primary hover:text-primary transition-colors"
        >
          🔍 Analisar documento
        </button>
      </div>

      {modal === "peticao" && (
        <IaPeticaoModal
          clienteId={clienteId}
          processoId={processoId}
          areaProcesso={areaProcesso}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "analisar" && (
        <IaAnalisarModal
          clienteId={clienteId}
          processoId={processoId}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
