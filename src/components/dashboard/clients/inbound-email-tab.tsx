"use client";

import { useState, useTransition } from "react";
import type {
  InboundEmailAddress,
  InboundEmail,
} from "@/lib/inbound-emails-db";
import {
  MailIcon,
  InboxArrowDownIcon,
  ClipboardCopyIcon,
  CheckIcon,
  SparklesIcon,
  CheckCircleIcon,
} from "@/components/icons";
import {
  gerarEnderecoAction,
  marcarLidoAction,
} from "@/lib/inbound-email-actions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return s;
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar endereço"
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-emerald-600" />
      ) : (
        <ClipboardCopyIcon className="h-4 w-4" />
      )}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

// ── Email card ────────────────────────────────────────────────────────────────

function EmailCard({
  email,
  clientId,
  onRead,
}: {
  email: InboundEmail;
  clientId: string;
  onRead: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleOpen() {
    setOpen((v) => !v);
    if (!email.lida) {
      startTransition(async () => {
        await marcarLidoAction(email.id, clientId);
        onRead(email.id);
      });
    }
  }

  return (
    <div
      className={`rounded-xl border transition-colors ${
        email.lida ? "border-border bg-white" : "border-primary/30 bg-primary/5"
      }`}
    >
      <button
        onClick={handleOpen}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-body text-sm font-semibold text-fg">
              {email.subject || "(sem assunto)"}
            </p>
            {!email.lida && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            )}
          </div>
          <p className="font-body text-xs text-muted">
            {email.from_name
              ? `${email.from_name} <${email.from_address}>`
              : email.from_address}
          </p>
        </div>
        <p className="flex-shrink-0 font-body text-xs text-muted">
          {formatDate(email.received_at)}
        </p>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {email.ai_summary && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
              <p className="mb-1 font-body text-[10px] font-bold uppercase tracking-wider text-blue-500">
                ✨ Resumo IA
              </p>
              <p className="font-body text-sm leading-relaxed text-blue-900">
                {email.ai_summary}
              </p>
            </div>
          )}
          <div>
            {email.body_html ? (
              <div
                className="prose prose-sm max-w-none font-body text-sm text-fg"
                dangerouslySetInnerHTML={{ __html: email.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-body text-sm text-fg">
                {email.body_text || "(sem conteúdo)"}
              </pre>
            )}
          </div>

          {email.attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                Anexos
              </p>
              {email.attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2"
                >
                  <MailIcon className="h-3.5 w-3.5 text-muted" />
                  <span className="font-body text-xs text-fg">
                    {att.filename}
                  </span>
                  {att.size > 0 && (
                    <span className="ml-auto font-body text-xs text-muted">
                      {(att.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName: string;
  address: InboundEmailAddress | null;
  emails: InboundEmail[];
}

export default function InboundEmailTab({
  clientId,
  clientName,
  address: initialAddress,
  emails: initialEmails,
}: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [emails, setEmails] = useState(initialEmails);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const domain = process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN ?? "timails.org";
  const naoLidos = emails.filter((e) => !e.lida).length;

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await gerarEnderecoAction(clientId);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        // Recarregar dados do endereço via fetch
        const res = await fetch(`/api/clientes/${clientId}/emails/address`);
        if (res.ok) {
          const data = await res.json();
          setAddress(data.address);
        }
      }
    });
  }

  function handleRead(emailId: string) {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, lida: true } : e))
    );
  }

  return (
    <div className="space-y-4">
      {/* Address card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <InboxArrowDownIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-semibold text-fg">
              E-mail exclusivo do cliente
            </h3>
            <p className="mt-0.5 font-body text-sm text-muted">
              Endereço único vinculado permanentemente a{" "}
              <span className="font-semibold text-fg">{clientName}</span>.
              Qualquer e-mail enviado para este endereço aparece aqui
              automaticamente.
            </p>
          </div>
        </div>

        {address ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="font-mono text-sm font-semibold text-fg break-all">
                  {address.address}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={address.address} />
                <a
                  href={`mailto:${address.address}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                >
                  <MailIcon className="h-4 w-4" />
                  Enviar
                </a>
              </div>
            </div>
            <p className="mt-2 font-body text-xs text-emerald-700">
              Criado em {address.created_at} · Domain: @{domain}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 font-body text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <SparklesIcon className="h-4 w-4" />
              {isPending ? "Gerando..." : "Gerar e-mail exclusivo"}
            </button>
            <p className="mt-2 font-body text-xs text-muted">
              Formato: {clientName.split(" ")[0].toLowerCase()}
              {new Date().getFullYear()}@{domain}
            </p>
          </div>
        )}
      </div>

      {/* Info box: como funciona */}
      {!address && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-body text-sm font-semibold text-blue-800 mb-2">
            Como funciona?
          </p>
          <ol className="list-decimal list-inside space-y-1 font-body text-sm text-blue-700">
            <li>Gere o endereço exclusivo deste cliente</li>
            <li>
              Configure seu provedor de e-mail inbound (Mailgun, SendGrid,
              Postmark)
            </li>
            <li>
              Configure o webhook para:{" "}
              <code className="font-mono text-xs">
                /api/webhooks/inbound-email
              </code>
            </li>
            <li>
              Todos os e-mails recebidos aparecem aqui e nos arquivos do cliente
            </li>
          </ol>
        </div>
      )}

      {/* Email inbox */}
      {address && (
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <InboxArrowDownIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-fg">
                  Caixa de entrada
                  {naoLidos > 0 && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      {naoLidos} novo{naoLidos > 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
                <p className="font-body text-xs text-muted">
                  {emails.length} e-mail{emails.length !== 1 ? "s" : ""}{" "}
                  recebido{emails.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {emails.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <InboxArrowDownIcon className="h-10 w-10 text-slate-300" />
              <p className="font-body text-sm font-semibold text-muted">
                Nenhum e-mail recebido ainda
              </p>
              <p className="font-body text-xs text-muted max-w-xs">
                Quando alguém enviar um e-mail para{" "}
                <span className="font-mono font-semibold text-fg">
                  {address.address}
                </span>
                , ele aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {emails.map((email) => (
                <div key={email.id} className="p-3">
                  <EmailCard
                    email={email}
                    clientId={clientId}
                    onRead={handleRead}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
