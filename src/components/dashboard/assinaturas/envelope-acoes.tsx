"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelarEnvelopeAction,
  excluirEnvelopeAction,
  atualizarEmailAssinanteAction,
  reenviarAssinaturaAction,
  sincronizarEnvelopeAction,
} from "@/lib/assinaturas-actions";
import { TrashIcon, XMarkIcon, SpinnerIcon } from "@/components/icons";

export function EnvelopeAcoesTopo({
  envelopeId,
  status,
}: {
  envelopeId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"cancelar" | "excluir" | null>(
    null
  );
  const router = useRouter();

  const jaFinalizado = status === "concluido" || status === "cancelado";

  function handleCancelar() {
    setErro(null);
    startTransition(async () => {
      const r = await cancelarEnvelopeAction(envelopeId);
      if (r.error) {
        setErro(r.error);
        return;
      }
      setConfirmando(null);
      router.refresh();
    });
  }

  function handleExcluir() {
    setErro(null);
    startTransition(async () => {
      const r = await excluirEnvelopeAction(envelopeId);
      if (r.error) {
        setErro(r.error);
        return;
      }
      router.push("/dashboard/assinaturas");
    });
  }

  function handleVerificarStatus() {
    setErro(null);
    startTransition(async () => {
      const r = await sincronizarEnvelopeAction(envelopeId);
      if (r.error) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {!jaFinalizado && (
          <button
            type="button"
            onClick={handleVerificarStatus}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {pending && <SpinnerIcon className="h-3.5 w-3.5" />}
            Verificar status
          </button>
        )}
        {!jaFinalizado && (
          <button
            type="button"
            onClick={() => setConfirmando("cancelar")}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg transition-colors hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            Cancelar envelope
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmando("excluir")}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-red-600 transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          Excluir
        </button>
      </div>
      {erro && <p className="font-body text-xs text-red-600">{erro}</p>}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <p className="font-heading text-sm font-semibold text-fg">
              {confirmando === "cancelar"
                ? "Cancelar este envelope?"
                : "Excluir este envelope permanentemente?"}
            </p>
            <p className="mt-1.5 font-body text-xs text-muted">
              {confirmando === "cancelar"
                ? "O envelope fica marcado como cancelado, mas continua no histórico."
                : "Isso apaga o envelope, os documentos e os dados dos assinantes. Não tem como desfazer."}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                disabled={pending}
                className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={
                  confirmando === "cancelar" ? handleCancelar : handleExcluir
                }
                disabled={pending}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-xs font-semibold text-white disabled:opacity-50 ${
                  confirmando === "cancelar"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {pending && <SpinnerIcon className="h-3.5 w-3.5" />}
                {confirmando === "cancelar"
                  ? "Cancelar envelope"
                  : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EditarEmailAssinante({
  envelopeId,
  assinanteId,
  emailAtual,
}: {
  envelopeId: string;
  assinanteId: string;
  emailAtual: string;
}) {
  const [editando, setEditando] = useState(false);
  const [email, setEmail] = useState(emailAtual);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="font-body text-[11px] font-semibold text-primary hover:underline"
      >
        Editar e-mail
      </button>
    );
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const r = await atualizarEmailAssinanteAction(
        envelopeId,
        assinanteId,
        email
      );
      if (r.error) {
        setErro(r.error);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="h-7 w-48 rounded border border-border px-2 font-body text-xs outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSalvar}
          disabled={pending}
          className="rounded bg-primary px-2 py-1 font-body text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setEmail(emailAtual);
            setErro(null);
          }}
          disabled={pending}
          className="font-body text-[11px] text-muted hover:text-fg"
        >
          Cancelar
        </button>
      </div>
      {erro && <p className="font-body text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}

export function ReenviarAssinatura({
  envelopeId,
  assinanteId,
  erroAtual,
}: {
  envelopeId: string;
  assinanteId: string;
  erroAtual: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(erroAtual);
  const router = useRouter();

  function handleReenviar() {
    setErro(null);
    startTransition(async () => {
      const r = await reenviarAssinaturaAction(envelopeId, assinanteId);
      if (r.error) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {erro && <p className="font-body text-[11px] text-red-600">{erro}</p>}
      <button
        type="button"
        onClick={handleReenviar}
        disabled={pending}
        className="flex w-fit items-center gap-1.5 font-body text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
      >
        {pending && <SpinnerIcon className="h-3 w-3" />}
        {pending ? "Reenviando…" : "Reenviar link de assinatura"}
      </button>
    </div>
  );
}
