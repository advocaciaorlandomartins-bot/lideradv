"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Teste {
  id: string;
  nome_candidato: string;
  cargo_vaga: string | null;
  perfil_dominante: string;
  funcao_sugerida: string;
  recomendacao: string;
  pontuacao_a: number;
  pontuacao_b: number;
  pontuacao_c: number;
  pontuacao_d: number;
  created_at: string;
}

function RecomendacaoBadge({ texto }: { texto: string }) {
  const upper = texto.toUpperCase();
  if (upper.includes("APROVADO — PERFIL FORTE")) {
    return (
      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800">
        Aprovado — Perfil Forte
      </span>
    );
  }
  if (upper.includes("APROVADO")) {
    return (
      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
        Aprovado
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
      Avaliar com Cautela
    </span>
  );
}

function BarrasPerfil({
  a,
  b,
  c,
  d,
}: {
  a: number;
  b: number;
  c: number;
  d: number;
}) {
  const total = a + b + c + d || 1;
  const bars = [
    { label: "A", val: a, color: "bg-red-500" },
    { label: "B", val: b, color: "bg-yellow-500" },
    { label: "C", val: c, color: "bg-green-500" },
    { label: "D", val: d, color: "bg-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1">
      {bars.map(({ label, val, color }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <div className="h-6 w-5 bg-slate-100 rounded-sm overflow-hidden flex items-end">
            <div
              className={`w-full ${color} rounded-sm`}
              style={{ height: `${Math.round((val / total) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted font-mono">{label}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  testes: Teste[];
}

export default function DiscList({ testes }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = testes.filter((t) =>
    `${t.nome_candidato} ${t.cargo_vaga ?? ""} ${t.perfil_dominante}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir teste de ${nome}?`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/disc/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Buscar candidato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-fg placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <Link
          href="/dashboard/disc/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Novo Teste
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-6 w-6 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-fg">Nenhum teste encontrado</p>
          <p className="mt-1 text-xs text-muted">
            {search
              ? "Tente outro filtro."
              : "Clique em Novo Teste para avaliar um candidato."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  Candidato
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden sm:table-cell">
                  Vaga
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                  Perfil
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden lg:table-cell">
                  Scores
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  Resultado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide hidden md:table-cell">
                  Data
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/disc/${t.id}`}
                      className="font-medium text-sm text-fg hover:text-primary transition-colors"
                    >
                      {t.nome_candidato}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted hidden sm:table-cell">
                    {t.cargo_vaga ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-fg hidden md:table-cell">
                    {t.perfil_dominante}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <BarrasPerfil
                      a={t.pontuacao_a}
                      b={t.pontuacao_b}
                      c={t.pontuacao_c}
                      d={t.pontuacao_d}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RecomendacaoBadge texto={t.recomendacao} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id, t.nome_candidato)}
                      disabled={deletingId === t.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
