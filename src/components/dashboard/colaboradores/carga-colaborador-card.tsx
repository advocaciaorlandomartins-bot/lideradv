"use client";

import { useState } from "react";
import Link from "next/link";
import type { CargaColaborador } from "@/lib/controladoria-db";
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@/components/icons";
import { Avatar } from "@/components/dashboard/avatar";

function fmtData(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

const STATUS_PRAZO_STYLE: Record<
  "tranquilo" | "proximo" | "vencido",
  { dot: string; text: string; label: string }
> = {
  tranquilo: { dot: "bg-emerald-500", text: "text-muted", label: "Tranquilo" },
  proximo: { dot: "bg-amber-500", text: "text-amber-700", label: "Atenção" },
  vencido: { dot: "bg-red-500", text: "text-red-700", label: "Vencido" },
};

// Tratamento visual diferenciado por nível de carga — quem está "vazio" (0
// abertas) fica visualmente quieto (o normal, não precisa chamar atenção);
// quem tem carga real ou item vencido ganha destaque crescente. Evita a lista
// parecer amadora quando a maioria dos colaboradores está zerada.
const NIVEL_CARGA_STYLE: Record<
  "vazio" | "baixo" | "medio" | "alto",
  { border: string; ring: string; dot: string; numText: string }
> = {
  vazio: {
    border: "border-border",
    ring: "",
    dot: "bg-slate-300",
    numText: "text-slate-300",
  },
  baixo: {
    border: "border-border",
    ring: "",
    dot: "bg-emerald-500",
    numText: "text-fg",
  },
  medio: {
    border: "border-amber-200",
    ring: "ring-1 ring-amber-100",
    dot: "bg-amber-500",
    numText: "text-amber-700",
  },
  alto: {
    border: "border-red-200",
    ring: "ring-1 ring-red-100",
    dot: "bg-red-500",
    numText: "text-red-700",
  },
};

interface Props {
  carga: CargaColaborador;
  podeVerDetalhesDeTodos: boolean;
  meuColaboradorId: string | null;
  /** Some no perfil do próprio colaborador — lá o link "Ver perfil" seria redundante. */
  ocultarLinkPerfil?: boolean;
}

/**
 * Card de carga de um colaborador — usado tanto no grid da Controladoria
 * (visão de todo mundo) quanto sozinho na página de perfil de um colaborador
 * (visão "o que a Karina tem", sem precisar abrir Produção/Controles/CRM
 * separadamente pra montar esse quadro na cabeça).
 */
export function CargaColaboradorCard({
  carga: c,
  podeVerDetalhesDeTodos,
  meuColaboradorId,
  ocultarLinkPerfil,
}: Props) {
  const [aberta, setAberta] = useState(false);

  const nivel =
    c.totalVencidas > 0
      ? "alto"
      : c.totalAbertas >= 8
        ? "medio"
        : c.totalAbertas === 0
          ? "vazio"
          : "baixo";
  const style = NIVEL_CARGA_STYLE[nivel];
  const podeExpandir = c.itens.length > 0;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${style.border} ${style.ring} ${
        aberta ? "sm:col-span-2 xl:col-span-3" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => podeExpandir && setAberta((v) => !v)}
        className={`w-full p-4 text-left transition-colors ${
          podeExpandir
            ? "hover:bg-slate-50/70 cursor-pointer"
            : "cursor-default"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar nome={c.nome} />
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-semibold text-fg">
                {c.nome}
              </p>
              <p className="font-body text-xs text-muted capitalize">
                {c.cargo}
              </p>
            </div>
          </div>
          <span
            className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${style.dot}`}
            title={
              nivel === "alto"
                ? "Tem item vencido"
                : nivel === "medio"
                  ? "Carga alta"
                  : nivel === "vazio"
                    ? "Nada em aberto"
                    : "Carga tranquila"
            }
          />
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          {c.totalAbertas === 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
              <span className="font-body text-xs font-semibold">
                Em dia — nada em aberto
              </span>
            </div>
          ) : (
            <div>
              <p
                className={`font-heading text-2xl font-bold leading-none ${style.numText}`}
              >
                {c.totalAbertas}
              </p>
              <p className="mt-0.5 font-body text-[11px] text-muted">
                aberta{c.totalAbertas !== 1 ? "s" : ""}
              </p>
            </div>
          )}
          {c.totalVencidas > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-red-700">
              <AlertIcon className="h-3.5 w-3.5" />
              <span className="font-body text-xs font-bold">
                {c.totalVencidas} vencida{c.totalVencidas > 1 ? "s" : ""}
              </span>
            </span>
          )}
        </div>

        {/* Detalhamento por fase/categoria — inclui tanto o estágio do
            processo (Análise/Administrativo/Judicial...) quanto os itens
            avulsos (audiência, prazo, atendimento etc). */}
        {c.porCategoria.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {c.porCategoria.map((cat) => (
              <span
                key={cat.categoria}
                className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[11px] font-medium text-muted"
              >
                {cat.label}: {cat.total}
              </span>
            ))}
          </div>
        )}
        {c.itemMaisAntigo && (
          <p className="mt-2 flex items-center gap-1 font-body text-[11px] text-muted">
            <ClockIcon className="h-3 w-3 flex-shrink-0" />
            Mais antigo: {c.itemMaisAntigo.diasAberto}{" "}
            {c.itemMaisAntigo.diasAberto === 1 ? "dia" : "dias"} (desde{" "}
            {fmtData(c.itemMaisAntigo.criadoEm)})
          </p>
        )}
        {c.proximoPrazo && (
          <p className="mt-1 font-body text-[11px] text-muted">
            Próximo prazo: {fmtData(c.proximoPrazo)}
          </p>
        )}
        {!c.itemMaisAntigo &&
          c.totalAbertas > 0 &&
          !podeVerDetalhesDeTodos &&
          c.colaboradorId !== meuColaboradorId && (
            <p className="mt-2 font-body text-[11px] italic text-muted">
              Detalhe item a item visível só pra administração
            </p>
          )}

        {podeExpandir && (
          <div className="mt-3 flex items-center justify-center gap-1 border-t border-border pt-2 font-body text-[11px] font-semibold text-muted">
            {aberta ? "Ocultar detalhes" : "Ver detalhes"}
            {aberta ? (
              <ChevronUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </div>
        )}
      </button>
      {aberta && podeExpandir && (
        <div className="border-t border-border bg-slate-50/60 px-4 py-3">
          {!ocultarLinkPerfil && (
            <Link
              href={`/dashboard/colaboradores/${c.colaboradorId}`}
              className="mb-2 inline-block font-body text-xs font-semibold text-primary hover:underline"
            >
              Ver perfil de {c.nome} (metas, bônus e remuneração) →
            </Link>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="font-body text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-1 pr-3 font-semibold">Item</th>
                  <th className="py-1 pr-3 font-semibold">Cliente</th>
                  <th className="py-1 pr-3 font-semibold">Aberto em</th>
                  <th className="py-1 pr-3 font-semibold">Dias</th>
                  <th className="py-1 pr-3 font-semibold">Prazo</th>
                  <th className="py-1 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {c.itens.map((item) => {
                  const itemStyle = STATUS_PRAZO_STYLE[item.statusPrazo];
                  const titulo = (
                    <>
                      <span className="mr-1.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted ring-1 ring-border">
                        {item.categoriaLabel}
                      </span>
                      {item.titulo}
                    </>
                  );
                  return (
                    <tr key={item.id} className="font-body text-xs">
                      <td className="py-1.5 pr-3 text-fg">
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="hover:text-primary hover:underline"
                          >
                            {titulo}
                          </Link>
                        ) : (
                          titulo
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-muted">
                        {item.clienteNome ?? "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-muted">
                        {fmtData(item.criadoEm)}
                      </td>
                      <td className="py-1.5 pr-3 text-muted">
                        {item.diasAberto}
                      </td>
                      <td className="py-1.5 pr-3 text-muted">
                        {item.prazoInterno && (
                          <span title="Prazo interno">
                            {fmtData(item.prazoInterno)}
                          </span>
                        )}
                        {item.prazoInterno && item.prazoFinal && " → "}
                        {item.prazoFinal && (
                          <span title="Prazo final">
                            {fmtData(item.prazoFinal)}
                          </span>
                        )}
                        {!item.prazoInterno && !item.prazoFinal && "—"}
                      </td>
                      <td className="py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${itemStyle.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${itemStyle.dot}`}
                          />
                          {itemStyle.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
