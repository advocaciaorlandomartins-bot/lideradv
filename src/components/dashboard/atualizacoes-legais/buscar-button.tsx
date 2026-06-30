"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuscarAtualizacoesButton() {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "loading" | "ok" | "erro">(
    "idle"
  );
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState<
    { fonte: string; status: number; itens: number; erro?: string }[]
  >([]);

  async function buscar() {
    setEstado("loading");
    setMsg("");
    try {
      const res = await fetch("/api/cron/atualizacoes-legais", {
        credentials: "include",
      });
      const data = await res.json();
      if (Array.isArray(data.debug)) setDebug(data.debug);
      if (data.ok) {
        const novos = data.novos ?? 0;
        const buscados = data.buscados ?? 0;
        setMsg(
          novos > 0
            ? `${novos} publicação${novos > 1 ? "ões" : ""} nova${novos > 1 ? "s" : ""}!`
            : buscados === 0
              ? "Nenhuma fonte respondeu (ver abaixo)."
              : "Nenhuma publicação nova hoje."
        );
        setEstado(buscados === 0 ? "erro" : "ok");
        if (buscados > 0) router.refresh();
      } else {
        setMsg(data.error ?? data.msg ?? "Erro desconhecido.");
        setEstado("erro");
      }
    } catch {
      setMsg("Falha na conexão.");
      setEstado("erro");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {msg && (
          <span
            className={`text-xs font-medium ${
              estado === "ok" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {msg}
          </span>
        )}
        <button
          onClick={buscar}
          disabled={estado === "loading"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <span
            className={estado === "loading" ? "animate-spin inline-block" : ""}
          >
            ↻
          </span>
          {estado === "loading" ? "Buscando..." : "Buscar agora"}
        </button>
      </div>
      {debug.length > 0 && estado === "erro" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 w-72">
          <p className="font-semibold mb-1 text-slate-700">
            Diagnóstico de fontes:
          </p>
          {debug.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 last:border-0"
            >
              <span className="truncate">{d.fonte}</span>
              <span
                className={`shrink-0 font-mono ${d.itens > 0 ? "text-emerald-600" : d.status === 0 ? "text-red-500" : "text-amber-600"}`}
              >
                {d.itens > 0
                  ? `✓ ${d.itens} itens`
                  : d.erro
                    ? d.erro.slice(0, 20)
                    : `HTTP ${d.status}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
