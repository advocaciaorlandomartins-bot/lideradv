"use client";

import { useState, useRef, useEffect } from "react";
import {
  SparklesIcon,
  XMarkIcon,
  ClockIcon,
  PlusIcon,
} from "@/components/icons";
import { useIrisChat, type IrisMessage } from "./iris/use-iris-chat";
import { IrisAttachButton, IrisPendingChips } from "./iris/iris-attach";
import { IrisTraceChips, IrisAnexoChips } from "./iris/iris-trace-chips";
import IrisConversasList from "./iris/iris-conversas-list";
import IrisMarkdown from "./iris/iris-markdown";

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

const WELCOME: IrisMessage = {
  role: "assistant",
  content:
    "Olá! Sou a Íris 👋\n\nPosso tirar dúvidas sobre o sistema, mostrar dados reais (agenda, equipe, financeiro, produtividade), analisar documentos anexados e executar ações — sincronizar publicações, reenviar mensagens, gerenciar OABs, atualizar dados do escritório.\n\nComo posso ajudar?",
};

const SUGESTOES = [
  "O que tenho na agenda essa semana?",
  "Como cadastrar um cliente?",
  "Faça um diagnóstico do sistema",
  "Quem está sobrecarregado agora?",
];

export default function IrisFloating() {
  const [open, setOpen] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    conversaId,
    messages,
    loading,
    pendingFiles,
    addFiles,
    removeFile,
    erroAnexo,
    sendMessage,
    conversas,
    refreshConversas,
    loadConversation,
    startNewConversation,
    deleteConversation,
  } = useIrisChat(WELCOME, "lideradv-iris-conversa-flutuante");

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
          style={{ height: "min(560px, calc(100dvh - 10rem))" }}
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
              onClick={() => {
                startNewConversation();
                setHistoricoAberto(false);
              }}
              title="Nova conversa"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setHistoricoAberto((v) => {
                  if (!v) refreshConversas();
                  return !v;
                });
              }}
              title="Histórico de conversas"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <ClockIcon className="h-4 w-4" />
            </button>
          </div>

          {historicoAberto ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <IrisConversasList
                conversas={conversas}
                conversaAtualId={conversaId}
                onSelect={(id) => {
                  loadConversation(id);
                  setHistoricoAberto(false);
                }}
                onDelete={deleteConversation}
                onNova={() => {
                  startNewConversation();
                  setHistoricoAberto(false);
                }}
              />
            </div>
          ) : (
            <>
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
                      className={`max-w-[82%] rounded-2xl px-3 py-2 font-body text-sm leading-relaxed break-words ${
                        msg.role === "user"
                          ? "bg-violet-600 text-white rounded-tr-sm"
                          : "bg-slate-100 text-fg rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <IrisTraceChips trace={msg.toolTrace} />
                      )}
                      {msg.role === "user" && (
                        <IrisAnexoChips anexos={msg.anexos} />
                      )}
                      {msg.role === "assistant" ? (
                        <IrisMarkdown content={msg.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
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
                  {SUGESTOES.map((q) => (
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
                <IrisPendingChips
                  pendingFiles={pendingFiles}
                  onRemove={removeFile}
                  erro={erroAnexo}
                />
                <div className="flex items-end gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200 transition-all">
                  <IrisAttachButton onAdd={addFiles} disabled={loading} />
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
                    onClick={handleSend}
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
            </>
          )}
        </div>
      )}
    </>
  );
}
