"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Teste {
  id: string;
  nome_candidato: string;
  cargo_vaga: string | null;
  pontuacao_a: number;
  pontuacao_b: number;
  pontuacao_c: number;
  pontuacao_d: number;
  perfil_dominante: string;
  funcao_sugerida: string;
  pontos_fortes: string;
  pontos_atencao: string;
  recomendacao: string;
  pergunta_entrevista: string;
  respostas: unknown;
  created_at: string;
}

const DESCRICOES_FUNCAO: Record<
  string,
  { icon: string; cor: string; desc: string }
> = {
  "SDR / Vendas / Audiências": {
    icon: "🎯",
    cor: "bg-red-50 border-red-200 text-red-800",
    desc: "Este candidato tem perfil ideal para prospecção ativa, fechamento de contratos e representação em audiências previdenciárias.",
  },
  "Atendimento ao Cliente / Captação": {
    icon: "🤝",
    cor: "bg-yellow-50 border-yellow-200 text-yellow-800",
    desc: "Excelente para recepção, triagem inicial de clientes e captação por indicação. Cria vínculo com clientes vulneráveis.",
  },
  "Operacional / Backoffice": {
    icon: "📋",
    cor: "bg-green-50 border-green-200 text-green-800",
    desc: "Perfil ideal para controle de prazos, andamentos, organização de documentos e gestão administrativa do escritório.",
  },
  "Cálculos / Peticionamento Técnico": {
    icon: "⚖️",
    cor: "bg-blue-50 border-blue-200 text-blue-800",
    desc: "Alto grau de precisão técnica. Ideal para elaboração de petições, cálculos previdenciários e análise de CNIS.",
  },
};

function RadarBar({
  label,
  val,
  total,
  color,
}: {
  label: string;
  val: number;
  total: number;
  color: string;
}) {
  const pct = Math.round((val / (total || 1)) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className={`w-20 text-xs font-semibold ${color}`}>{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-muted">
        {val}pt
      </span>
    </div>
  );
}

export default function DiscResultado({ teste }: { teste: Teste }) {
  const router = useRouter();
  const [deletando, setDeletando] = useState(false);
  const total =
    teste.pontuacao_a +
    teste.pontuacao_b +
    teste.pontuacao_c +
    teste.pontuacao_d;

  const funcaoInfo = Object.entries(DESCRICOES_FUNCAO).find(([k]) =>
    teste.funcao_sugerida.includes(k.split("/")[0].trim())
  );

  const isAprovado = !teste.recomendacao.toUpperCase().includes("CAUTELA");

  async function handleDelete() {
    if (!confirm(`Excluir teste de ${teste.nome_candidato}?`)) return;
    setDeletando(true);
    try {
      await fetch(`/api/disc/${teste.id}`, { method: "DELETE" });
      router.push("/dashboard/disc");
      router.refresh();
    } finally {
      setDeletando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header resultado */}
      <div
        className={`rounded-xl border p-6 ${isAprovado ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              Resultado
            </p>
            <h2
              className={`text-2xl font-bold ${isAprovado ? "text-emerald-800" : "text-amber-800"}`}
            >
              {teste.recomendacao}
            </h2>
            <p
              className={`mt-1 text-sm ${isAprovado ? "text-emerald-700" : "text-amber-700"}`}
            >
              Perfil: <strong>{teste.perfil_dominante}</strong>
            </p>
          </div>
          <div
            className={`rounded-full p-3 text-2xl ${isAprovado ? "bg-emerald-100" : "bg-amber-100"}`}
          >
            {isAprovado ? "✅" : "⚠️"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scores DISC */}
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <h3 className="font-semibold text-fg text-sm">Pontuação DISC</h3>
          <div className="space-y-3">
            <RadarBar
              label="A — Executor"
              val={teste.pontuacao_a}
              total={total}
              color="text-red-500"
            />
            <RadarBar
              label="B — Comunicador"
              val={teste.pontuacao_b}
              total={total}
              color="text-yellow-500"
            />
            <RadarBar
              label="C — Planejador"
              val={teste.pontuacao_c}
              total={total}
              color="text-green-500"
            />
            <RadarBar
              label="D — Analista"
              val={teste.pontuacao_d}
              total={total}
              color="text-blue-500"
            />
          </div>
        </div>

        {/* Função sugerida */}
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-5 ${funcaoInfo ? funcaoInfo[1].cor : "border-border bg-surface"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{funcaoInfo?.[1].icon ?? "👤"}</span>
              <h3 className="font-semibold text-sm">Função Sugerida</h3>
            </div>
            <p className="font-bold text-base mb-2">{teste.funcao_sugerida}</p>
            <p className="text-xs opacity-80">{funcaoInfo?.[1].desc}</p>
          </div>
        </div>
      </div>

      {/* Pontos fortes e atenção */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold text-emerald-800 text-sm mb-3">
            ✅ Pontos Fortes
          </h3>
          <p className="text-sm text-emerald-700">{teste.pontos_fortes}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-800 text-sm mb-3">
            ⚠️ Pontos de Atenção
          </h3>
          <p className="text-sm text-amber-700">{teste.pontos_atencao}</p>
        </div>
      </div>

      {/* Pergunta chave entrevista */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="font-semibold text-blue-800 text-sm mb-2">
          🎙️ Pergunta-Chave para a Entrevista Final
        </h3>
        <p className="text-sm text-blue-700 italic">
          &ldquo;{teste.pergunta_entrevista}&rdquo;
        </p>
        <p className="mt-2 text-xs text-blue-500">
          Use esta pergunta para confirmar se o perfil identificado é
          consistente com o comportamento real do candidato.
        </p>
      </div>

      {/* Metadados e ações */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted">
          Avaliado em{" "}
          {new Date(teste.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          {teste.cargo_vaga && ` · Vaga: ${teste.cargo_vaga}`}
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard/disc"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-slate-50 transition-colors"
          >
            ← Voltar
          </Link>
          <button
            onClick={handleDelete}
            disabled={deletando}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            {deletando ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
