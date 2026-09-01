"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SparklesIcon, XMarkIcon } from "@/components/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "lideradv-iris-history";
const MAX_STORED = 30;

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

function DotsLoader() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full bg-violet-500/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Olá! Sou a Íris 👋\n\nPosso tirar dúvidas sobre o sistema, mostrar dados reais (agenda, equipe, financeiro, produtividade) e executar ações — sincronizar publicações, reenviar mensagens, gerenciar OABs, atualizar dados do escritório.\n\nComo posso ajudar?",
};

export default function IrisFloating() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const run = () => {
      setHydrated(true);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Message[];
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
        // ignore
      }
    };
    queueMicrotask(run);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED))
      );
    } catch {
      // ignore
    }
  }, [messages, hydrated]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/iris/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const reply: Message = {
        role: "assistant",
        content: res.ok
          ? (data.reply ?? "Não obtive resposta. Tente novamente.")
          : (data.error ?? "Erro ao consultar a Íris."),
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erro de conexão. Verifique sua internet e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearHistory() {
    setMessages([WELCOME]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir Íris"
        className={`fixed bottom-[4.75rem] right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-all duration-200 cursor-pointer lg:bottom-6 lg:right-6 ${
          open
            ? "bg-slate-700 text-white scale-95"
            : "bg-violet-600 text-white hover:bg-violet-700 hover:scale-105"
        }`}
        style={{ width: "3.25rem", height: "3.25rem" }}
      >
        {open ? (
          <XMarkIcon className="h-5 w-5" />
        ) : (
          <SparklesIcon className="h-5 w-5" />
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-[8.5rem] right-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-2xl bg-white shadow-2xl border border-border overflow-hidden lg:bottom-20 lg:right-6"
          style={{ height: "min(520px, calc(100dvh - 10rem))" }}
        >
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-violet-600 to-indigo-700 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
              <SparklesIcon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-sm font-bold text-white leading-tight">
                Íris
              </p>
              <p className="font-body text-[11px] text-white/70 leading-tight">
                IA do escritório
              </p>
            </div>
            <button
              onClick={clearHistory}
              title="Limpar conversa"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
                    <SparklesIcon className="h-3 w-3 text-violet-600" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 font-body text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-slate-100 text-fg rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <SparklesIcon className="h-3 w-3 text-violet-600" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2">
                  <DotsLoader />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div className="border-t border-border px-3 py-2 flex flex-wrap gap-1.5">
              {[
                "O que tenho na agenda essa semana?",
                "Como cadastrar um cliente?",
                "Faça um diagnóstico do sistema",
                "Quem está sobrecarregado agora?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-border bg-slate-50 px-2.5 py-1 font-body text-[11px] text-muted hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border bg-white px-3 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte à Íris..."
                rows={1}
                className="flex-1 resize-none bg-transparent font-body text-sm text-fg placeholder:text-muted focus:outline-none leading-relaxed"
                style={{ maxHeight: "100px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-all hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <SendIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-center font-body text-[10px] text-muted/60">
              Enter para enviar • Shift+Enter para nova linha
            </p>
          </div>
        </div>
      )}
    </>
  );
}
