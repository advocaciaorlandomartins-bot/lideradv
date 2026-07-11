"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SpinnerIcon } from "@/components/icons";

interface Props {
  clienteId: string;
  clienteNome: string;
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"
      />
    </svg>
  );
}

type TipoReuniao = "meet" | "whatsapp";

const TIPOS: { key: TipoReuniao; icon: string; label: string; desc: string }[] =
  [
    {
      key: "meet",
      icon: "📹",
      label: "Google Meet",
      desc: "Envia link — cliente acessa pelo navegador",
    },
    {
      key: "whatsapp",
      icon: "📱",
      label: "Ligação WhatsApp",
      desc: "Você liga para o cliente — ideal para quem não usa Meet",
    },
  ];

export default function AgendarVideochamadaButton({
  clienteId,
  clienteNome,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tipoReuniao, setTipoReuniao] = useState<TipoReuniao>("meet");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const primeiroNome = clienteNome.split(" ")[0];

  function handleOpen() {
    setOpen(true);
    setDone(false);
    setError(null);
    setTipoReuniao("meet");
    setTitulo("");
    setData("");
    setHora("");
    setLink("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!data || !hora) {
      setError("Preencha data e hora da reunião.");
      return;
    }
    if (tipoReuniao === "meet" && !link) {
      setError("Informe o link do Google Meet.");
      return;
    }
    if (tipoReuniao === "meet" && !link.startsWith("http")) {
      setError("O link deve ser uma URL válida (https://meet.google.com/…)");
      return;
    }

    const tituloFinal =
      titulo.trim() ||
      (tipoReuniao === "meet"
        ? `Reunião com ${primeiroNome}`
        : `Ligação WhatsApp com ${primeiroNome}`);

    startTransition(async () => {
      const res = await fetch("/api/agenda/videochamada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          titulo: tituloFinal,
          data,
          hora,
          link: tipoReuniao === "meet" ? link : undefined,
          tipoReuniao,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Erro ao agendar");
        return;
      }
      setDone(true);
      router.refresh();
      setTimeout(() => setOpen(false), 2500);
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "block mb-1 font-body text-xs font-semibold text-muted";

  const isMeet = tipoReuniao === "meet";

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 font-body text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 cursor-pointer"
      >
        <VideoIcon className="h-4 w-4" />
        Agendar Reunião
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isPending && setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-6 py-4">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${isMeet ? "bg-violet-100" : "bg-green-100"}`}
              >
                <VideoIcon
                  className={`h-5 w-5 ${isMeet ? "text-violet-700" : "text-green-700"}`}
                />
              </div>
              <div>
                <h2 className="font-heading text-sm font-bold text-fg">
                  Agendar Reunião — {primeiroNome}
                </h2>
                <p className="font-body text-xs text-muted">
                  O cliente receberá aviso via WhatsApp
                </p>
              </div>
            </div>

            {/* Body */}
            {done ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="font-heading text-base font-semibold text-fg">
                  Reunião agendada!
                </p>
                <p className="font-body text-sm text-muted text-center">
                  WhatsApp enviado para {primeiroNome}. Lembretes de véspera e
                  dia do evento agendados automaticamente.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                {/* Tipo de reunião */}
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTipoReuniao(t.key)}
                      className={`flex flex-col items-start rounded-xl border-2 px-3 py-3 text-left transition-all cursor-pointer ${
                        tipoReuniao === t.key
                          ? t.key === "meet"
                            ? "border-violet-400 bg-violet-50"
                            : "border-green-400 bg-green-50"
                          : "border-border hover:border-slate-300"
                      }`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span
                        className={`mt-1 font-body text-xs font-bold ${
                          tipoReuniao === t.key
                            ? t.key === "meet"
                              ? "text-violet-700"
                              : "text-green-700"
                            : "text-fg"
                        }`}
                      >
                        {t.label}
                      </span>
                      <span className="mt-0.5 font-body text-[11px] text-muted leading-snug">
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className={labelCls}>Título</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder={
                      isMeet
                        ? `Reunião com ${primeiroNome}`
                        : `Ligação WhatsApp com ${primeiroNome}`
                    }
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Data *</label>
                    <input
                      type="date"
                      required
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Hora *</label>
                    <input
                      type="time"
                      required
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {isMeet && (
                  <div>
                    <label className={labelCls}>Link do Google Meet *</label>
                    <input
                      type="url"
                      required
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      className={inputCls}
                    />
                  </div>
                )}

                <div
                  className={`rounded-lg border px-4 py-3 ${
                    isMeet
                      ? "bg-violet-50 border-violet-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <p
                    className={`font-body text-xs ${isMeet ? "text-violet-700" : "text-green-700"}`}
                  >
                    {isMeet ? "📹" : "📱"} O sistema enviará ao cliente:
                    <br />• <strong>Agora</strong> —{" "}
                    {isMeet
                      ? "convite com data, hora e link + pedido de confirmação"
                      : "aviso que você vai ligar + pedido de confirmação"}
                    <br />• <strong>Véspera (tarde)</strong> — lembrete
                    <br />• <strong>Dia do evento (manhã)</strong> — aviso final
                    {!isMeet && (
                      <>
                        <br />
                        <br />
                        ⚠️ <strong>Lembre-se:</strong> você deverá ligar para o
                        cliente pelo WhatsApp na hora marcada.
                      </>
                    )}
                  </p>
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 font-body text-sm text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-fg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className={`flex items-center gap-2 rounded-lg px-5 py-2 font-body text-sm font-semibold text-white disabled:opacity-60 cursor-pointer ${
                      isMeet
                        ? "bg-violet-600 hover:bg-violet-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {isPending && <SpinnerIcon className="h-4 w-4" />}
                    {isPending ? "Agendando..." : "Agendar e Enviar WhatsApp"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
