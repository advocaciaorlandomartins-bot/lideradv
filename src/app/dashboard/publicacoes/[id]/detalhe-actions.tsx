"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Publicacao } from "@/lib/publicacoes-db";
import {
  marcarComoTratadaAction,
  marcarComoNaoLidaAction,
} from "@/lib/publicacoes-actions";
import {
  SpinnerIcon,
  CheckIcon,
  ClipboardCopyIcon,
  ArrowTopRightOnSquareIcon,
} from "@/components/icons";

export default function PublicacaoDetalheActions({
  pub,
  tribunalUrl,
}: {
  pub: Publicacao;
  tribunalUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleTratar() {
    startTransition(async () => {
      await marcarComoTratadaAction(pub.id);
      router.refresh();
    });
  }

  function handleDesfazer() {
    startTransition(async () => {
      await marcarComoNaoLidaAction(pub.id);
      router.refresh();
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(pub.processo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/dashboard/publicacoes"
        className="flex h-9 items-center rounded-lg border border-border px-3.5 font-body text-sm font-semibold text-muted transition-colors hover:border-primary/40 hover:text-fg"
      >
        ← Voltar
      </Link>

      <button
        onClick={handleCopy}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 font-body text-sm font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-emerald-600" />
        ) : (
          <ClipboardCopyIcon className="h-4 w-4" />
        )}
        {copied ? "Copiado!" : "Copiar nº"}
      </button>

      {tribunalUrl && (
        <a
          href={tribunalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 font-body text-sm font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          Abrir no tribunal
        </a>
      )}

      <Link
        href="/dashboard/controles/novo"
        className="flex h-9 items-center rounded-lg border border-border bg-white px-3.5 font-body text-sm font-semibold text-fg transition-colors hover:border-primary/40 hover:text-primary"
      >
        + Criar atividade
      </Link>

      {pub.status === "nao_lida" ? (
        <button
          onClick={handleTratar}
          disabled={isPending}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? (
            <SpinnerIcon className="h-4 w-4" />
          ) : (
            <CheckIcon className="h-4 w-4" />
          )}
          Marcar como tratada
        </button>
      ) : (
        <button
          onClick={handleDesfazer}
          disabled={isPending}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 font-body text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
        >
          {isPending && <SpinnerIcon className="h-4 w-4" />}
          Desfazer
        </button>
      )}
    </div>
  );
}
