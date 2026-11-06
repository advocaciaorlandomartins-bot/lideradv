"use client";

import { useRef, useState, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import type {
  BibliotecaItem,
  BibliotecaCategoria,
  BibliotecaStatus,
} from "@/lib/biblioteca-juridica-db";

interface Props {
  itensIniciais: BibliotecaItem[];
  podeAprovar: boolean;
}

const CODIGOS_BENEFICIO = [
  "B21",
  "B25",
  "B31",
  "B32",
  "B41",
  "B42",
  "B46",
  "B80",
  "B87",
  "B88",
  "B91",
  "B92",
  "B94",
  "CP",
];

const CATEGORIA_LABEL: Record<string, string> = {
  modelo_peticao: "Modelo de petição",
  precedente: "Precedente",
  outro: "Outro",
};

const STATUS_LABEL: Record<BibliotecaStatus, string> = {
  processando: "Classificando…",
  pendente_revisao: "Aguardando revisão",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  erro: "Erro",
};

const STATUS_COLOR: Record<BibliotecaStatus, string> = {
  processando: "bg-blue-50 text-blue-700",
  pendente_revisao: "bg-amber-50 text-amber-700",
  aprovado: "bg-emerald-50 text-emerald-700",
  rejeitado: "bg-slate-100 text-slate-500",
  erro: "bg-red-50 text-red-700",
};

function formatBytes(b: number | null) {
  if (!b) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface Rascunho {
  categoria: BibliotecaCategoria;
  tribunal: string;
  identificacao: string;
  tese: string;
  beneficiosAplicaveis: string[];
  observacao: string;
  area: string;
  tipoPeticao: string;
  titulo: string;
  resumo: string;
}

function rascunhoDeItem(item: BibliotecaItem): Rascunho {
  return {
    categoria: item.categoria ?? "outro",
    tribunal: item.tribunal ?? "",
    identificacao: item.identificacao ?? "",
    tese: item.tese ?? "",
    beneficiosAplicaveis: item.beneficiosAplicaveis,
    observacao: "",
    area: item.area ?? "previdenciario",
    tipoPeticao: item.tipoPeticao ?? "",
    titulo: item.nome,
    resumo: item.resumo ?? "",
  };
}

export default function BibliotecaContent({
  itensIniciais,
  podeAprovar,
}: Props) {
  const [itens, setItens] = useState<BibliotecaItem[]>(itensIniciais);
  const [uploading, setUploading] = useState(false);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("pendente_revisao");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null);
  const [erroPorItem, setErroPorItem] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(
    async (status: string, categoria: string, buscaAtual: string) => {
      setCarregando(true);
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (categoria) params.set("categoria", categoria);
        if (buscaAtual.trim()) params.set("busca", buscaAtual.trim());
        const res = await fetch(`/api/biblioteca?${params.toString()}`);
        const data = await res.json();
        if (res.ok) setItens(data.itens ?? []);
      } catch {
        // mantém a lista anterior na tela em caso de falha de rede
      } finally {
        setCarregando(false);
      }
    },
    []
  );

  function aplicarFiltro(status: string, categoria: string) {
    setFiltroStatus(status);
    setFiltroCategoria(categoria);
    recarregar(status, categoria, busca);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErro(null);

    for (const file of Array.from(files)) {
      try {
        const blob = await upload(
          `biblioteca/${Date.now()}-${file.name}`,
          file,
          {
            access: "private",
            handleUploadUrl: "/api/biblioteca/upload",
          }
        );

        const res = await fetch("/api/biblioteca/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: file.name,
            tipo: file.type || "application/pdf",
            tamanho: file.size,
            url: blob.url,
          }),
        });
        const data: { item?: BibliotecaItem; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (!res.ok || data.error) {
          setUploadErro(
            `Erro ao processar "${file.name}": ${data.error ?? `HTTP ${res.status}`}`
          );
        } else if (data.item) {
          setItens((prev) => [data.item as BibliotecaItem, ...prev]);
        }
      } catch (err) {
        setUploadErro(
          `Erro ao enviar "${file.name}": ${err instanceof Error ? err.message : "sem conexão com o servidor."}`
        );
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function getRascunho(item: BibliotecaItem): Rascunho {
    return rascunhos[item.id] ?? rascunhoDeItem(item);
  }

  function atualizarRascunho(item: BibliotecaItem, patch: Partial<Rascunho>) {
    setRascunhos((prev) => ({
      ...prev,
      [item.id]: { ...getRascunho(item), ...patch },
    }));
  }

  function toggleBeneficio(item: BibliotecaItem, codigo: string) {
    const r = getRascunho(item);
    const tem = r.beneficiosAplicaveis.includes(codigo);
    atualizarRascunho(item, {
      beneficiosAplicaveis: tem
        ? r.beneficiosAplicaveis.filter((c) => c !== codigo)
        : [...r.beneficiosAplicaveis, codigo],
    });
  }

  async function aprovar(item: BibliotecaItem) {
    const r = getRascunho(item);
    setAcaoEmCurso(item.id);
    setErroPorItem((prev) => ({ ...prev, [item.id]: "" }));
    try {
      const body =
        r.categoria === "precedente"
          ? {
              categoria: "precedente",
              tribunal: r.tribunal,
              identificacao: r.identificacao,
              tese: r.tese,
              beneficiosAplicaveis: r.beneficiosAplicaveis,
              observacao: r.observacao,
            }
          : {
              categoria: "modelo_peticao",
              area: r.area,
              tipoPeticao: r.tipoPeticao,
              titulo: r.titulo,
              texto: item.textoExtraido ?? "",
              resumo: r.resumo,
            };
      const res = await fetch(`/api/biblioteca/${item.id}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: { item?: BibliotecaItem; error?: string } = await res.json();
      if (!res.ok || data.error) {
        setErroPorItem((prev) => ({
          ...prev,
          [item.id]: data.error ?? "Erro ao aprovar.",
        }));
      } else {
        setItens((prev) =>
          prev.map((i) =>
            i.id === item.id ? (data.item as BibliotecaItem) : i
          )
        );
      }
    } catch {
      setErroPorItem((prev) => ({ ...prev, [item.id]: "Erro de conexão." }));
    } finally {
      setAcaoEmCurso(null);
    }
  }

  async function rejeitar(item: BibliotecaItem) {
    setAcaoEmCurso(item.id);
    try {
      const res = await fetch(`/api/biblioteca/${item.id}/rejeitar`, {
        method: "POST",
      });
      const data: { item?: BibliotecaItem; error?: string } = await res.json();
      if (res.ok && data.item) {
        setItens((prev) =>
          prev.map((i) =>
            i.id === item.id ? (data.item as BibliotecaItem) : i
          )
        );
      }
    } finally {
      setAcaoEmCurso(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg">
            Biblioteca Jurídica
          </h1>
          <p className="mt-1 max-w-2xl font-body text-sm text-muted">
            Envie petições reais (referência de argumentação) ou sentenças/
            acórdãos favoráveis (precedentes). A IA lê, classifica e sugere os
            dados — um administrador revisa e aprova antes de entrar na base que
            o Cérebro Jurídico e o Dr. Lex já consultam em toda análise e
            petição futura.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Enviando e classificando…
              </>
            ) : (
              "+ Enviar documento"
            )}
          </button>
        </div>
      </div>

      {uploadErro && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-body text-sm text-red-700">
          {uploadErro}
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: "pendente_revisao", l: "Aguardando revisão" },
          { v: "aprovado", l: "Aprovados" },
          { v: "rejeitado", l: "Rejeitados" },
          { v: "", l: "Todos" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => aplicarFiltro(f.v, filtroCategoria)}
            className={`rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
              filtroStatus === f.v
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.l}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {[
          { v: "", l: "Qualquer categoria" },
          { v: "modelo_peticao", l: "Modelos" },
          { v: "precedente", l: "Precedentes" },
          { v: "outro", l: "Outros" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => aplicarFiltro(filtroStatus, f.v)}
            className={`rounded-full px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
              filtroCategoria === f.v
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.l}
          </button>
        ))}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              recarregar(filtroStatus, filtroCategoria, busca);
          }}
          onBlur={() => recarregar(filtroStatus, filtroCategoria, busca)}
          placeholder="Buscar por nome, tese, identificação…"
          className="ml-auto h-8 w-64 rounded-lg border border-border px-3 font-body text-xs text-fg focus:border-primary focus:outline-none"
        />
      </div>

      {carregando && (
        <p className="font-body text-xs text-muted">Carregando…</p>
      )}

      {!carregando && itens.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-white py-16 text-center">
          <p className="font-heading text-base font-semibold text-fg">
            Nada por aqui
          </p>
          <p className="font-body text-sm text-muted">
            Envie uma petição-modelo ou um precedente favorável pra começar.
          </p>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-4">
        {itens.map((item) => {
          const r = getRascunho(item);
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading text-sm font-semibold text-fg truncate">
                    {item.nome}
                  </p>
                  <p className="font-body text-[11px] text-muted">
                    {formatBytes(item.tamanho)} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("pt-BR")} ·
                    enviado por {item.enviadoPorNome ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.categoria && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-body text-[11px] font-semibold text-blue-700">
                      {CATEGORIA_LABEL[item.categoria]}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold ${STATUS_COLOR[item.status]}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <a
                    href={`/api/biblioteca/${item.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-xs font-semibold text-primary hover:underline"
                  >
                    Abrir
                  </a>
                </div>
              </div>

              {item.resumo && (
                <p className="font-body text-sm text-slate-700">
                  {item.resumo}
                </p>
              )}

              {item.status === "erro" && (
                <p className="rounded-lg bg-red-50 p-2 font-body text-xs text-red-700">
                  {item.erroClassificacao}
                </p>
              )}

              {/* Revisão (pendente_revisao, admin) */}
              {item.status === "pendente_revisao" && podeAprovar && (
                <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                      Categoria
                    </label>
                    <select
                      value={r.categoria}
                      onChange={(e) =>
                        atualizarRascunho(item, {
                          categoria: e.target.value as BibliotecaCategoria,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-xs text-slate-900"
                    >
                      <option value="precedente">Precedente</option>
                      <option value="modelo_peticao">Modelo de petição</option>
                      <option value="outro">Outro (não entra na base)</option>
                    </select>
                  </div>

                  {r.categoria === "precedente" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                            Tribunal
                          </label>
                          <input
                            value={r.tribunal}
                            onChange={(e) =>
                              atualizarRascunho(item, {
                                tribunal: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                            Identificação (citação exata)
                          </label>
                          <input
                            value={r.identificacao}
                            onChange={(e) =>
                              atualizarRascunho(item, {
                                identificacao: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                          Tese (pronta pra citar numa petição)
                        </label>
                        <textarea
                          value={r.tese}
                          onChange={(e) =>
                            atualizarRascunho(item, { tese: e.target.value })
                          }
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                          Benefícios aplicáveis
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {CODIGOS_BENEFICIO.map((cod) => (
                            <button
                              key={cod}
                              type="button"
                              onClick={() => toggleBeneficio(item, cod)}
                              className={`rounded-full px-2.5 py-1 font-body text-[11px] font-semibold ${
                                r.beneficiosAplicaveis.includes(cod)
                                  ? "bg-primary text-white"
                                  : "bg-white border border-slate-200 text-slate-600"
                              }`}
                            >
                              {cod}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                          Observação (opcional)
                        </label>
                        <input
                          value={r.observacao}
                          onChange={(e) =>
                            atualizarRascunho(item, {
                              observacao: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                        />
                      </div>
                    </>
                  )}

                  {r.categoria === "modelo_peticao" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                            Área
                          </label>
                          <input
                            value={r.area}
                            onChange={(e) =>
                              atualizarRascunho(item, { area: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                            Tipo de peça
                          </label>
                          <input
                            value={r.tipoPeticao}
                            onChange={(e) =>
                              atualizarRascunho(item, {
                                tipoPeticao: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block font-body text-xs font-medium text-slate-700">
                          Título
                        </label>
                        <input
                          value={r.titulo}
                          onChange={(e) =>
                            atualizarRascunho(item, { titulo: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-body text-xs"
                        />
                      </div>
                      {!item.textoExtraido && (
                        <p className="rounded-lg bg-amber-50 p-2 font-body text-xs text-amber-700">
                          Não consegui extrair o texto deste PDF (provavelmente
                          escaneado/sem camada de texto) — não dá pra aprovar
                          como modelo sem o texto. Envie uma versão com texto
                          selecionável, ou aprove como &quot;Outro&quot;.
                        </p>
                      )}
                    </>
                  )}

                  {erroPorItem[item.id] && (
                    <p className="font-body text-xs text-red-600">
                      {erroPorItem[item.id]}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => rejeitar(item)}
                      disabled={acaoEmCurso === item.id}
                      className="rounded-lg border border-slate-200 px-4 py-1.5 font-body text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => aprovar(item)}
                      disabled={
                        acaoEmCurso === item.id ||
                        r.categoria === "outro" ||
                        (r.categoria === "modelo_peticao" &&
                          !item.textoExtraido)
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 font-body text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {acaoEmCurso === item.id ? "Aprovando…" : "Aprovar"}
                    </button>
                  </div>
                </div>
              )}

              {item.status === "aprovado" && (
                <p className="font-body text-xs text-emerald-700">
                  ✓ Aprovado por {item.revisadoPorNome ?? "—"} em{" "}
                  {item.revisadoEm
                    ? new Date(item.revisadoEm).toLocaleDateString("pt-BR")
                    : "—"}
                  {item.categoria === "precedente" &&
                    ` — já consultável como ${item.tribunal} — ${item.identificacao}`}
                </p>
              )}

              {item.status === "rejeitado" && (
                <p className="font-body text-xs text-muted">
                  Rejeitado por {item.revisadoPorNome ?? "—"}
                  {item.revisadoEm
                    ? ` em ${new Date(item.revisadoEm).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
