"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import type { BirthdayClient } from "@/lib/clients-db";
import {
  CalendarIcon,
  PhoneIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  ClipboardListIcon,
  ChevronRightIcon,
} from "@/components/icons";

// ── Constants ──────────────────────────────────────────────────────────────────

const MESSAGE_KEY = "advmartins:birthday:message";

const DEFAULT_MESSAGE =
  "Olá, {{cliente_primeiro_nome}}! 🎂\n\nEm nome da equipe AdvMartins, gostaríamos de desejar a você um feliz aniversário!\n\nQue este novo ciclo seja repleto de conquistas, saúde e realizações.\n\nUm abraço,\nEquipe AdvMartins";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "next_15_days", label: "Hoje e próximos 15 dias" },
  { value: "last_15_days", label: "Últimos 15 dias" },
  ...MONTH_NAMES.map((m, i) => ({
    value: String(i + 1).padStart(2, "0"),
    label: m,
  })),
];

const AVATAR_COLORS = [
  "bg-pink-100 text-pink-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function formatBirthDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}`;
}

function formatAge(dateStr: string): number {
  const birth = new Date(dateStr + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function daysUntilBirthday(dateStr: string): number {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const bd = new Date(dateStr + "T12:00:00");
  let bdThisYear = new Date(
    todayStart.getFullYear(),
    bd.getMonth(),
    bd.getDate()
  );
  if (bdThisYear < todayStart) {
    bdThisYear = new Date(
      todayStart.getFullYear() + 1,
      bd.getMonth(),
      bd.getDate()
    );
  }
  return Math.round(
    (bdThisYear.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function buildMessage(template: string, client: BirthdayClient): string {
  return template.replace(
    /\{\{cliente_primeiro_nome\}\}/g,
    firstName(client.name)
  );
}

function whatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const br = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${br}?text=${encodeURIComponent(message)}`;
}

function filterByPeriod(
  clients: BirthdayClient[],
  period: string
): BirthdayClient[] {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return clients.filter((c) => {
    const bd = new Date(c.birth_date + "T12:00:00");
    const month = bd.getMonth();
    const day = bd.getDate();

    if (period === "next_15_days") {
      const limit = new Date(todayStart);
      limit.setDate(limit.getDate() + 15);
      const bdThisYear = new Date(todayStart.getFullYear(), month, day);
      const bdNextYear = new Date(todayStart.getFullYear() + 1, month, day);
      return (
        (bdThisYear >= todayStart && bdThisYear <= limit) ||
        (bdNextYear >= todayStart && bdNextYear <= limit)
      );
    }

    if (period === "last_15_days") {
      const limit = new Date(todayStart);
      limit.setDate(limit.getDate() - 15);
      const bdThisYear = new Date(todayStart.getFullYear(), month, day);
      const bdPrevYear = new Date(todayStart.getFullYear() - 1, month, day);
      return (
        (bdThisYear >= limit && bdThisYear < todayStart) ||
        (bdPrevYear >= limit && bdPrevYear < todayStart)
      );
    }

    // Month number like "06"
    return bd.getMonth() + 1 === parseInt(period);
  });
}

function sortBirthdays(
  clients: BirthdayClient[],
  period: string
): BirthdayClient[] {
  if (period === "next_15_days") {
    return [...clients].sort(
      (a, b) =>
        daysUntilBirthday(a.birth_date) - daysUntilBirthday(b.birth_date)
    );
  }
  if (period === "last_15_days") {
    return [...clients].sort((a, b) => {
      const da = new Date(a.birth_date + "T12:00:00").getDate();
      const db = new Date(b.birth_date + "T12:00:00").getDate();
      return db - da;
    });
  }
  // By day of month
  return [...clients].sort((a, b) => {
    const da = new Date(a.birth_date + "T12:00:00").getDate();
    const db = new Date(b.birth_date + "T12:00:00").getDate();
    return da - db;
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DaysBadge({ days }: { days: number }) {
  if (days === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-body text-xs font-semibold text-emerald-700">
        🎂 Hoje!
      </span>
    );
  if (days === 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-body text-xs font-semibold text-amber-700">
        Amanhã
      </span>
    );
  if (days <= 7)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 font-body text-xs font-semibold text-blue-700">
        Em {days} dias
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-body text-xs font-semibold text-muted">
      Em {days} dias
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  clients: BirthdayClient[];
}

export default function AniversariosContent({ clients }: Props) {
  const today = new Date();
  const currentMonthKey = String(today.getMonth() + 1).padStart(2, "0");

  const [period, setPeriod] = useState<string>("next_15_days");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MESSAGE;
    return localStorage.getItem(MESSAGE_KEY) ?? DEFAULT_MESSAGE;
  });
  const [savedMessage, setSavedMessage] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MESSAGE;
    return localStorage.getItem(MESSAGE_KEY) ?? DEFAULT_MESSAGE;
  });
  const [messageSaved, setMessageSaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = message !== savedMessage;

  function handleSaveMessage() {
    localStorage.setItem(MESSAGE_KEY, message);
    setSavedMessage(message);
    setMessageSaved(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => setMessageSaved(false), 2000);
  }

  function handleResetMessage() {
    setMessage(savedMessage);
  }

  async function handleCopy(client: BirthdayClient) {
    const text = buildMessage(message, client);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  function handleWhatsApp(client: BirthdayClient) {
    const text = buildMessage(message, client);
    window.open(whatsAppUrl(client.phone, text), "_blank");
  }

  const filtered = useMemo(() => {
    let result = filterByPeriod(clients, period);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }
    return sortBirthdays(result, period);
  }, [clients, period, search]);

  const todayCount = useMemo(
    () =>
      filterByPeriod(clients, "next_15_days").filter(
        (c) => daysUntilBirthday(c.birth_date) === 0
      ).length,
    [clients]
  );

  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;

  return (
    <div className="space-y-5">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total com data
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-fg">
            {clients.length}
          </p>
        </div>
        <div
          className={`rounded-xl border-2 bg-white p-4 shadow-sm ${todayCount > 0 ? "border-emerald-400" : "border-border"}`}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Hoje
          </p>
          <p
            className={`mt-1 font-heading text-2xl font-bold ${todayCount > 0 ? "text-emerald-600" : "text-fg"}`}
          >
            {todayCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Próx. 15 dias
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-primary">
            {filterByPeriod(clients, "next_15_days").length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            {MONTH_NAMES[today.getMonth()]}
          </p>
          <p className="mt-1 font-heading text-2xl font-bold text-violet-600">
            {filterByPeriod(clients, currentMonthKey).length}
          </p>
        </div>
      </div>

      {/* ── Message editor ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-heading text-base font-semibold text-fg">
              Mensagem de aniversário
            </h2>
            <p className="mt-0.5 font-body text-xs text-muted">
              Use{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                {"{{cliente_primeiro_nome}}"}
              </code>{" "}
              para personalizar com o nome do cliente
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={handleResetMessage}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 font-body text-xs font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                Desfazer
              </button>
            )}
            <button
              onClick={handleSaveMessage}
              disabled={!isDirty}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-body text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                messageSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-white hover:bg-primary-dark"
              }`}
            >
              {messageSaved ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5" />
                  Salvo!
                </>
              ) : (
                "Salvar mensagem"
              )}
            </button>
          </div>
        </div>
        <div className="p-5">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg border border-border bg-slate-50 px-4 py-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder="Digite a mensagem de aniversário..."
          />
        </div>
      </div>

      {/* ── List panel ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted" />
            <p className="font-body text-sm font-semibold text-fg">
              Mostrar aniversários de
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Buscar cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-48 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:w-60 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <CalendarIcon className="h-4 w-4 text-primary" />
          </div>
          <p className="font-body text-sm font-semibold text-fg">
            {filtered.length}{" "}
            {filtered.length === 1 ? "aniversariante" : "aniversariantes"} —{" "}
            <span className="font-normal text-muted">{periodLabel}</span>
          </p>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CalendarIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum aniversariante no período
            </p>
            <p className="font-body text-xs text-slate-400">
              {search
                ? "Tente outro termo de busca"
                : "Selecione outro período ou mês"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Aniversário
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Contato
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Prazo
                    </th>
                    <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => {
                    const days = daysUntilBirthday(c.birth_date);
                    const age = formatAge(c.birth_date);
                    const isCopied = copiedId === c.id;
                    return (
                      <tr
                        key={c.id}
                        className="group transition-colors hover:bg-primary/5"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(c.name)}`}
                            >
                              {initials(c.name)}
                            </div>
                            <div>
                              <p className="font-body text-sm font-semibold text-fg">
                                {c.name}
                              </p>
                              <p className="font-body text-xs text-muted">
                                {age} anos
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="h-4 w-4 text-muted" />
                            <span className="font-body text-sm font-semibold text-fg">
                              {formatBirthDate(c.birth_date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            <p className="max-w-[160px] truncate font-body text-xs text-muted">
                              {c.email || "—"}
                            </p>
                            <p className="font-body text-xs text-muted">
                              {c.phone || "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <DaysBadge days={days} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCopy(c)}
                              title="Copiar mensagem"
                              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 font-body text-xs font-semibold transition-colors ${
                                isCopied
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-border text-muted hover:border-primary hover:text-primary"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <CheckIcon className="h-3.5 w-3.5" />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <ClipboardListIcon className="h-3.5 w-3.5" />
                                  Copiar
                                </>
                              )}
                            </button>
                            {c.phone && (
                              <button
                                onClick={() => handleWhatsApp(c)}
                                title="Abrir WhatsApp"
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 font-body text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                              >
                                <PhoneIcon className="h-3.5 w-3.5" />
                                WhatsApp
                              </button>
                            )}
                            <Link
                              href={`/dashboard/clientes/${c.id}`}
                              className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                            >
                              Ver
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {filtered.map((c) => {
                const days = daysUntilBirthday(c.birth_date);
                const age = formatAge(c.birth_date);
                const isCopied = copiedId === c.id;
                return (
                  <li key={c.id} className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-body text-sm font-bold ${avatarColor(c.name)}`}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-body text-sm font-semibold text-fg">
                            {c.name}
                          </p>
                          <DaysBadge days={days} />
                        </div>
                        <p className="mt-0.5 font-body text-xs text-muted">
                          {formatBirthDate(c.birth_date)} · {age} anos
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(c)}
                            className={`flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2.5 font-body text-xs font-semibold transition-colors ${
                              isCopied
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-border text-muted hover:text-primary"
                            }`}
                          >
                            {isCopied ? (
                              <CheckIcon className="h-3 w-3" />
                            ) : (
                              <ClipboardListIcon className="h-3 w-3" />
                            )}
                            {isCopied ? "Copiado" : "Copiar"}
                          </button>
                          {c.phone && (
                            <button
                              onClick={() => handleWhatsApp(c)}
                              className="flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 font-body text-xs font-semibold text-emerald-700"
                            >
                              <PhoneIcon className="h-3 w-3" />
                              WhatsApp
                            </button>
                          )}
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="ml-auto flex h-7 items-center gap-1 font-body text-xs font-semibold text-muted hover:text-primary"
                          >
                            Ver
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
