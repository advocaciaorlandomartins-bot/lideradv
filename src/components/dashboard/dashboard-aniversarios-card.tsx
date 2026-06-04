"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { AniversarianteHoje } from "@/lib/dashboard-db";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function parseBirth(dateStr: string) {
  const [, mm, dd] = dateStr.split("-");
  return { month: Number(mm), day: Number(dd) };
}

function formatDate(dateStr: string) {
  const { month, day } = parseBirth(dateStr);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function isToday(dateStr: string) {
  const now = new Date();
  const { month, day } = parseBirth(dateStr);
  return month === now.getMonth() + 1 && day === now.getDate();
}

function isNextDays(dateStr: string, days: number) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { month, day } = parseBirth(dateStr);
  const bd = new Date(todayStart.getFullYear(), month - 1, day);
  if (bd < todayStart) bd.setFullYear(todayStart.getFullYear() + 1);
  const diff = Math.round((bd.getTime() - todayStart.getTime()) / 86400000);
  return diff > 0 && diff <= days;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  clientes: AniversarianteHoje[];
}

export default function DashboardAniversariosCard({ clientes }: Props) {
  const mesAtual = new Date().getMonth() + 1;
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);

  const countPorMes = useMemo(() => {
    const counts = new Array(12).fill(0);
    for (const c of clientes) {
      const { month } = parseBirth(c.birth_date);
      counts[month - 1]++;
    }
    return counts;
  }, [clientes]);

  const aniversariantesMes = useMemo(
    () =>
      clientes.filter((c) => parseBirth(c.birth_date).month === mesSelecionado),
    [clientes, mesSelecionado]
  );

  const hojeCount = useMemo(
    () => clientes.filter((c) => isToday(c.birth_date)).length,
    [clientes]
  );

  if (clientes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🎂</span>
          <div>
            <h2 className="font-heading text-sm font-semibold text-fg">
              Aniversariantes
            </h2>
            <p className="font-body text-xs text-muted">
              {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} com
              data cadastrada
              {hojeCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-body text-[10px] font-bold text-emerald-700">
                  🎂 {hojeCount} hoje
                </span>
              )}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/clientes/aniversarios"
          className="font-body text-xs font-semibold text-primary hover:underline"
        >
          Ver completo →
        </Link>
      </div>

      {/* Month pills */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 scrollbar-hide">
        {MESES.map((label, i) => {
          const mes = i + 1;
          const count = countPorMes[i];
          const active = mesSelecionado === mes;
          const isCurrentMonth = mes === mesAtual;
          return (
            <button
              key={mes}
              onClick={() => setMesSelecionado(mes)}
              className={`flex flex-shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-all cursor-pointer ${
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : isCurrentMonth
                    ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                    : "border-border bg-white text-muted hover:border-primary/40 hover:text-fg"
              }`}
            >
              <span className="font-body text-[11px] font-semibold">
                {label}
              </span>
              <span
                className={`font-mono text-[10px] font-bold ${
                  active
                    ? "text-white/80"
                    : count > 0
                      ? "text-primary"
                      : "text-slate-300"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="border-t border-border">
        {aniversariantesMes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl">📅</span>
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum aniversariante em {MESES[mesSelecionado - 1]}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {aniversariantesMes.map((c) => {
              const hoje = isToday(c.birth_date);
              const emBreve = !hoje && isNextDays(c.birth_date, 7);
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/clientes/${c.id}`}
                  className={`flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-primary/5 ${
                    hoje ? "bg-emerald-50/60" : ""
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold ${
                      hoje
                        ? "bg-emerald-200 text-emerald-800"
                        : avatarColor(c.name)
                    }`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-body text-sm font-semibold text-fg">
                        {c.name.split(" ")[0]}
                      </p>
                      {hoje && (
                        <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 font-body text-[10px] font-bold text-emerald-700">
                          🎂 Hoje!
                        </span>
                      )}
                      {emBreve && (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-body text-[10px] font-semibold text-amber-700">
                          Em breve
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <p className="font-body text-xs text-muted">{c.phone}</p>
                    )}
                  </div>

                  <span className="flex-shrink-0 font-body text-xs font-semibold text-muted">
                    {formatDate(c.birth_date)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
