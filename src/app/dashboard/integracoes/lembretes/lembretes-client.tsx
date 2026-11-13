"use client";

import { useEffect, useState, useCallback } from "react";

interface Lembrete {
  id: string;
  tipo: string;
  destinatario: string;
  cliente: string;
  enviarEm?: string;
  enviadoEm?: string;
  mensagem: string;
  erro?: string | null;
}

type Aba = "pendentes" | "enviados";

function formatarData(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LembretesClient() {
  const [aba, setAba] = useState<Aba>("pendentes");
  const [cliente, setCliente] = useState("");
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    const params = new URLSearchParams();
    if (aba === "enviados") params.set("enviados", "1");
    if (cliente.trim()) params.set("cliente", cliente.trim());
    else params.set("dias", "30");
    const res = await fetch(`/api/admin/lembretes-pendentes?${params}`).catch(
      () => null
    );
    const body = await res?.json().catch(() => null);
    setLembretes(body?.lembretes ?? []);
    setCarregando(false);
  }, [aba, cliente]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    buscar();
  }, [buscar]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Lembretes Automáticos
        </h1>
        <p className="font-body text-sm text-muted">
          Mensagens de WhatsApp agendadas pelo sistema (perícias, honorários,
          DCB, prazos). Aqui não existe envio manual — é só conferência do que
          está programado ou do que já saiu.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => setAba("pendentes")}
            className={`rounded-md px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
              aba === "pendentes"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setAba("enviados")}
            className={`rounded-md px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
              aba === "enviados"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Enviados
          </button>
        </div>

        <input
          type="text"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Filtrar por nome do cliente…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-body text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <p className="font-body text-xs text-muted">
          {cliente.trim()
            ? "Mostrando todo o cronograma do cliente filtrado"
            : aba === "pendentes"
              ? "Próximos 30 dias"
              : "Últimas 24 horas"}
        </p>
      </div>

      <div className="space-y-2">
        {carregando && (
          <p className="font-body text-sm text-muted">Carregando…</p>
        )}
        {!carregando && lembretes.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center font-body text-sm text-muted">
            Nenhum lembrete {aba === "pendentes" ? "pendente" : "enviado"}{" "}
            encontrado{cliente.trim() ? ` para "${cliente.trim()}"` : ""}.
          </p>
        )}
        {lembretes.map((l) => (
          <div
            key={l.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <button
              onClick={() => setExpandido(expandido === l.id ? null : l.id)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                    {l.tipo}
                  </span>
                  <span className="font-body text-sm font-semibold text-slate-900">
                    {l.cliente}
                  </span>
                </div>
                <p className="mt-1 font-body text-xs text-muted">
                  {l.destinatario}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="font-body text-xs font-semibold text-slate-700">
                  {formatarData(l.enviarEm ?? l.enviadoEm)}
                </p>
                {l.erro && (
                  <p className="mt-0.5 font-body text-[11px] font-semibold text-red-600">
                    Erro no envio
                  </p>
                )}
              </div>
            </button>
            {expandido === l.id && (
              <div className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-body text-xs text-slate-700">
                {l.mensagem}
                {l.erro && (
                  <p className="mt-2 font-body text-[11px] font-semibold text-red-600">
                    Erro: {l.erro}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
