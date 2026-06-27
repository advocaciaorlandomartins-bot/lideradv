"use client";

import { useState } from "react";

export default function LgpdActions({ clienteId }: { clienteId: string }) {
  const [anonimizando, setAnonimizando] = useState(false);
  const [feito, setFeito] = useState(false);

  async function handleAnonimizar() {
    setAnonimizando(true);
    try {
      const res = await fetch("/api/dados/anonimizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          motivo: "Solicitação LGPD via painel administrativo",
        }),
      });
      if (res.ok) {
        setFeito(true);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const data = await res.json();
        alert(data.error ?? "Erro ao anonimizar dados.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setAnonimizando(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="font-heading text-sm font-semibold text-amber-800 mb-1">
        LGPD — Dados pessoais
      </h3>
      <p className="text-xs text-amber-700 mb-3">
        Ações para atendimento dos direitos dos titulares (art. 18 LGPD).
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/dados/exportar?cliente_id=${clienteId}`}
          download
          className="flex h-9 items-center rounded-lg border border-amber-300 bg-white px-4 font-body text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
        >
          Exportar dados (portabilidade)
        </a>
        {feito ? (
          <span className="flex h-9 items-center rounded-lg bg-green-100 px-4 font-body text-sm font-semibold text-green-700">
            Dados anonimizados
          </span>
        ) : (
          <button
            onClick={handleAnonimizar}
            disabled={anonimizando}
            className="flex h-9 items-center rounded-lg border border-red-300 bg-white px-4 font-body text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {anonimizando ? "Anonimizando…" : "Anonimizar PII"}
          </button>
        )}
      </div>
    </div>
  );
}
