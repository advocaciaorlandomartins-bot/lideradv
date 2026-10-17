import Link from "next/link";
import type { ContadoresAtividadesPrazo } from "@/lib/processos-db";
import { AlertIcon, ClockIcon, CalendarIcon } from "@/components/icons";

export default function AtividadesPrazoPanel({
  contadores,
}: {
  contadores: ContadoresAtividadesPrazo;
}) {
  const { atrasadas, hoje, amanha, futuras, semData } = contadores;
  const total = atrasadas + hoje + amanha + futuras + semData;
  if (total === 0) return null;

  const itens = [
    {
      label: "Atrasadas",
      valor: atrasadas,
      destaque: atrasadas > 0,
      cls: "border-red-200 bg-red-50 text-red-700",
      iconCls: "text-red-500",
      icon: AlertIcon,
    },
    {
      label: "Hoje",
      valor: hoje,
      destaque: hoje > 0,
      cls: "border-amber-200 bg-amber-50 text-amber-700",
      iconCls: "text-amber-500",
      icon: ClockIcon,
    },
    {
      label: "Amanhã",
      valor: amanha,
      destaque: false,
      cls: "border-blue-200 bg-blue-50 text-blue-700",
      iconCls: "text-blue-500",
      icon: CalendarIcon,
    },
    {
      label: "Futuras",
      valor: futuras,
      destaque: false,
      cls: "border-border bg-slate-50 text-slate-600",
      iconCls: "text-slate-400",
      icon: CalendarIcon,
    },
    {
      label: "Sem data",
      valor: semData,
      destaque: false,
      cls: "border-border bg-slate-50 text-slate-500",
      iconCls: "text-slate-400",
      icon: ClockIcon,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
          Atividades em aberto
        </p>
        <Link
          href="/dashboard/minhas-tarefas"
          className="font-body text-xs font-semibold text-primary hover:underline"
        >
          Ver tarefas →
        </Link>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {itens.map(({ label, valor, destaque, cls, iconCls, icon: Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              destaque ? cls : "border-border bg-slate-50 text-slate-600"
            }`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${iconCls}`} />
            <div>
              <p className="font-heading text-lg font-bold leading-none">
                {valor}
              </p>
              <p className="font-body text-[11px] text-current opacity-80">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
