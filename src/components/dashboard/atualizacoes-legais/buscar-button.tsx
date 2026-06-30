"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuscarAtualizacoesButton() {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "loading" | "ok" | "erro">(
    "idle"
  );
  const [msg, setMsg] = useState("");

  async function buscar() {
    setEstado("loading");
    setMsg("");
    try {
      const res = await fetch("/api/cron/atualizacoes-legais", {
        credentials: "include",
      });
      const data = await res.json();
      console.log("[Leis & DOU] debug:", JSON.stringify(data.debug, null, 2));
      if (data.ok) {
        const novos = data.novos ?? 0;
        const buscados = data.buscados ?? 0;
        setMsg(
          novos > 0
            ? `${novos} nova${novos > 1 ? "s" : ""} publicação${novos > 1 ? "ões" : ""} encontrada${novos > 1 ? "s" : ""}!`
            : buscados === 0
              ? "Fontes sem resposta. Verifique console (F12)."
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
  );
}
