"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
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

const CLIENTE_PATH_RE =
  /^\/dashboard\/clientes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

// Posição arrastada, salva por dispositivo — só existe quando o usuário
// já moveu o botão alguma vez; enquanto isso fica null e usa a posição
// padrão (as classes fixed bottom-right do Tailwind).
const POS_KEY = "lideradv-iris-pos";
interface IrisPos {
  right: number;
  bottom: number;
}
const BUTTON_SIZE = 52; // 3.25rem
const PANEL_GAP = 68; // altura do botão + respiro até o painel abrir acima

function clampPos(pos: IrisPos): IrisPos {
  if (typeof window === "undefined") return pos;
  const maxRight = Math.max(8, window.innerWidth - BUTTON_SIZE - 8);
  const maxBottom = Math.max(8, window.innerHeight - BUTTON_SIZE - 8);
  return {
    right: Math.min(Math.max(8, pos.right), maxRight),
    bottom: Math.min(Math.max(8, pos.bottom), maxBottom),
  };
}

export default function IrisFloating() {
  const [open, setOpen] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [input, setInput] = useState("");
  // Botão fixo sempre no mesmo canto tampava conteúdo real da tela (ex:
  // paginação da lista de Clientes) sem nenhum jeito de tirar do caminho —
  // agora dá pra arrastar pra qualquer lugar, e a posição fica salva só
  // neste navegador. Lazy initializer (não useEffect) pro mesmo padrão já
  // usado em dashboard-shell.tsx — evita setState redundante logo após o
  // primeiro render.
  const [pos, setPos] = useState<IrisPos | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(POS_KEY);
      return saved ? clampPos(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleResize() {
      setPos((p) => (p ? clampPos(p) : p));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      moved: false,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    const ds = dragRef.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!ds.moved) setDragging(true);
    ds.moved = true;
    setPos(
      clampPos({ right: ds.startRight - dx, bottom: ds.startBottom - dy })
    );
  }

  function handlePointerUp() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    const ds = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (ds?.moved) {
      // Depois de um pointerup com movimento, o navegador ainda dispara um
      // evento click sintético em seguida — sem essa trava ele abriria o
      // painel na hora, cancelando o efeito de "só arrastei, não cliquei".
      justDraggedRef.current = true;
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(p));
          } catch {
            // sem espaço/permissão — não impede o uso, só não persiste
          }
        }
        return p;
      });
    }
  }

  function handleButtonClick() {
    // Clique real (mouse sem arrastar, toque, Enter/Espaço pelo teclado)
    // sempre chega aqui — dragging é só rastreado via pointer events, que
    // não existem pra ativação por teclado.
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setOpen((v) => !v);
  }
  // Quando o usuário está numa página de cliente, avisa a Íris — ela usa
  // isso pra saber "de quem" o usuário está falando sem precisar nomear, e
  // pra já anexar automaticamente o documento no arquivo desse cliente
  // quando ele mandar um PDF/imagem pedindo pra guardar.
  const paginaClienteId = pathname?.match(CLIENTE_PATH_RE)?.[1] ?? null;

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
  } = useIrisChat(WELCOME, "lideradv-iris-conversa-flutuante", paginaClienteId);

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
        onPointerDown={handlePointerDown}
        onClick={handleButtonClick}
        aria-label="Abrir Íris (arraste pra mover)"
        className={`fixed z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-colors duration-200 touch-none select-none ${
          pos ? "" : "bottom-[4.75rem] right-4 lg:bottom-6 lg:right-6"
        } ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
          open
            ? "bg-slate-700 text-white scale-95"
            : "bg-violet-600 text-white hover:bg-violet-700 hover:scale-105"
        }`}
        style={{
          width: "3.25rem",
          height: "3.25rem",
          ...(pos ? { right: pos.right, bottom: pos.bottom } : {}),
        }}
      >
        {open ? (
          <XMarkIcon className="h-5 w-5" />
        ) : (
          <SparklesIcon className="h-5 w-5" />
        )}
      </button>

      {open && (
        <div
          className={`fixed z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-2xl bg-white shadow-2xl border border-border overflow-hidden ${
            pos ? "" : "bottom-[8.5rem] right-4 lg:bottom-20 lg:right-6"
          }`}
          style={{
            height: "min(560px, calc(100dvh - 10rem))",
            ...(pos
              ? { right: pos.right, bottom: pos.bottom + PANEL_GAP }
              : {}),
          }}
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
                    disabled={
                      !input.trim() ||
                      loading ||
                      pendingFiles.some((p) => p.status === "enviando")
                    }
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
