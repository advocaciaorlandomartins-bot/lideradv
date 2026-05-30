"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";

export interface CalendarEvent {
  id: string;
  tipo_label: string;
  descricao: string;
  cliente_nome: string | null;
  data_evento: string;
  dias_restantes: number;
}

interface MiniCalendarProps {
  events: CalendarEvent[];
}

const TIPO_COLORS: Record<string, string> = {
  audiencias: "bg-violet-100 text-violet-700",
  prazos: "bg-red-100 text-red-700",
  pericias: "bg-cyan-100 text-cyan-700",
  dcb: "bg-orange-100 text-orange-700",
  beneficios: "bg-emerald-100 text-emerald-700",
  implantados: "bg-blue-100 text-blue-700",
  "implantados-data": "bg-blue-100 text-blue-700",
  alvaras: "bg-amber-100 text-amber-700",
};

export default function MiniCalendar({ events }: MiniCalendarProps) {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();

  // Group events by day (current month only)
  const eventsByDay = new Map<number, CalendarEvent[]>();
  events.forEach((e) => {
    const d = new Date(e.data_evento + "T12:00:00");
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate();
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day)!.push(e);
    }
  });

  const totalEventos = Array.from(eventsByDay.values()).reduce(
    (s, arr) => s + arr.length,
    0
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthLabel = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  function openDay(day: number) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActiveDay(day);
  }
  function startHide() {
    hideTimer.current = setTimeout(() => setActiveDay(null), 140);
  }
  function cancelHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-fg capitalize">
          {monthLabel}
        </h2>
        <CalendarIcon className="h-4 w-4 text-muted" />
      </div>

      <table className="w-full table-fixed text-center">
        <thead>
          <tr>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <th
                key={i}
                className="pb-2 font-body text-[11px] font-semibold text-muted"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {Array.from({ length: 7 }, (_, di) => {
                const day = week[di] ?? null;
                const isToday = day === today;
                const dayEvents =
                  day !== null ? (eventsByDay.get(day) ?? []) : [];
                const hasEvent = dayEvents.length > 0;
                const isActive = day === activeDay;

                return (
                  <td key={di} className="relative py-0.5">
                    {day !== null ? (
                      hasEvent ? (
                        /* Dia com evento — interativo */
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => openDay(day)}
                          onMouseLeave={startHide}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveDay(isActive ? null : day)}
                            className={`
                              inline-flex h-7 w-7 items-center justify-center rounded-full
                              font-body text-xs font-bold transition-all duration-150
                              ${
                                isToday
                                  ? "bg-primary text-white ring-2 ring-amber-400 ring-offset-1"
                                  : "bg-amber-400 text-white hover:bg-amber-500 hover:scale-110 cursor-pointer"
                              }
                              ${isActive && !isToday ? "ring-2 ring-amber-300 ring-offset-1 scale-110" : ""}
                            `}
                            title={`${dayEvents.length} evento${dayEvents.length !== 1 ? "s" : ""} — clique para ver`}
                          >
                            {day}
                          </button>

                          {/* Popover */}
                          {isActive && (
                            <div
                              className="absolute z-50 bottom-full left-1/2 mb-2 w-60 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
                              style={{ minWidth: "15rem" }}
                              onMouseEnter={cancelHide}
                              onMouseLeave={startHide}
                            >
                              {/* Cabeçalho */}
                              <div className="flex items-center justify-between border-b border-border bg-amber-50 px-3 py-2">
                                <span className="font-body text-[11px] font-semibold text-amber-800">
                                  {String(day).padStart(2, "0")}/
                                  {String(month + 1).padStart(2, "0")}
                                </span>
                                <span className="rounded-full bg-amber-200 px-2 py-0.5 font-body text-[10px] font-bold text-amber-800">
                                  {dayEvents.length} evento
                                  {dayEvents.length !== 1 ? "s" : ""}
                                </span>
                              </div>

                              {/* Lista de eventos */}
                              <div className="max-h-52 divide-y divide-border overflow-y-auto">
                                {dayEvents.map((ev) => (
                                  <div key={ev.id} className="px-3 py-2.5">
                                    {/* Tipo + urgência */}
                                    <div className="mb-1 flex items-center gap-1.5">
                                      <span
                                        className={`rounded px-1.5 py-0.5 font-body text-[10px] font-semibold ${TIPO_COLORS[ev.tipo_label.toLowerCase().replace(/ /g, "_")] ?? "bg-amber-100 text-amber-700"}`}
                                      >
                                        {ev.tipo_label}
                                      </span>
                                      {ev.dias_restantes === 0 && (
                                        <span className="font-body text-[10px] font-bold text-red-600">
                                          Hoje!
                                        </span>
                                      )}
                                      {ev.dias_restantes === 1 && (
                                        <span className="font-body text-[10px] font-bold text-orange-600">
                                          Amanhã
                                        </span>
                                      )}
                                    </div>

                                    {/* Descrição */}
                                    <p className="line-clamp-2 font-body text-xs font-medium text-fg">
                                      {ev.descricao}
                                    </p>

                                    {/* Cliente */}
                                    {ev.cliente_nome && (
                                      <p className="mt-0.5 font-body text-[11px] font-semibold text-primary">
                                        {ev.cliente_nome}
                                      </p>
                                    )}

                                    {/* Botão abrir */}
                                    <Link
                                      href={`/dashboard/controles/${ev.id}`}
                                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-body text-[11px] font-semibold text-white transition-colors hover:bg-primary/90"
                                    >
                                      Abrir controle →
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Dia sem evento */
                        <span
                          className={`
                            inline-flex h-7 w-7 items-center justify-center rounded-full
                            font-body text-xs font-medium
                            ${isToday ? "bg-primary text-white font-bold" : "text-fg"}
                          `}
                        >
                          {day}
                        </span>
                      )
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {totalEventos > 0 && (
        <p className="mt-3 flex items-center gap-1.5 font-body text-xs text-muted">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-amber-400" />
          {totalEventos} evento{totalEventos !== 1 ? "s" : ""} este mês · passe
          o mouse para ver
        </p>
      )}
    </div>
  );
}
