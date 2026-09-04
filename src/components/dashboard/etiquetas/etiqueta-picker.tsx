"use client";

import { useMemo, useState, useTransition } from "react";
import type { Etiqueta } from "@/lib/etiquetas-types";
import {
  corClasses,
  formatarEtiqueta,
  CORES_ETIQUETA,
} from "@/lib/etiquetas-types";
import {
  aplicarEtiquetaClienteAction,
  removerEtiquetaClienteAction,
  aplicarEtiquetaProcessoAction,
  removerEtiquetaProcessoAction,
} from "@/lib/etiquetas-actions";
import { PlusIcon, XMarkIcon, TagIcon, SpinnerIcon } from "@/components/icons";

interface Props {
  entidade: "cliente" | "processo";
  entidadeId: string;
  etiquetas: Etiqueta[];
  /** Só pra processo — etiquetas do cliente vinculado, mostradas junto (read-only, sem remover aqui). */
  etiquetasHerdadas?: Etiqueta[];
  catalogo: Etiqueta[];
  podeEditar: boolean;
  podeCriarCategoriaNova: boolean;
}

function Chip({
  etiqueta,
  onRemover,
  removendo,
  herdada,
}: {
  etiqueta: Etiqueta;
  onRemover?: () => void;
  removendo?: boolean;
  herdada?: boolean;
}) {
  const c = corClasses(etiqueta.cor);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-xs font-semibold ${c.bg} ${c.text}`}
      title={herdada ? "Herdada do cliente vinculado" : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {formatarEtiqueta(etiqueta)}
      {herdada && (
        <span className="text-[10px] font-normal opacity-70">(cliente)</span>
      )}
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          disabled={removendo}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
        >
          {removendo ? (
            <SpinnerIcon className="h-2.5 w-2.5" />
          ) : (
            <XMarkIcon className="h-2.5 w-2.5" />
          )}
        </button>
      )}
    </span>
  );
}

export default function EtiquetaPicker({
  entidade,
  entidadeId,
  etiquetas,
  etiquetasHerdadas = [],
  catalogo,
  podeEditar,
  podeCriarCategoriaNova,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [corSelecionada, setCorSelecionada] = useState<string>("slate");
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const aplicarAction =
    entidade === "cliente"
      ? aplicarEtiquetaClienteAction
      : aplicarEtiquetaProcessoAction;
  const removerAction =
    entidade === "cliente"
      ? removerEtiquetaClienteAction
      : removerEtiquetaProcessoAction;

  const sugestoes = useMemo(() => {
    const aplicadas = new Set(etiquetas.map((e) => e.id));
    const termo = busca.trim().toUpperCase();
    return catalogo
      .filter((e) => !aplicadas.has(e.id))
      .filter((e) =>
        termo ? formatarEtiqueta(e).includes(termo.replace(/\s+/g, "_")) : true
      )
      .slice(0, 30);
  }, [catalogo, busca, etiquetas]);

  const [categoriaNova, valorNovo] = busca.includes(":")
    ? busca.split(":", 2)
    : [busca, ""];
  const podeOferecerCriar =
    podeCriarCategoriaNova &&
    categoriaNova.trim().length > 0 &&
    valorNovo.trim().length > 0 &&
    sugestoes.length === 0;

  function aplicar(categoria: string, valor: string, cor?: string) {
    setErro(null);
    startTransition(async () => {
      const result = await aplicarAction(entidadeId, categoria, valor, cor);
      if (result?.error) {
        setErro(result.error);
        return;
      }
      setBusca("");
      setAberto(false);
    });
  }

  function remover(etiquetaId: string) {
    setErro(null);
    setRemovendoId(etiquetaId);
    startTransition(async () => {
      await removerAction(entidadeId, etiquetaId);
      setRemovendoId(null);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {etiquetas.length === 0 &&
          etiquetasHerdadas.length === 0 &&
          !podeEditar && (
            <span className="font-body text-xs text-muted">
              Nenhuma etiqueta.
            </span>
          )}
        {etiquetas.map((e) => (
          <Chip
            key={e.id}
            etiqueta={e}
            removendo={removendoId === e.id}
            onRemover={podeEditar ? () => remover(e.id) : undefined}
          />
        ))}
        {etiquetasHerdadas.map((e) => (
          <Chip key={`herdada-${e.id}`} etiqueta={e} herdada />
        ))}
        {podeEditar && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <PlusIcon className="h-3 w-3" />
            Etiqueta
          </button>
        )}
      </div>

      {erro && (
        <p className="mt-1.5 font-body text-xs font-semibold text-red-600">
          {erro}
        </p>
      )}

      {aberto && podeEditar && (
        <div className="mt-2 rounded-lg border border-border bg-white p-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
            <TagIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="CATEGORIA:VALOR (ex: FASE:JUDICIAL)"
              className="w-full min-w-0 border-0 bg-transparent font-body text-xs text-fg outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mt-1.5 max-h-48 overflow-y-auto">
            {sugestoes.map((e) => (
              <button
                key={e.id}
                type="button"
                disabled={pending}
                onClick={() => aplicar(e.categoria, e.valor, e.cor)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50"
              >
                <Chip etiqueta={e} />
              </button>
            ))}

            {podeOferecerCriar && (
              <div className="mt-1 border-t border-border pt-2">
                <p className="px-2 font-body text-[11px] text-muted">
                  Não existe ainda — criar nova etiqueta:
                </p>
                <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                  {CORES_ETIQUETA.map((cor) => {
                    const c = corClasses(cor);
                    return (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setCorSelecionada(cor)}
                        className={`h-4 w-4 rounded-full ${c.dot} ${corSelecionada === cor ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                        title={cor}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    aplicar(
                      categoriaNova.trim(),
                      valorNovo.trim(),
                      corSelecionada
                    )
                  }
                  className="mx-2 mb-1 flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {pending && <SpinnerIcon className="h-3 w-3" />}
                  Criar{" "}
                  {formatarEtiqueta({
                    categoria: categoriaNova.trim().toUpperCase(),
                    valor: valorNovo.trim().toUpperCase(),
                  })}
                </button>
              </div>
            )}

            {sugestoes.length === 0 && !podeOferecerCriar && (
              <p className="px-2 py-2 font-body text-xs text-muted">
                {busca.includes(":")
                  ? podeCriarCategoriaNova
                    ? "Digite categoria e valor pra criar."
                    : "Etiqueta não encontrada — só administradores podem criar uma nova."
                  : "Nenhuma etiqueta encontrada. Digite CATEGORIA:VALOR."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
