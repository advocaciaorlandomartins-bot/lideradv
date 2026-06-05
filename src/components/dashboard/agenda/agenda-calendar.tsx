"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  source: "controle" | "lancamento" | "birthday" | "google";
  tipoLabel?: string;
  clienteNome?: string;
  clienteId?: string;
  processoNumero?: string;
  processoId?: string;
  valorFmt?: string;
  isVencido?: boolean;
  href?: string;
  status?: string;
}

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
  { color: "#94a3b8", label: "Concluído" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function AgendaCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calRef = useRef<FullCalendar>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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
    function handler(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setDayPopover(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

  // ── Clique em evento → navega para o link ───────────────────────────────────

  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps as EventExtended;
    if (props.href) router.push(props.href);
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
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="agenda-sidebar">
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
    </div>
  );
}
