"use client";

import { useState, useRef, useEffect } from "react";
import { SparklesIcon, ClockIcon, XMarkIcon } from "@/components/icons";
import { useIrisChat, type IrisMessage } from "./use-iris-chat";
import { IrisAttachButton, IrisPendingChips } from "./iris-attach";
import { IrisTraceChips, IrisAnexoChips } from "./iris-trace-chips";
import IrisConversasList from "./iris-conversas-list";
import IrisMarkdown from "./iris-markdown";

const WELCOME: IrisMessage = {
  role: "assistant",
  content:
    "Olá! Sou a Íris — a única IA do sistema.\n\nPosso tirar dúvidas de uso, responder sobre agenda, audiências, prazos, equipe e produtividade com dados reais, analisar documentos anexados e executar ações (sincronizar publicações, reenviar mensagens, gerenciar OABs, dados do escritório).\n\nO que você precisa?",
};

const SUGESTOES = [
  "O que tenho na agenda essa semana?",
  "Quais audiências estão chegando?",
  "Quem está mais sobrecarregado agora?",
  "Quais processos têm risco alto pro Cérebro Jurídico?",
];

const ATALHOS_ADMIN = [
  "Faça um diagnóstico completo do sistema",
  "Verifique os erros e reenvie os lembretes de WhatsApp pendentes",
  "Sincronize as publicações agora",
  "Liste as OABs monitoradas",
];

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

export default function IrisChat({ isAdmin = false }: { isAdmin?: boolean }) {
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
  } = useIrisChat(WELCOME, "lideradv-iris-conversa-pagina");

  const [input, setInput] = useState("");
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) refreshConversas();
  }, [loading, refreshConversas]);

  function handleSend(textOverride?: string) {
    const text = textOverride ?? input;
    if (!text.trim() || loading) return;
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
    <div className="flex flex-1 min-h-0 gap-4">
      {/* Sidebar de histórico — some em telas pequenas por trás do toggle */}
      <div
        className={`${
          historicoAberto ? "flex" : "hidden"
        } w-64 shrink-0 flex-col rounded-2xl border border-border bg-white p-3 shadow-sm lg:flex`}
      >
        <div className="mb-1 flex items-center justify-between lg:hidden">
          <p className="font-body text-xs font-semibold text-muted">
            Histórico
          </p>
          <button
            onClick={() => setHistoricoAberto(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-slate-100"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
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

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-violet-600 to-indigo-700 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-white leading-tight">
              Íris
            </p>
            <p className="font-body text-[11px] text-white/70 leading-tight">
              IA do escritório — dados reais e atuais do sistema
            </p>
          </div>
          <button
            onClick={() => setHistoricoAberto((v) => !v)}
            title="Histórico de conversas"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
          >
            <ClockIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                  <SparklesIcon className="h-3.5 w-3.5 text-violet-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 font-body text-sm leading-relaxed break-words ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-slate-100 text-fg rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" && (
                  <IrisTraceChips trace={msg.toolTrace} />
                )}
                {msg.role === "user" && <IrisAnexoChips anexos={msg.anexos} />}
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
              <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <SparklesIcon className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5">
                <DotsLoader />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões */}
        {messages.length <= 1 && (
          <div className="border-t border-border px-4 py-2.5 flex flex-wrap gap-1.5">
            {SUGESTOES.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="rounded-full border border-border bg-slate-50 px-2.5 py-1 font-body text-[11px] text-muted hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
            {isAdmin &&
              ATALHOS_ADMIN.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-body text-[11px] text-amber-700 hover:border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-white px-4 py-3">
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
              placeholder="Pergunte sobre agenda, audiências, equipe, ou anexe um documento pra analisar..."
              rows={1}
              className="flex-1 resize-none bg-transparent font-body text-sm text-fg placeholder:text-muted focus:outline-none leading-relaxed"
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-all hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <SparklesIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
