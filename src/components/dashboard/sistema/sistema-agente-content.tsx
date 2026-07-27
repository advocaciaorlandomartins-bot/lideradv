"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { SpinnerIcon } from "@/components/icons";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface LembreteItem {
  tipo: string;
  nome: string;
  telefone: string;
  enviar_em: string;
  tentativas: number;
  erro: string | null;
}

interface StatusSistema {
  lembretes: {
    pendentes: number;
    bloqueados: number;
    agendados: number;
    lista: LembreteItem[];
  };
  crm_pendentes: number;
}

const BOAS_VINDAS =
  `Olá! Sou o Agente do Sistema LiderAdv.\n\n` +
  `Posso executar ações reais:\n` +
  `• Diagnosticar e corrigir problemas\n` +
  `• Sincronizar publicações e intimações\n` +
  `• Reenviar mensagens WhatsApp falhadas\n` +
  `• Adicionar/remover OABs monitoradas\n` +
  `• Atualizar telefone, e-mail e dados do escritório\n` +
  `• Mostrar estatísticas e erros do sistema\n\n` +
  `Digite o que precisa ou use um dos atalhos abaixo.`;

const ATALHOS = [
  {
    label: "Diagnóstico completo",
    msg: "Faça um diagnóstico completo do sistema",
  },
  {
    label: "Reenviar lembretes",
    msg: "Verifique os erros e reenvie os lembretes de WhatsApp pendentes de agenda e pagamentos",
  },
  {
    label: "Ver erros",
    msg: "Mostre os erros recentes do sistema — lembretes e mensagens falhadas",
  },
  { label: "Sincronizar publicações", msg: "Sincronize as publicações agora" },
  {
    label: "Limpar fila antiga",
    msg: "Cancele todos os lembretes atrasados que já passaram da data sem enviá-los",
  },
  { label: "Listar OABs", msg: "Liste as OABs monitoradas" },
];

const TIPO_LABEL: Record<string, string> = {
  agenda: "📅 Agenda",
  honorario: "💰 Honorário",
  pagamento: "💳 Pagamento",
  aniversario: "🎂 Aniversário",
};

export default function SistemaAgenteContent() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: BOAS_VINDAS },
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<StatusSistema | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [listaAberta, setListaAberta] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregarStatus = useCallback(() => {
    fetch("/api/sistema/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStatus(data as StatusSistema);
        setStatusLoading(false);
      })
      .catch(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(carregarStatus, 0);
    return () => clearTimeout(t);
  }, [carregarStatus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function limpar() {
    setMessages([{ role: "assistant", content: BOAS_VINDAS }]);
    setInput("");
  }

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim();
    if (!msg || isPending) return;
    setInput("");

    const newMessages: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);

    startTransition(async () => {
      try {
        const res = await fetch("/api/sistema/agente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? data.error ?? "Erro ao processar.",
          },
        ]);
        // Atualiza o status após ação do agente
        carregarStatus();
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "❌ Erro de conexão. Tente novamente.",
          },
        ]);
      }
      inputRef.current?.focus();
    });
  }

  const showAtalhos = messages.length <= 1 && !isPending;
  const totalProblemas =
    (status?.lembretes.pendentes ?? 0) +
    (status?.lembretes.bloqueados ?? 0) +
    (status?.crm_pendentes ?? 0);

  return (
    <div
      className="flex flex-col gap-3"
      style={{ height: "calc(100vh - 200px)", minHeight: "560px" }}
    >
      {/* ── Painel de status automático ── */}
      <div
        className={`rounded-xl border px-4 py-3 ${
          statusLoading
            ? "border-border bg-white"
            : totalProblemas > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
        }`}
      >
        {statusLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            Verificando mensagens pendentes...
          </div>
        ) : totalProblemas === 0 ? (
          <div className="flex items-center justify-between">
            <span className="font-body text-xs font-semibold text-emerald-700">
              ✅ Nenhuma mensagem pendente — sistema ok
            </span>
            <button
              onClick={carregarStatus}
              className="cursor-pointer font-body text-[11px] text-emerald-600 underline-offset-2 hover:underline"
            >
              Atualizar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Resumo */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {(status?.lembretes.pendentes ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-body text-[11px] font-bold text-amber-800">
                    📨 {status!.lembretes.pendentes} lembrete
                    {status!.lembretes.pendentes !== 1 ? "s" : ""} pendente
                    {status!.lembretes.pendentes !== 1 ? "s" : ""}
                  </span>
                )}
                {(status?.lembretes.bloqueados ?? 0) > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 font-body text-[11px] font-bold text-red-800">
                    🚫 {status!.lembretes.bloqueados} bloqueado
                    {status!.lembretes.bloqueados !== 1 ? "s" : ""}
                  </span>
                )}
                {(status?.crm_pendentes ?? 0) > 0 && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 font-body text-[11px] font-bold text-orange-800">
                    ⚠️ {status!.crm_pendentes} CRM pendente
                    {status!.crm_pendentes !== 1 ? "s" : ""}
                  </span>
                )}
                {(status?.lembretes.agendados ?? 0) > 0 && (
                  <span className="font-body text-[11px] text-amber-700">
                    · {status!.lembretes.agendados} agendado
                    {status!.lembretes.agendados !== 1 ? "s" : ""} para envio
                    futuro
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={carregarStatus}
                  className="cursor-pointer font-body text-[11px] text-amber-700 underline-offset-2 hover:underline"
                >
                  Atualizar
                </button>
                {status!.lembretes.lista.length > 0 && (
                  <button
                    onClick={() => setListaAberta((v) => !v)}
                    className="cursor-pointer font-body text-[11px] font-semibold text-amber-800 underline-offset-2 hover:underline"
                  >
                    {listaAberta ? "Ocultar lista ▲" : "Ver lista ▼"}
                  </button>
                )}
              </div>
            </div>

            {/* Lista expandível */}
            {listaAberta && status!.lembretes.lista.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-white">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-amber-100 bg-amber-50">
                      <th className="px-3 py-1.5 text-left font-semibold text-amber-800">
                        Tipo
                      </th>
                      <th className="px-3 py-1.5 text-left font-semibold text-amber-800">
                        Cliente
                      </th>
                      <th className="px-3 py-1.5 text-left font-semibold text-amber-800">
                        Previsto para
                      </th>
                      <th className="px-3 py-1.5 text-left font-semibold text-amber-800">
                        Tentativas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {status!.lembretes.lista.map((l, i) => (
                      <tr
                        key={i}
                        className="border-b border-amber-50 last:border-0"
                      >
                        <td className="px-3 py-1.5 text-amber-900">
                          {TIPO_LABEL[l.tipo] ?? l.tipo}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {l.nome || l.telefone}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {l.enviar_em}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {l.tentativas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ações rápidas */}
            <div className="flex flex-wrap gap-2">
              {(status?.lembretes.pendentes ?? 0) > 0 && (
                <button
                  onClick={() =>
                    enviar(
                      "Reenvie agora todos os lembretes de WhatsApp pendentes"
                    )
                  }
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1 font-body text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  📤 Reenviar agora
                </button>
              )}
              <button
                onClick={() =>
                  enviar(
                    "Cancele todos os lembretes atrasados que já passaram da data sem enviá-los"
                  )
                }
                disabled={isPending}
                className="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-1 font-body text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                🗑 Cancelar atrasados
              </button>
              <button
                onClick={() =>
                  enviar("Faça um diagnóstico completo do sistema")
                }
                disabled={isPending}
                className="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-1 font-body text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                🔍 Diagnóstico completo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Atalhos iniciais ── */}
      {showAtalhos && (
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a.label}
              onClick={() => enviar(a.msg)}
              disabled={isPending}
              className="cursor-pointer rounded-lg border border-border bg-white px-3 py-1.5 font-body text-xs font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Botão limpar (só aparece quando há conversa) ── */}
      {messages.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={limpar}
            disabled={isPending}
            className="cursor-pointer rounded-lg border border-border bg-white px-3 py-1 font-body text-xs text-muted transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            🗑 Limpar conversa
          </button>
        </div>
      )}

      {/* ── Chat ── */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-white p-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-body text-[10px] font-bold select-none">
                IA
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 font-body text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "rounded-tr-sm bg-primary text-white"
                  : "rounded-tl-sm border border-border bg-slate-50 text-fg"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex gap-2 justify-start">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-body text-[10px] font-bold select-none">
              IA
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-border bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 rounded-full bg-primary/50 animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Atalhos flutuantes após primeira mensagem ── */}
      {!showAtalhos && messages.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {ATALHOS.slice(0, 3).map((a) => (
            <button
              key={a.label}
              onClick={() => enviar(a.msg)}
              disabled={isPending}
              className="cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Ex: adicionar OAB 14381 AL, mudar telefone para 82999999999, verificar sistema..."
          disabled={isPending}
          className="flex-1 rounded-xl border border-border bg-white px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        />
        <button
          onClick={() => enviar()}
          disabled={isPending || !input.trim()}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          ) : (
            "Enviar"
          )}
        </button>
      </div>
    </div>
  );
}
