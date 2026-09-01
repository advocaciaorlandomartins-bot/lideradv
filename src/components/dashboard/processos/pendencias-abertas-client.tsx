"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PendenciaAberta } from "@/lib/processo-full-db";
import { updatePendenciaStatusAction } from "@/lib/processo-full-actions";
import ProcessosSubNav from "@/components/dashboard/processos/processos-sub-nav";
import { AlertIcon, CheckIcon, ChevronRightIcon } from "@/components/icons";

function waLink(telefone: string, mensagem: string): string {
  const digits = telefone.replace(/\D/g, "");
  const comDDI = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem)}`;
}

function urgenciaCls(dias: number): { dot: string; label: string } {
  if (dias >= 15) return { dot: "bg-red-500", label: `${dias} dias parado` };
  if (dias >= 7) return { dot: "bg-amber-500", label: `${dias} dias parado` };
  return { dot: "bg-slate-300", label: `${dias} dia${dias === 1 ? "" : "s"}` };
}

export default function PendenciasAbertasClient({
  pendencias: pendenciasIniciais,
}: {
  pendencias: PendenciaAberta[];
}) {
  const [pendencias, setPendencias] = useState(pendenciasIniciais);
  const [busca, setBusca] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pendencias;
    return pendencias.filter(
      (p) =>
        p.clienteNome?.toLowerCase().includes(q) ||
        p.processoNumero?.toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q) ||
        p.responsavelNome?.toLowerCase().includes(q)
    );
  }, [pendencias, busca]);

  const totalVencidas = pendencias.filter((p) => p.diasAberta >= 15).length;

  function resolver(p: PendenciaAberta) {
    setPendencias((prev) => prev.filter((x) => x.id !== p.id));
    startTransition(async () => {
      const result = await updatePendenciaStatusAction(
        p.id,
        "resolvida",
        p.processo_id
      );
      if (result?.error) {
        alert(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <ProcessosSubNav />

      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">Pendências</h1>
        <p className="mt-1 font-body text-sm text-muted">
          Documentos e ações que faltam do cliente, em todos os processos — quem
          cuida disso vê tudo aqui, sem precisar abrir processo por processo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="font-body text-xs text-muted">Pendências abertas</p>
          <p className="font-heading text-2xl font-bold text-fg">
            {pendencias.length}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-body text-xs text-red-700">
            15+ dias sem resposta
          </p>
          <p className="font-heading text-2xl font-bold text-red-700">
            {totalVencidas}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, processo..."
            className="h-full w-full bg-transparent font-body text-sm text-fg placeholder:text-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-slate-50 px-4 py-12 text-center">
          <p className="font-body text-sm text-muted">
            {pendencias.length === 0
              ? "Nenhuma pendência aberta — tudo em dia."
              : "Nenhuma pendência encontrada para essa busca."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <ul className="divide-y divide-border">
            {filtradas.map((p) => {
              const urg = urgenciaCls(p.diasAberta);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start gap-3 px-5 py-4"
                >
                  <button
                    onClick={() => resolver(p)}
                    title="Marcar como resolvida"
                    className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 border-amber-400 hover:border-emerald-500 hover:bg-emerald-50 transition-colors cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm text-fg leading-relaxed">
                      {p.descricao}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs text-muted">
                      {p.clienteNome && (
                        <Link
                          href={`/dashboard/clientes/${p.clienteId}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {p.clienteNome}
                        </Link>
                      )}
                      {p.processoNumero && (
                        <span>
                          {p.tipoAcao ?? "Processo"} · {p.processoNumero}
                        </span>
                      )}
                      {p.responsavelNome && (
                        <span>Resp.: {p.responsavelNome}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${urg.dot}`}
                        />
                        {urg.label}
                        {p.diasAberta >= 15 && (
                          <AlertIcon className="h-3 w-3 text-red-500" />
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {p.clienteTelefone && (
                      <a
                        href={waLink(
                          p.clienteTelefone,
                          `Olá! Temos uma pendência referente ao seu processo${p.processoNumero ? ` (${p.processoNumero})` : ""}:\n\n${p.descricao}\n\nPor favor, providencie o mais breve possível. Grato(a)!`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => resolver(p)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 font-body text-xs font-semibold text-muted hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                      title="Marcar como resolvida"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      href={`/dashboard/processos/${p.processo_id}`}
                      className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 font-body text-xs font-semibold text-muted hover:border-primary hover:text-primary transition-colors"
                    >
                      Ver
                      <ChevronRightIcon className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
