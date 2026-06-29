"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BLOCOS = [
  {
    n: 1,
    A: ["Autoconfiante", "Independente", "Dominante"],
    B: ["Comunicativo", "Alegre", "Extrovertido"],
    C: ["Acolhedor", "Amigável", "Paciente"],
    D: ["Autodisciplinado", "Atento a detalhes", "Diligente"],
  },
  {
    n: 2,
    A: ["Decisivo", "Direto", "Competitivo"],
    B: ["Persuasivo", "Otimista", "Entusiasmado"],
    C: ["Leal", "Consistente", "Previsível"],
    D: ["Preciso", "Sistemático", "Analítico"],
  },
  {
    n: 3,
    A: ["Ousado", "Corajoso", "Determinado"],
    B: ["Inspirador", "Emotivo", "Sociável"],
    C: ["Cooperativo", "Estável", "Confiável"],
    D: ["Cauteloso", "Meticuloso", "Perfeccionista"],
  },
  {
    n: 4,
    A: ["Ambicioso", "Inovador", "Desafiador"],
    B: ["Carismático", "Falante", "Animado"],
    C: ["Tranquilo", "Moderado", "Mediador"],
    D: ["Organizado", "Rigoroso", "Criterioso"],
  },
  {
    n: 5,
    A: ["Focado em resultados", "Rápido", "Assertivo"],
    B: ["Simpático", "Impulsivo", "Criativo"],
    C: ["Bom ouvinte", "Harmonioso", "Flexível"],
    D: ["Reservado", "Técnico", "Disciplinado"],
  },
  {
    n: 6,
    A: ["Líder natural", "Controlador", "Pioneiro"],
    B: ["Popular", "Expressivo", "Divertido"],
    C: ["Pacificador", "Gentil", "Solidário"],
    D: ["Prudente", "Lógico", "Racional"],
  },
  {
    n: 7,
    A: ["Produtivo", "Eficiente", "Voltado à ação"],
    B: ["Motivador", "Espontâneo", "Apaixonado"],
    C: ["Dedicado", "Persistente", "Comprometido"],
    D: ["Detalhista", "Consciente", "Investigativo"],
  },
  {
    n: 8,
    A: ["Obstinado", "Exigente", "Incisivo"],
    B: ["Dinâmico", "Atraente", "Encantador"],
    C: ["Equânime", "Tolerante", "Prestativo"],
    D: ["Conservador", "Confiável tecnicamente", "Estruturado"],
  },
  {
    n: 9,
    A: ["Resolutivo", "Prático", "Objetivo"],
    B: ["Colaborativo", "Aberto", "Entusiasta"],
    C: ["Empático", "Cuidadoso", "Paciente"],
    D: ["Minucioso", "Perfeccionista", "Criterioso"],
  },
  {
    n: 10,
    A: ["Proativo", "Destemido", "Voltado a metas"],
    B: ["Comunicador", "Positivo", "Influente"],
    C: ["Seguro", "Tranquilo", "Previsível"],
    D: ["Especialista", "Técnico", "Analítico"],
  },
] as const;

type Letra = "A" | "B" | "C" | "D";

interface BlocoRespostas {
  bloco: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

export default function DiscForm() {
  const router = useRouter();
  const [nomeCandidato, setNomeCandidato] = useState("");
  const [cargoVaga, setCargoVaga] = useState("");
  const [respostas, setRespostas] = useState<
    Record<number, Record<Letra, number>>
  >(() =>
    Object.fromEntries(BLOCOS.map((b) => [b.n, { A: 0, B: 0, C: 0, D: 0 }]))
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  function setNota(bloco: number, letra: Letra, nota: number) {
    setRespostas((prev) => {
      const current = { ...prev[bloco] };
      // Remover nota duplicada
      for (const l of ["A", "B", "C", "D"] as Letra[]) {
        if (l !== letra && current[l] === nota) current[l] = 0;
      }
      current[letra] = nota;
      return { ...prev, [bloco]: current };
    });
  }

  function blocoCompleto(bloco: number) {
    const r = respostas[bloco];
    const vals = [r.A, r.B, r.C, r.D];
    return vals.every((v) => v > 0) && new Set(vals).size === 4;
  }

  const totalCompletos = BLOCOS.filter((b) => blocoCompleto(b.n)).length;
  const tudo = totalCompletos === 10 && nomeCandidato.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!tudo) {
      setErro("Preencha todos os 10 blocos e o nome do candidato.");
      return;
    }

    const payload: BlocoRespostas[] = BLOCOS.map((b) => ({
      bloco: b.n,
      a: respostas[b.n].A,
      b: respostas[b.n].B,
      c: respostas[b.n].C,
      d: respostas[b.n].D,
    }));

    setLoading(true);
    try {
      const res = await fetch("/api/disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_candidato: nomeCandidato.trim(),
          cargo_vaga: cargoVaga.trim() || undefined,
          respostas: payload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao salvar teste.");
      }

      const { teste } = await res.json();
      router.push(`/dashboard/disc/${teste.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Dados do candidato */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="font-semibold text-fg text-base">Dados do Candidato</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Nome do Candidato <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nomeCandidato}
              onChange={(e) => setNomeCandidato(e.target.value)}
              placeholder="Ex: João Silva"
              maxLength={120}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Vaga / Cargo (opcional)
            </label>
            <input
              type="text"
              value={cargoVaga}
              onChange={(e) => setCargoVaga(e.target.value)}
              placeholder="Ex: Advogado Previdenciário"
              maxLength={120}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Instrução */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Como preencher:</strong> Para cada bloco, atribua notas de{" "}
        <strong>1 a 4</strong> para cada grupo de características, sem repetir
        notas. A nota <strong>4</strong> representa o que mais descreve você; a
        nota <strong>1</strong>, o que menos descreve.
      </div>

      {/* Blocos */}
      {BLOCOS.map((bloco) => {
        const completo = blocoCompleto(bloco.n);
        return (
          <div
            key={bloco.n}
            className={`rounded-xl border bg-surface p-6 transition-colors ${
              completo ? "border-emerald-300" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-fg text-sm">Bloco {bloco.n}</h3>
              {completo && (
                <span className="text-xs text-emerald-600 font-medium">
                  ✓ Completo
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["A", "B", "C", "D"] as Letra[]).map((letra) => {
                const descricoes = bloco[letra] as readonly string[];
                const letraLabel: Record<Letra, string> = {
                  A: "Executor (A)",
                  B: "Comunicador (B)",
                  C: "Planejador (C)",
                  D: "Analista (D)",
                };
                const letraStyles: Record<
                  Letra,
                  { card: string; cor: string }
                > = {
                  A: {
                    card: "text-red-700 bg-red-50 border-red-200",
                    cor: "#ef4444",
                  },
                  B: {
                    card: "text-yellow-700 bg-yellow-50 border-yellow-200",
                    cor: "#ca8a04",
                  },
                  C: {
                    card: "text-green-700 bg-green-50 border-green-200",
                    cor: "#16a34a",
                  },
                  D: {
                    card: "text-blue-700 bg-blue-50 border-blue-200",
                    cor: "#2563eb",
                  },
                };
                const selecionado = respostas[bloco.n][letra];
                const cor = letraStyles[letra].cor;
                return (
                  <div
                    key={letra}
                    className={`rounded-lg border p-3 ${letraStyles[letra].card}`}
                  >
                    <p className="text-xs font-semibold mb-2">
                      {letraLabel[letra]}
                    </p>
                    <ul className="text-xs space-y-0.5 mb-3 opacity-80">
                      {descricoes.map((d) => (
                        <li key={d}>• {d}</li>
                      ))}
                    </ul>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((nota) => (
                        <button
                          key={nota}
                          type="button"
                          onClick={() => setNota(bloco.n, letra, nota)}
                          style={
                            selecionado === nota
                              ? {
                                  backgroundColor: cor,
                                  color: "#fff",
                                  borderColor: cor,
                                }
                              : {
                                  backgroundColor: "#fff",
                                  color: cor,
                                  borderColor: cor + "66",
                                }
                          }
                          className="flex-1 rounded text-xs font-bold py-2 transition-all border cursor-pointer hover:scale-105 active:scale-95"
                        >
                          {nota}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {erro && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {totalCompletos}/10 blocos preenchidos
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !tudo}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {loading ? "Analisando..." : "Calcular Perfil DISC"}
          </button>
        </div>
      </div>
    </form>
  );
}
