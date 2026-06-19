"use client";

import { useState, useEffect } from "react";
import type { AsaasConfig } from "@/app/api/integracoes/asaas/route";

interface EmailInboundStatus {
  domain: string;
  configured: boolean;
  webhookUrl: string;
}

interface SimpleStatus {
  configured: boolean;
}

// ── Status badge ──────────────────────────────────────────────────────────────

type Status = "configurado" | "nao_configurado" | "em_breve" | "conectado";

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    configurado: {
      label: "Configurado",
      cls: "bg-emerald-100 text-emerald-700",
    },
    conectado: { label: "Conectado", cls: "bg-emerald-100 text-emerald-700" },
    nao_configurado: {
      label: "Não configurado",
      cls: "bg-red-100 text-red-600",
    },
    em_breve: { label: "Em breve", cls: "bg-amber-100 text-amber-700" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`ml-2 inline-block rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

// ── Card de integração ────────────────────────────────────────────────────────

function IntegrationCard({
  logo,
  name,
  status,
  description,
  children,
}: {
  logo: React.ReactNode;
  name: string;
  status: Status;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-sm">
          {logo}
        </div>
        <div>
          <span className="font-heading text-base font-semibold text-fg">
            {name}
          </span>
          <StatusBadge status={status} />
        </div>
      </div>
      <p className="font-body text-sm text-muted leading-relaxed">
        {description}
      </p>
      {children}
    </div>
  );
}

// ── Modal Asaas ───────────────────────────────────────────────────────────────

function ModalAsaas({
  open,
  config,
  onClose,
  onSave,
}: {
  open: boolean;
  config: AsaasConfig | null;
  onClose: () => void;
  onSave: (data: {
    token: string;
    ambiente: string;
    juros: string;
    multa: string;
    gateway: boolean;
  }) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<string>(config?.ambiente ?? "prod");
  const [juros, setJuros] = useState<string>(config?.juros ?? "");
  const [multa, setMulta] = useState<string>(config?.multa ?? "");
  const [gateway, setGateway] = useState<boolean>(config?.gateway ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ token, ambiente, juros, multa, gateway });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50 text-yellow-700 font-heading text-lg font-bold border border-yellow-200">
              A
            </div>
            <div>
              <p className="font-heading text-base font-semibold text-fg">
                Configurar Asaas
              </p>
              <p className="font-body text-xs text-muted">
                Token · ambiente · juros e multa padrão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-fg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            {/* Token */}
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Token do Asaas
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  config?.temToken
                    ? "••••••••••• (token já salvo)"
                    : "Cole aqui o token do Asaas"
                }
                className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1.5 font-body text-xs text-muted">
                O token é armazenado de forma segura. Se deixar em branco, o
                token atual é mantido.
              </p>
            </div>

            {/* Ambiente */}
            <div>
              <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                Ambiente{" "}
                <span className="font-normal">(de acordo com o token)</span>
              </label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
              >
                <option value="prod">Produção (Normal)</option>
                <option value="sandbox">Sandbox (Testes)</option>
              </select>
            </div>

            {/* Juros e Multa */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                  Juros padrão (% ao mês)
                </label>
                <input
                  type="text"
                  value={juros}
                  onChange={(e) => setJuros(e.target.value)}
                  placeholder="Ex.: 1.99"
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-body text-xs font-semibold text-muted">
                  Multa padrão (%)
                </label>
                <input
                  type="text"
                  value={multa}
                  onChange={(e) => setMulta(e.target.value)}
                  placeholder="Ex.: 2"
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Gateway padrão */}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100">
              <input
                type="checkbox"
                checked={gateway}
                onChange={(e) => setGateway(e.target.checked)}
                className="accent-primary"
              />
              <span className="font-body text-sm text-fg">
                Definir Asaas como gateway de cobrança padrão
              </span>
            </label>

            {/* Info box */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <ul className="space-y-2 font-body text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>
                    Formas disponíveis:{" "}
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      PIX
                    </span>{" "}
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      Boleto
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>
                    Você ainda poderá confirmar pagamentos manualmente (ex.:
                    recebido em mãos).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>
                    <strong>Custos do Asaas:</strong> podem variar conforme o
                    seu plano diretamente no Asaas.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-primary">•</span>
                  <span>
                    Notificações automáticas ao cliente estarão{" "}
                    <strong>desativadas</strong> por padrão.
                  </span>
                </li>
              </ul>
              <p className="mt-2 font-body text-[11px] text-slate-500">
                Comunicações automáticas e negativação devem ser configuradas
                diretamente no Asaas.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`rounded-lg px-4 py-2 font-body text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                saved ? "bg-emerald-600" : "bg-primary hover:bg-primary-dark"
              }`}
            >
              {saving
                ? "Salvando…"
                : saved
                  ? "✓ Salvo!"
                  : "Salvar configuração"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Logos SVG ─────────────────────────────────────────────────────────────────

function LogoAsaas() {
  return (
    <span className="font-heading text-lg font-extrabold text-yellow-600">
      A
    </span>
  );
}

function LogoGoogle() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function LogoTramitaSign() {
  return (
    <span className="font-heading text-lg font-extrabold text-blue-700">
      TS
    </span>
  );
}

function LogoAnthropic() {
  return (
    <span className="font-heading text-lg font-extrabold text-slate-800">
      ◆
    </span>
  );
}

function LogoResend() {
  return (
    <span className="font-heading text-lg font-extrabold text-slate-800">
      R
    </span>
  );
}

// ── Card Anthropic ────────────────────────────────────────────────────────────

function AnthropicCard({ status }: { status: SimpleStatus | null }) {
  const [open, setOpen] = useState(false);
  const configured = status?.configured ?? false;

  return (
    <IntegrationCard
      logo={<LogoAnthropic />}
      name="Anthropic (Claude)"
      status={configured ? "configurado" : "nao_configurado"}
      description="Usado para importar dados de documentos (RG, CPF, CNH) via IA e gerar resumos automáticos de e-mails recebidos dos clientes."
    >
      <div className="space-y-3">
        {configured ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="font-body text-xs font-semibold text-emerald-700">
              API Key configurada — IA ativa
            </p>
          </div>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {open ? "Ocultar instruções" : "Como ativar"}
          </button>
        )}

        {!configured && open && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <p className="font-heading text-sm font-semibold text-primary">
              Adicionar ANTHROPIC_API_KEY no Vercel
            </p>
            <ol className="space-y-3 font-body text-xs text-slate-700">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  Acesse <strong>console.anthropic.com</strong> → API Keys →
                  crie uma nova chave.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  2
                </span>
                <span>
                  No painel do <strong>Vercel</strong> (Settings → Environment
                  Variables) adicione:
                  <div className="mt-1.5 rounded bg-slate-100 px-2 py-1">
                    <code className="text-[11px] font-semibold text-primary">
                      ANTHROPIC_API_KEY
                    </code>
                    <span className="text-slate-400 mx-1">=</span>
                    <code className="text-[11px] text-slate-700">
                      sk-ant-...
                    </code>
                  </div>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  3
                </span>
                <span>
                  Clique em <strong>Redeploy</strong> no Vercel. Pronto — IA
                  ativada!
                </span>
              </li>
            </ol>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 font-body text-[11px] text-emerald-700">
              <strong>Funcionalidades ativadas:</strong> importação de
              documentos de clientes (RG, CPF, CNH) por foto/PDF e resumo
              automático de e-mails por IA.
            </div>
          </div>
        )}
      </div>
    </IntegrationCard>
  );
}

// ── Card Resend ───────────────────────────────────────────────────────────────

function ResendCard({ status }: { status: SimpleStatus | null }) {
  const [open, setOpen] = useState(false);
  const configured = status?.configured ?? false;

  return (
    <IntegrationCard
      logo={<LogoResend />}
      name="Resend (Envio de E-mail)"
      status={configured ? "configurado" : "nao_configurado"}
      description="Envia notificações automáticas para o e-mail do escritório sempre que um cliente enviar um e-mail exclusivo, incluindo resumo gerado por IA."
    >
      <div className="space-y-3">
        {configured ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="font-body text-xs font-semibold text-emerald-700">
              Notificações ativas — e-mails sendo encaminhados
            </p>
          </div>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {open ? "Ocultar instruções" : "Como ativar"}
          </button>
        )}

        {!configured && open && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
            <p className="font-heading text-sm font-semibold text-primary">
              Configurar Resend (gratuito — 3.000 e-mails/mês)
            </p>
            <ol className="space-y-3 font-body text-xs text-slate-700">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  Acesse <strong>resend.com</strong> → crie uma conta gratuita
                  com o e-mail do escritório.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  2
                </span>
                <span>
                  Em <strong>API Keys</strong> → crie uma chave → copie.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  3
                </span>
                <span>
                  No painel do <strong>Vercel</strong> (Settings → Environment
                  Variables) adicione:
                  <div className="mt-1.5 rounded bg-slate-100 px-2 py-1">
                    <code className="text-[11px] font-semibold text-primary">
                      RESEND_API_KEY
                    </code>
                    <span className="text-slate-400 mx-1">=</span>
                    <code className="text-[11px] text-slate-700">re_...</code>
                  </div>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  4
                </span>
                <span>
                  Clique em <strong>Redeploy</strong> no Vercel. Pronto!
                </span>
              </li>
            </ol>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 font-body text-[11px] text-amber-700">
              <strong>Importante:</strong> as notificações chegam no e-mail
              cadastrado em{" "}
              <strong>Configurações → E-mail do escritório</strong>.
              Certifique-se de que está preenchido.
            </div>
          </div>
        )}
      </div>
    </IntegrationCard>
  );
}

function LogoEmail() {
  return (
    <svg
      className="h-6 w-6 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

// ── Card Email Inbound ────────────────────────────────────────────────────────

function EmailInboundCard({ status }: { status: EmailInboundStatus | null }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  function copyWebhook() {
    if (!status?.webhookUrl) return;
    navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const configured = status?.configured ?? false;
  const cardStatus: Status = configured ? "configurado" : "nao_configurado";

  return (
    <IntegrationCard
      logo={<LogoEmail />}
      name="E-mail Exclusivo (Mailgun)"
      status={cardStatus}
      description="Cada cliente recebe um endereço de e-mail exclusivo. Mensagens enviadas a esse endereço chegam automaticamente na ficha do cliente."
    >
      <div className="space-y-3">
        {configured ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="font-body text-xs font-semibold text-emerald-700">
              Domínio configurado:{" "}
              <span className="font-mono">{status?.domain}</span>
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 font-body text-xs text-amber-700">
            Configure o{" "}
            <code className="rounded bg-amber-100 px-1">
              INBOUND_EMAIL_DOMAIN
            </code>{" "}
            no Vercel para ativar.
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {open ? "Ocultar instruções" : "Ver como configurar"}
        </button>

        {open && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-4">
            <p className="font-heading text-sm font-semibold text-primary">
              Passo a passo — Mailgun (gratuito, sem precisar de domínio
              próprio)
            </p>

            <ol className="space-y-3 font-body text-xs text-slate-700">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  Acesse <strong>mailgun.com</strong> → crie uma conta gratuita.
                  Ao entrar, copie o seu <strong>Sandbox Domain</strong> (ex.:{" "}
                  <code className="rounded bg-blue-100 px-1">
                    sandboxABC123.mailgun.org
                  </code>
                  ).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  2
                </span>
                <span>
                  No Mailgun, vá em{" "}
                  <strong>Receiving → Routes → Create a Route</strong>. Em{" "}
                  <em>Expression Type</em> escolha <strong>Catch All</strong>.
                  Em <em>Actions</em> escolha <strong>Forward</strong> e cole o
                  URL abaixo:
                </span>
              </li>
            </ol>

            {/* Webhook URL */}
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2">
              <code className="flex-1 font-mono text-[11px] text-slate-800 break-all">
                {status?.webhookUrl ??
                  "https://lideradv.vercel.app/api/webhooks/inbound-email"}
              </code>
              <button
                onClick={copyWebhook}
                className="flex-shrink-0 rounded-lg border border-border px-2.5 py-1 font-body text-xs font-semibold text-primary transition-colors hover:bg-blue-50"
              >
                {copied ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>

            <ol
              className="space-y-3 font-body text-xs text-slate-700"
              start={3}
            >
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  3
                </span>
                <span>
                  No painel do <strong>Vercel</strong> (Settings → Environment
                  Variables), adicione:
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1">
                      <code className="text-[11px] font-semibold text-primary">
                        INBOUND_EMAIL_DOMAIN
                      </code>
                      <span className="text-slate-400">=</span>
                      <code className="text-[11px] text-slate-700">
                        sandboxABC123.mailgun.org
                      </code>
                    </div>
                  </div>
                  <span className="text-slate-500">
                    (substitua pelo seu sandbox domain real)
                  </span>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  4
                </span>
                <span>
                  No Vercel clique em <strong>Redeploy</strong> para aplicar a
                  variável. Pronto! Cada cliente poderá ter um e-mail como{" "}
                  <code className="rounded bg-blue-100 px-1">
                    joao2026@sandboxABC123.mailgun.org
                  </code>
                  .
                </span>
              </li>
            </ol>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 font-body text-[11px] text-emerald-700">
              <strong>Domínio próprio (opcional):</strong> se quiser e-mails
              como{" "}
              <code className="rounded bg-emerald-100 px-1">
                joao@seuescritorio.com.br
              </code>
              , adicione o domínio no Mailgun e configure os registros MX
              apontando para o Mailgun. Depois troque o{" "}
              <code className="rounded bg-emerald-100 px-1">
                INBOUND_EMAIL_DOMAIN
              </code>{" "}
              no Vercel.
            </div>
          </div>
        )}
      </div>
    </IntegrationCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
}

export default function IntegracoesContent() {
  const [asaasConfig, setAsaasConfig] = useState<AsaasConfig | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailInboundStatus | null>(
    null
  );
  const [anthropicStatus, setAnthropicStatus] = useState<SimpleStatus | null>(
    null
  );
  const [resendStatus, setResendStatus] = useState<SimpleStatus | null>(null);
  const [modalAsaasOpen, setModalAsaasOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/integracoes/asaas")
      .then((r) => r.json())
      .then(setAsaasConfig)
      .catch(() => null);

    fetch("/api/agenda/google/status")
      .then((r) => r.json())
      .then(setGoogleStatus)
      .catch(() =>
        setGoogleStatus({ connected: false, configured: false, email: null })
      );

    fetch("/api/integracoes/email-inbound")
      .then((r) => r.json())
      .then(setEmailStatus)
      .catch(() => null);

    fetch("/api/integracoes/anthropic")
      .then((r) => r.json())
      .then(setAnthropicStatus)
      .catch(() => null);

    fetch("/api/integracoes/resend")
      .then((r) => r.json())
      .then(setResendStatus)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function handleSaveAsaas(
    data: Parameters<typeof ModalAsaas>[0]["onSave"] extends (
      d: infer D
    ) => unknown
      ? D
      : never
  ) {
    await fetch("/api/integracoes/asaas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await fetch("/api/integracoes/asaas").then((r) => r.json());
    setAsaasConfig(updated);
    setMsg({ type: "ok", text: "Configuração do Asaas salva com sucesso!" });
  }

  async function handleGoogleDisconnect() {
    setGoogleLoading(true);
    await fetch("/api/agenda/google/disconnect", { method: "POST" });
    setGoogleStatus((s) => (s ? { ...s, connected: false, email: null } : s));
    setGoogleLoading(false);
    setMsg({ type: "ok", text: "Google Calendar desconectado." });
  }

  const asaasStatus: Status = asaasConfig?.temToken
    ? "configurado"
    : "nao_configurado";
  const googleCalStatus: Status = !googleStatus?.configured
    ? "em_breve"
    : googleStatus?.connected
      ? "conectado"
      : "nao_configurado";

  return (
    <div className="space-y-6">
      {/* Msg flash */}
      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 font-body text-sm font-semibold ${
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {/* ── Asaas ── */}
        <IntegrationCard
          logo={<LogoAsaas />}
          name="Asaas"
          status={asaasStatus}
          description="Emita cobranças por PIX e boleto diretamente pelo sistema. Acompanhe status de pagamentos sem retrabalho."
        >
          <button
            onClick={() => setModalAsaasOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {asaasConfig?.temToken ? "Editar configuração" : "Configurar"}
          </button>
        </IntegrationCard>

        {/* ── Google Calendar ── */}
        <IntegrationCard
          logo={<LogoGoogle />}
          name="Google Calendar"
          status={googleCalStatus}
          description="Sincronize sua agenda do Google com o sistema. Os eventos aparecem diretamente no calendário integrado."
        >
          {!googleStatus?.configured ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 font-body text-xs text-amber-700">
              Configure{" "}
              <code className="rounded bg-amber-100 px-1">
                GOOGLE_CLIENT_ID
              </code>{" "}
              e{" "}
              <code className="rounded bg-amber-100 px-1">
                GOOGLE_CLIENT_SECRET
              </code>{" "}
              no <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
              para ativar.
            </div>
          ) : googleStatus.connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="font-body text-xs font-semibold text-emerald-700">
                  Conectado
                  {googleStatus.email ? ` — ${googleStatus.email}` : ""}
                </p>
              </div>
              <button
                onClick={handleGoogleDisconnect}
                disabled={googleLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-body text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                {googleLoading ? "Desconectando…" : "Desconectar"}
              </button>
            </div>
          ) : (
            <a
              href="/api/agenda/google/auth"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-body text-sm font-semibold text-fg shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <LogoGoogle />
              Conectar Google Calendar
            </a>
          )}
        </IntegrationCard>

        {/* ── E-mail Exclusivo ── */}
        <EmailInboundCard status={emailStatus} />

        {/* ── Anthropic ── */}
        <AnthropicCard status={anthropicStatus} />

        {/* ── Resend ── */}
        <ResendCard status={resendStatus} />

        {/* ── TramitaSign ── */}
        <IntegrationCard
          logo={<LogoTramitaSign />}
          name="TramitaSign"
          status={
            typeof window === "undefined"
              ? "em_breve"
              : process.env.NEXT_PUBLIC_TRAMITASIGN_ATIVO === "true"
                ? "conectado"
                : "em_breve"
          }
          description="Assinaturas digitais com validade jurídica via tramitacaointeligente.com.br. Clientes assinam pelo WhatsApp ou e-mail."
        >
          <a
            href="https://planilha.tramitacaointeligente.com.br/assinaturas"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-body text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
          >
            Acessar painel
          </a>
        </IntegrationCard>
      </div>

      {/* Modal Asaas — key força remount quando config muda, evitando setState em effect */}
      <ModalAsaas
        key={
          asaasConfig
            ? `${asaasConfig.ambiente}-${asaasConfig.temToken}`
            : "empty"
        }
        open={modalAsaasOpen}
        config={asaasConfig}
        onClose={() => setModalAsaasOpen(false)}
        onSave={handleSaveAsaas}
      />
    </div>
  );
}
