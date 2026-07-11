"use client";

import {
  useRef,
  useState,
  useReducer,
  useCallback,
  useEffect,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  criarCompromissoAction,
  atualizarCompromissoAction,
  deletarCompromissoAction,
} from "@/lib/compromissos-actions";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  CalendarApi,
  EventClickArg,
  EventSourceFuncArg,
  EventInput,
} from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import "./agenda.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
}

interface EventExtended {
  source: "controle" | "lancamento" | "birthday" | "google" | "compromisso";
  tipoLabel?: string;
  clienteNome?: string;
  clienteId?: string;
  processoNumero?: string;
  processoId?: string;
  valorFmt?: string;
  isVencido?: boolean;
  href?: string;
  status?: string;
  // compromisso fields
  compromissoId?: string;
  compromissoTitulo?: string;
  compromissoTipo?: string;
  compromissoStatus?: string;
  compromissoHoraInicio?: string | null;
  compromissoHoraFim?: string | null;
  compromissoLocalLink?: string | null;
  compromissoDescricao?: string | null;
}

interface CompromissoModalState {
  mode: "create" | "edit";
  dateStr?: string;
  id?: string;
  titulo?: string;
  tipo?: string;
  horaInicio?: string;
  horaFim?: string;
  localLink?: string;
  descricao?: string;
  status?: string;
  clienteId?: string;
  clienteNome?: string;
}

const TIPOS_COMP = [
  { key: "reuniao", label: "Reunião", icon: "🤝" },
  { key: "videochamada", label: "Videochamada", icon: "📹" },
  { key: "fechamento", label: "Fechamento", icon: "✍️" },
  { key: "consulta", label: "Consulta", icon: "👥" },
  { key: "outro", label: "Outro", icon: "📌" },
] as const;

interface DayPopover {
  dateStr: string;
  x: number;
  y: number;
}

// ── Atalhos da sidebar ────────────────────────────────────────────────────────

const SHORTCUTS = [
  { key: "mes", label: "📅 Mês atual", view: "dayGridMonth", when: "current" },
  {
    key: "hoje-lista",
    label: "≡ Hoje (em lista)",
    view: "listDay",
    when: "today",
  },
  {
    key: "hoje-hora",
    label: "🕐 Hoje (por hora)",
    view: "timeGridDay",
    when: "today",
  },
  {
    key: "semana-plan",
    label: "📋 Planner desta semana",
    view: "timeGridWeek",
    when: "thisWeek",
  },
  {
    key: "semana-lista",
    label: "≡ Lista desta semana",
    view: "listWeek",
    when: "thisWeek",
  },
  {
    key: "prox-plan",
    label: "📋 Planner próx semana",
    view: "timeGridWeek",
    when: "nextWeek",
  },
  {
    key: "prox-lista",
    label: "≡ Lista próx semana",
    view: "listWeek",
    when: "nextWeek",
  },
] as const;

// ── Formatação de data ────────────────────────────────────────────────────────

function fmtDateLong(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ── Legenda ───────────────────────────────────────────────────────────────────

const LEGENDA = [
  { color: "#7c3aed", label: "Audiência" },
  { color: "#dc2626", label: "Prazo / Vencido" },
  { color: "#0891b2", label: "Perícia" },
  { color: "#ea580c", label: "DCB / Despesa" },
  { color: "#059669", label: "Benefício / Receita" },
  { color: "#2563eb", label: "Implantado / Alvará" },
  { color: "#db2777", label: "Aniversário" },
  { color: "#0ea5e9", label: "Compromisso pessoal" },
  { color: "#94a3b8", label: "Concluído" },
];

// ── Form reducer (evita múltiplos setState no useEffect) ──────────────────────

type ModalFormState = {
  titulo: string;
  tipo: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  localLink: string;
  descricao: string;
  status: "pendente" | "concluido";
  deleteConfirm: boolean;
  clienteId: string;
  clienteNome: string;
};
const EMPTY_FORM: ModalFormState = {
  titulo: "",
  tipo: "reuniao",
  data: "",
  horaInicio: "",
  horaFim: "",
  localLink: "",
  descricao: "",
  status: "pendente",
  deleteConfirm: false,
  clienteId: "",
  clienteNome: "",
};
function formReducer(
  s: ModalFormState,
  p: Partial<ModalFormState>
): ModalFormState {
  return { ...s, ...p };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AgendaCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calRef = useRef<FullCalendar>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState("mes");
  const [dayPopover, setDayPopover] = useState<DayPopover | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Busca de cliente para o modal ───────────────────────────────────────────
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<
    { id: string; name: string }[]
  >([]);
  const [clienteDropOpen, setClienteDropOpen] = useState(false);

  // ── Modal de compromisso ────────────────────────────────────────────────────
  const [modalComp, setModalComp] = useState<CompromissoModalState | null>(
    null
  );
  const [form, dispatch] = useReducer(formReducer, EMPTY_FORM);

  // Preenche o formulário quando o modal abre (dispatch = único setState)
  useEffect(() => {
    if (!modalComp) return;
    const snap = modalComp;
    const today = new Date().toISOString().slice(0, 10);
    queueMicrotask(() => {
      setClienteResults([]);
      setClienteDropOpen(false);
      if (snap.mode === "create") {
        setClienteSearch("");
        dispatch({
          titulo: "",
          tipo: snap.tipo ?? "reuniao",
          data: snap.dateStr ?? today,
          horaInicio: "",
          horaFim: "",
          localLink: "",
          descricao: "",
          status: "pendente",
          deleteConfirm: false,
          clienteId: "",
          clienteNome: "",
        });
      } else {
        setClienteSearch(snap.clienteNome ?? "");
        dispatch({
          titulo: snap.titulo ?? "",
          tipo: snap.tipo ?? "reuniao",
          data: snap.dateStr ?? today,
          horaInicio: snap.horaInicio ?? "",
          horaFim: snap.horaFim ?? "",
          localLink: snap.localLink ?? "",
          descricao: snap.descricao ?? "",
          status: (snap.status ?? "pendente") as "pendente" | "concluido",
          deleteConfirm: false,
          clienteId: snap.clienteId ?? "",
          clienteNome: snap.clienteNome ?? "",
        });
      }
    });
  }, [modalComp]);

  // Busca clientes ao digitar no campo do modal
  useEffect(() => {
    if (form.clienteId) return; // já selecionado
    const timer = setTimeout(async () => {
      if (!clienteSearch || clienteSearch.length < 1) {
        setClienteResults([]);
        setClienteDropOpen(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/clientes/search?q=${encodeURIComponent(clienteSearch)}`
        );
        if (res.ok) {
          const data: { id: string; name: string }[] = await res.json();
          setClienteResults(data);
          setClienteDropOpen(data.length > 0);
        }
      } catch {
        // silently ignore
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clienteSearch, form.clienteId]);

  function openNovoCompromisso(dateStr?: string) {
    setDayPopover(null);
    setModalComp({
      mode: "create",
      dateStr: dateStr ?? new Date().toISOString().slice(0, 10),
    });
  }

  function handleSaveCompromisso(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const data = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      dataInicio: form.data,
      horaInicio: form.horaInicio || null,
      horaFim: form.horaFim || null,
      localLink: form.localLink.trim() || null,
      descricao: form.descricao.trim() || null,
      status: form.status,
      clienteId: form.clienteId || null,
    };
    startTransition(async () => {
      if (modalComp?.mode === "edit" && modalComp.id) {
        await atualizarCompromissoAction(modalComp.id, data);
      } else {
        await criarCompromissoAction(data);
      }
      setModalComp(null);
      getApi()?.refetchEvents();
    });
  }

  function handleDeleteCompromisso() {
    if (!modalComp?.id) return;
    startTransition(async () => {
      await deletarCompromissoAction(modalComp.id!);
      setModalComp(null);
      getApi()?.refetchEvents();
    });
  }

  // Inicializa mensagem OAuth a partir dos query params (antes de qualquer effect)
  const oauthConnected = searchParams.get("google_connected");
  const oauthError = searchParams.get("google_error");
  const OAUTH_MSGS: Record<string, string> = {
    missing_code: "Código OAuth inválido.",
    invalid_state: "Sessão inválida. Tente novamente.",
    token_exchange: "Erro ao trocar o código. Tente novamente.",
  };

  // getApi — declarado antes dos effects que o usam
  const getApi = useCallback((): CalendarApi | null => {
    return calRef.current?.getApi() ?? null;
  }, []);

  // Fecha popover ao clicar fora
  useEffect(() => {
    function handler(e: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setDayPopover(null);
      }
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  // Carrega status do Google Calendar + limpa query params OAuth
  useEffect(() => {
    fetch("/api/agenda/google/status")
      .then((r) => r.json())
      .then((data: GoogleStatus) => {
        setGoogleStatus(data);
        if (oauthConnected === "1") {
          setGoogleStatus((s) => (s ? { ...s, connected: true } : s));
          setGoogleMsg({
            type: "ok",
            text: "Google Calendar conectado com sucesso!",
          });
          router.replace("/dashboard/agenda");
        } else if (oauthError) {
          setGoogleMsg({
            type: "err",
            text: OAUTH_MSGS[oauthError] ?? "Erro ao conectar.",
          });
          router.replace("/dashboard/agenda");
        }
      })
      .catch(() =>
        setGoogleStatus({ connected: false, configured: false, email: null })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss message
  useEffect(() => {
    if (!googleMsg) return;
    const t = setTimeout(() => setGoogleMsg(null), 5000);
    return () => clearTimeout(t);
  }, [googleMsg]);

  // Atualiza eventos ao mudar filtro arquivados
  useEffect(() => {
    getApi()?.refetchEvents();
  }, [showArchived, getApi]);

  async function handleGoogleDisconnect() {
    setGoogleLoading(true);
    try {
      await fetch("/api/agenda/google/disconnect", { method: "POST" });
      setGoogleStatus((s) => (s ? { ...s, connected: false, email: null } : s));
      setGoogleMsg({ type: "ok", text: "Google Calendar desconectado." });
      getApi()?.refetchEvents();
    } finally {
      setGoogleLoading(false);
      setTimeout(() => setGoogleMsg(null), 4000);
    }
  }

  // ── Busca de eventos ────────────────────────────────────────────────────────

  const fetchEvents = useCallback(
    async (
      fetchInfo: EventSourceFuncArg,
      successCallback: (events: EventInput[]) => void,
      failureCallback: (err: Error) => void
    ) => {
      try {
        const params = new URLSearchParams({
          start: fetchInfo.startStr,
          end: fetchInfo.endStr,
          showArchived: showArchived ? "1" : "0",
        });
        const res = await fetch(`/api/agenda/events?${params}`);
        if (!res.ok) throw new Error("Erro ao buscar eventos");
        const data = await res.json();
        successCallback(data);
      } catch (err) {
        failureCallback(err as Error);
      }
    },
    [showArchived]
  );

  // ── Atalhos ─────────────────────────────────────────────────────────────────

  function goShortcut(key: string, view: string, when: string) {
    const api = getApi();
    if (!api) return;
    setActiveShortcut(key);
    setDayPopover(null);

    if (when === "nextWeek") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      api.gotoDate(d);
    } else {
      api.today();
    }
    api.changeView(view);
  }

  // ── Clique em evento → navega para o link ou abre modal ────────────────────

  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps as EventExtended;
    if (props.source === "compromisso") {
      setModalComp({
        mode: "edit",
        id: props.compromissoId,
        titulo: props.compromissoTitulo ?? "",
        tipo: props.compromissoTipo ?? "outro",
        dateStr: info.event.startStr.slice(0, 10),
        horaInicio: props.compromissoHoraInicio ?? "",
        horaFim: props.compromissoHoraFim ?? "",
        localLink: props.compromissoLocalLink ?? "",
        descricao: props.compromissoDescricao ?? "",
        status: props.compromissoStatus ?? "pendente",
        clienteId: (props.clienteId as string | undefined) ?? "",
        clienteNome: (props.clienteNome as string | undefined) ?? "",
      });
    } else if (props.href) {
      router.push(props.href);
    }
  }

  // ── Clique em dia vazio → abre popover ──────────────────────────────────────

  function handleDateClick(info: DateClickArg) {
    const x = Math.min(info.jsEvent.clientX + 8, window.innerWidth - 240);
    const y = Math.min(info.jsEvent.clientY + 8, window.innerHeight - 200);
    setDayPopover({ dateStr: info.dateStr, x, y });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  function handleLoading(isLoading: boolean) {
    setLoading(isLoading);
    if (isLoading) {
      setProgress(60);
    } else {
      setProgress(100);
      setTimeout(() => setProgress(0), 350);
    }
  }

  // ── Render de evento (ícone por tipo) ───────────────────────────────────────

  function renderEventContent(arg: {
    event: { extendedProps: Record<string, unknown>; title: string };
  }) {
    const props = arg.event.extendedProps as unknown as EventExtended;
    // compromisso events already have icon in the title (added by the API)
    if (props.source === "compromisso") {
      return (
        <div className="fc-event-inner">
          <span className="fc-event-label">{arg.event.title}</span>
        </div>
      );
    }
    const icon =
      props.source === "google"
        ? "📅"
        : props.source === "controle"
          ? props.tipoLabel === "Audiência"
            ? "⚖️"
            : props.tipoLabel === "Prazo"
              ? "⏰"
              : props.tipoLabel === "Perícia"
                ? "🔬"
                : props.tipoLabel === "DCB"
                  ? "📋"
                  : props.tipoLabel === "Benefício"
                    ? "✅"
                    : props.tipoLabel === "Alvará"
                      ? "📄"
                      : "📌"
          : props.source === "lancamento"
            ? props.isVencido
              ? "🔴"
              : (props as { tipo?: string }).tipo === "entrada"
                ? "💰"
                : "💸"
            : "";

    return (
      <div className="fc-event-inner">
        {icon && <span className="fc-event-icon">{icon}</span>}
        <span className="fc-event-label">{arg.event.title}</span>
      </div>
    );
  }

  return (
    <div className="agenda-layout">
      {/* ── Barra de ações rápidas (mobile only) ────────────────────────────── */}
      <div className="agenda-mobile-bar">
        <button
          onClick={() => openNovoCompromisso()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 font-body text-sm font-semibold text-white"
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo
        </button>
        <button
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 font-body text-sm font-semibold text-fg"
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          {mobileSidebarOpen ? "Fechar" : "Filtros"}
        </button>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`agenda-sidebar${mobileSidebarOpen ? " mobile-open" : ""}`}
      >
        {/* Novo compromisso */}
        <button
          onClick={() => openNovoCompromisso()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo compromisso
        </button>

        {/* Atualizar */}
        <button
          onClick={() => getApi()?.refetchEvents()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-2 font-body text-sm font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Atualizar
        </button>

        {/* Atalhos */}
        <div>
          <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-wider text-muted">
            Atalhos
          </p>
          <ul className="space-y-0.5">
            {SHORTCUTS.map((s) => (
              <li key={s.key}>
                <button
                  onClick={() => goShortcut(s.key, s.view, s.when)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left font-body text-xs transition-colors ${
                    activeShortcut === s.key
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted hover:bg-slate-50 hover:text-fg"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Mostrar concluídos */}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 font-body text-xs text-muted transition-colors hover:bg-slate-100">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="accent-primary"
          />
          Exibir concluídos
        </label>

        {/* Google Calendar */}
        <div className="rounded-xl border border-border bg-white p-3">
          <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-wider text-muted">
            Google Calendar
          </p>

          {googleMsg && (
            <div
              className={`mb-2 rounded-lg px-2.5 py-1.5 font-body text-xs font-semibold ${googleMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
            >
              {googleMsg.text}
            </div>
          )}

          {googleStatus === null ? (
            <p className="font-body text-xs text-muted">Verificando…</p>
          ) : !googleStatus.configured ? (
            <p className="font-body text-[11px] text-muted leading-relaxed">
              Configure{" "}
              <code className="rounded bg-slate-100 px-1 text-[10px]">
                GOOGLE_CLIENT_ID
              </code>{" "}
              no{" "}
              <code className="rounded bg-slate-100 px-1 text-[10px]">
                .env.local
              </code>{" "}
              para ativar.
            </p>
          ) : googleStatus.connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="font-body text-xs font-semibold text-emerald-700">
                  Conectado
                </p>
              </div>
              {googleStatus.email && (
                <p className="truncate font-body text-[11px] text-muted">
                  {googleStatus.email}
                </p>
              )}
              <button
                onClick={handleGoogleDisconnect}
                disabled={googleLoading}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 font-body text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                {googleLoading ? "Desconectando…" : "Desconectar"}
              </button>
            </div>
          ) : (
            <a
              href="/api/agenda/google/auth"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-body text-xs font-semibold text-fg shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Conectar Google Calendar
            </a>
          )}
        </div>

        {/* Legenda */}
        <div>
          <p className="mb-2 font-body text-[11px] font-semibold uppercase tracking-wider text-muted">
            Legenda
          </p>
          <ul className="space-y-1.5">
            {[...LEGENDA, { color: "#4285F4", label: "Google Calendar" }].map(
              (l) => (
                <li key={l.label} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="font-body text-xs text-muted">
                    {l.label}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      </aside>

      {/* ── Calendário ──────────────────────────────────────────────────────── */}
      <div className="agenda-main">
        {/* Barra de progresso */}
        {loading && (
          <div className="agenda-progress">
            <div
              className="agenda-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <FullCalendar
          ref={calRef}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
            interactionPlugin,
          ]}
          locale="pt-br"
          initialView="dayGridMonth"
          initialDate={searchParams.get("date") ?? undefined}
          firstDay={1}
          timeZone="local"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek,timeGridDay,listDay",
          }}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            list: "Lista",
          }}
          views={{
            dayGridMonth: { buttonText: "Mês" },
            timeGridWeek: { buttonText: "Semana" },
            listWeek: { buttonText: "Sem. lista" },
            timeGridDay: { buttonText: "Dia" },
            listDay: { buttonText: "Dia lista" },
          }}
          events={fetchEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          loading={handleLoading}
          height="100%"
          dayMaxEvents={4}
          moreLinkText={(n) => `+${n} mais`}
          noEventsText="Nenhum evento neste período"
          listDayFormat={{ weekday: "long", day: "numeric", month: "long" }}
          listDaySideFormat={false}
        />
      </div>

      {/* ── Popover ao clicar em dia ─────────────────────────────────────────── */}
      {dayPopover && (
        <div
          ref={popoverRef}
          className="agenda-popover"
          style={{ left: dayPopover.x, top: dayPopover.y }}
        >
          <div className="agenda-popover-header">
            <span className="font-body text-xs font-semibold text-fg">
              {fmtDateLong(dayPopover.dateStr)}
            </span>
            <button
              onClick={() => setDayPopover(null)}
              className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-black/5 hover:text-fg"
            >
              ✕
            </button>
          </div>
          <div className="agenda-popover-body">
            <button
              onClick={() => openNovoCompromisso(dayPopover.dateStr)}
              className="w-full rounded-lg px-3 py-2 text-left font-body text-xs font-semibold text-fg transition-colors hover:bg-sky-50 hover:text-sky-700"
            >
              📝 Novo compromisso
            </button>
            <div className="mx-1 border-t border-border" />
            <button
              onClick={() => {
                setDayPopover(null);
                router.push(
                  `/dashboard/controles/novo?data=${dayPopover.dateStr}`
                );
              }}
              className="w-full rounded-lg px-3 py-2 text-left font-body text-xs font-semibold text-fg transition-colors hover:bg-primary/5 hover:text-primary"
            >
              ⚖️ Novo prazo / controle
            </button>
            <div className="mx-1 border-t border-border" />
            <button
              onClick={() => {
                setDayPopover(null);
                const api = getApi();
                if (api) {
                  api.changeView("listDay");
                  api.gotoDate(dayPopover.dateStr);
                  setActiveShortcut("hoje-lista");
                }
              }}
              className="w-full rounded-lg px-3 py-2 text-left font-body text-xs text-muted transition-colors hover:bg-slate-50 hover:text-fg"
            >
              ≡ Ver dia em lista
            </button>
            <button
              onClick={() => {
                setDayPopover(null);
                const api = getApi();
                if (api) {
                  api.changeView("timeGridDay");
                  api.gotoDate(dayPopover.dateStr);
                  setActiveShortcut("hoje-hora");
                }
              }}
              className="w-full rounded-lg px-3 py-2 text-left font-body text-xs text-muted transition-colors hover:bg-slate-50 hover:text-fg"
            >
              🕐 Ver dia por hora
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de compromisso ─────────────────────────────────────────────── */}
      {modalComp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setModalComp(null)}
        >
          <div
            className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
            style={{ maxHeight: "90dvh" }}
          >
            {/* Cabeçalho */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-heading text-base font-semibold text-fg">
                {modalComp.mode === "create"
                  ? "Novo Compromisso"
                  : "Editar Compromisso"}
              </h2>
              <button
                onClick={() => setModalComp(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-fg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Formulário */}
            <form
              onSubmit={handleSaveCompromisso}
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* Campos — área scrollável */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Tipo */}
                <div>
                  <label className="mb-2 block font-body text-xs font-semibold text-muted">
                    Tipo
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPOS_COMP.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => dispatch({ tipo: t.key })}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-body text-xs font-semibold transition-colors ${form.tipo === t.key ? "border-sky-300 bg-sky-50 text-sky-700" : "border-border text-muted hover:border-sky-200 hover:text-fg"}`}
                      >
                        <span>{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Título */}
                <div>
                  <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.titulo}
                    onChange={(e) => dispatch({ titulo: e.target.value })}
                    placeholder="Ex.: Reunião com cliente João Silva"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Cliente (opcional) */}
                <div>
                  <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                    Cliente (opcional)
                  </label>
                  {form.clienteId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2">
                      <span className="flex-1 truncate font-body text-sm font-medium text-sky-800">
                        {form.clienteNome}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ clienteId: "", clienteNome: "" });
                          setClienteSearch("");
                          setClienteDropOpen(false);
                        }}
                        className="flex-shrink-0 text-sky-400 hover:text-sky-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={clienteSearch}
                        onChange={(e) => setClienteSearch(e.target.value)}
                        onFocus={() =>
                          clienteResults.length > 0 && setClienteDropOpen(true)
                        }
                        placeholder="Buscar cliente..."
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                      {clienteDropOpen && clienteResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                          {clienteResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                dispatch({
                                  clienteId: c.id,
                                  clienteNome: c.name,
                                });
                                setClienteSearch(c.name);
                                setClienteDropOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left font-body text-sm text-fg hover:bg-sky-50"
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Data */}
                <div>
                  <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.data}
                    onChange={(e) => dispatch({ data: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Horário */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                      Hora início
                    </label>
                    <input
                      type="time"
                      value={form.horaInicio}
                      onChange={(e) => dispatch({ horaInicio: e.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                      Hora fim
                    </label>
                    <input
                      type="time"
                      value={form.horaFim}
                      onChange={(e) => dispatch({ horaFim: e.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                {/* Local / Link */}
                <div>
                  <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                    Local ou link (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.localLink}
                    onChange={(e) => dispatch({ localLink: e.target.value })}
                    placeholder="Ex.: Sala de reunião / https://meet.google.com/…"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                    Observações (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={form.descricao}
                    onChange={(e) => dispatch({ descricao: e.target.value })}
                    placeholder="Detalhes adicionais…"
                    className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>
              {/* fim campos scrolláveis */}

              {/* Botões — rodapé fixo */}
              <div className="flex flex-shrink-0 items-center gap-2 border-t border-border px-6 py-4">
                <button
                  type="submit"
                  disabled={isPending || !form.titulo.trim()}
                  className="flex-1 rounded-lg bg-sky-500 px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalComp(null)}
                  className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-muted transition-colors hover:text-fg"
                >
                  Cancelar
                </button>
                {modalComp.mode === "edit" && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        dispatch({
                          status:
                            form.status === "pendente"
                              ? "concluido"
                              : "pendente",
                        })
                      }
                      title={
                        form.status === "pendente"
                          ? "Dar baixa no compromisso"
                          : "Reabrir compromisso"
                      }
                      className={`rounded-lg border px-3 py-2 font-body text-sm transition-colors disabled:opacity-50 ${
                        form.status === "concluido"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                    >
                      {form.status === "concluido" ? "✅ Concluído" : "✓ Baixa"}
                    </button>
                    {form.deleteConfirm ? (
                      <button
                        type="button"
                        onClick={handleDeleteCompromisso}
                        disabled={isPending}
                        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-body text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        Confirmar exclusão
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => dispatch({ deleteConfirm: true })}
                        className="rounded-lg border border-red-200 px-3 py-2 font-body text-sm text-red-500 transition-colors hover:border-red-300 hover:bg-red-50"
                      >
                        🗑
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
