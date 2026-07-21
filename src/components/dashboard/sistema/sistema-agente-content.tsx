"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { SpinnerIcon } from "@/components/icons";

interface Msg {
  role: "user" | "assistant";
  content: string;
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
  { label: "Ver estatísticas", msg: "Mostre as estatísticas do sistema" },
  { label: "Sincronizar publicações", msg: "Sincronize as publicações agora" },
  {
    label: "Reenviar WhatsApp",
    msg: "Reenvie as mensagens WhatsApp que falharam",
  },
  { label: "Listar OABs", msg: "Liste as OABs monitoradas" },
  { label: "Ver erros", msg: "Mostre os erros recentes do sistema" },
];

export default function SistemaAgenteContent() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: BOAS_VINDAS },
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

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

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 200px)", minHeight: "520px" }}
    >
      {/* Atalhos */}
      {showAtalhos && (
        <div className="mb-3 flex flex-wrap gap-2">
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

      {/* Chat */}
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

      {/* Atalhos flutuantes após primeira mensagem */}
      {!showAtalhos && messages.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
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

      {/* Input */}
      <div className="mt-2 flex gap-2">
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
