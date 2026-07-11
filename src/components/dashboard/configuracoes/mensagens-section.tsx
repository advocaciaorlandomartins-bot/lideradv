"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import type { MensagensConfig } from "@/config/mensagens";

interface Props {
  initialConfig: MensagensConfig;
}

const TOKENS = [
  { token: "{{nome}}", desc: "Primeiro nome" },
  { token: "{{escritorio}}", desc: "Nome do escritório" },
  { token: "{{servico}}", desc: "Tipo do serviço (perícia, avaliação...)" },
  { token: "{{diaSemana}}", desc: "Dia da semana" },
  { token: "{{data}}", desc: "Data (dd/mm/aaaa)" },
  { token: "{{hora}}", desc: "Horário (09:00)" },
  { token: "{{local}}", desc: "Local do atendimento" },
  { token: "{{link}}", desc: "Link da videochamada (Google Meet)" },
  { token: "{{valor}}", desc: "Valor em R$ (honorários)" },
  { token: "{{saldo}}", desc: "Saldo restante (honorários)" },
];

export default function MensagensSection({ initialConfig }: Props) {
  const [config, setConfig] = useState<MensagensConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof MensagensConfig>(
    key: K,
    val: MensagensConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/configuracoes/mensagens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erro ao salvar");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Legenda de tokens */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="mb-2 text-xs font-semibold text-amber-800">
          Variáveis disponíveis — use exatamente como mostrado abaixo:
        </p>
        <div className="flex flex-wrap gap-2">
          {TOKENS.map(({ token, desc }) => (
            <span
              key={token}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1"
            >
              <code className="font-mono text-xs font-bold text-amber-900">
                {token}
              </code>
              <span className="text-xs text-amber-700">— {desc}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-700">
          Formatação WhatsApp: <code className="font-mono">*negrito*</code>,{" "}
          <code className="font-mono">_itálico_</code>,{" "}
          <code className="font-mono">\n</code> = quebra de linha.
        </p>
      </div>

      {/* ── INSS ──────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            I
          </span>
          <h3 className="font-heading text-sm font-bold text-fg">
            Lembretes de Agendamento INSS / Perícias
          </h3>
        </div>

        {/* Intervalos INSS */}
        <div className="rounded-lg border border-border bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Quando enviar cada mensagem
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(
              [
                {
                  key: "inss_lembrete1_dias",
                  label: "1º lembrete",
                  suffix: "dias antes",
                },
                {
                  key: "inss_lembrete2_dias",
                  label: "2º lembrete",
                  suffix: "dias antes",
                },
                {
                  key: "inss_lembrete3_dias",
                  label: "3º lembrete",
                  suffix: "dias antes",
                },
                {
                  key: "inss_vespera_manha_hora",
                  label: "Véspera manhã",
                  suffix: "h",
                },
                {
                  key: "inss_vespera_tarde_hora",
                  label: "Véspera tarde",
                  suffix: "h",
                },
              ] as const
            ).map(({ key, label, suffix }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={suffix === "h" ? 23 : 365}
                    value={config[key] as number}
                    onChange={(e) => update(key, Number(e.target.value))}
                    className="w-16 rounded-md border border-border bg-white px-2 py-1.5 text-center text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates INSS */}
        {(
          [
            {
              key: "inss_lembrete1",
              title: "1º Lembrete",
              hint: () => `${config.inss_lembrete1_dias} dias antes`,
            },
            {
              key: "inss_lembrete2",
              title: "2º Lembrete",
              hint: () => `${config.inss_lembrete2_dias} dias antes`,
            },
            {
              key: "inss_lembrete3",
              title: "3º Lembrete",
              hint: () => `${config.inss_lembrete3_dias} dias antes`,
            },
            {
              key: "inss_vespera_manha",
              title: "Véspera — Manhã",
              hint: () => `${config.inss_vespera_manha_hora}h do dia anterior`,
            },
            {
              key: "inss_vespera_tarde",
              title: "Véspera — Tarde",
              hint: () => `${config.inss_vespera_tarde_hora}h do dia anterior`,
            },
          ] as const
        ).map(({ key, title, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-semibold text-fg">{title}</label>
              <span className="text-xs text-muted">enviado {hint()}</span>
            </div>
            <textarea
              rows={5}
              value={config[key] as string}
              onChange={(e) => update(key, e.target.value)}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </section>

      {/* ── Honorários ────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
            H
          </span>
          <h3 className="font-heading text-sm font-bold text-fg">
            Cobranças de Honorários
          </h3>
        </div>

        {/* Intervalos Honorários */}
        <div className="rounded-lg border border-border bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Quando enviar cada mensagem
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                {
                  key: "honorario_lembrete1_dias",
                  label: "1º aviso",
                  suffix: "dias antes",
                },
                {
                  key: "honorario_lembrete2_dias",
                  label: "2º aviso",
                  suffix: "dias antes",
                },
                {
                  key: "honorario_lembrete3_dias",
                  label: "3º aviso",
                  suffix: "dias antes",
                },
                {
                  key: "honorario_vencimento_hoje_hora",
                  label: "No vencimento",
                  suffix: "h",
                },
              ] as const
            ).map(({ key, label, suffix }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={suffix === "h" ? 23 : 365}
                    value={config[key] as number}
                    onChange={(e) => update(key, Number(e.target.value))}
                    className="w-16 rounded-md border border-border bg-white px-2 py-1.5 text-center text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates Honorários */}
        {(
          [
            {
              key: "honorario_lembrete1",
              title: "1º Aviso de Cobrança",
              hint: () =>
                `${config.honorario_lembrete1_dias} dias antes do vencimento`,
            },
            {
              key: "honorario_lembrete2",
              title: "2º Aviso de Cobrança",
              hint: () =>
                `${config.honorario_lembrete2_dias} dias antes do vencimento`,
            },
            {
              key: "honorario_lembrete3",
              title: "3º Aviso de Cobrança (véspera)",
              hint: () =>
                `${config.honorario_lembrete3_dias} dia antes do vencimento`,
            },
            {
              key: "honorario_vence_hoje",
              title: "Vencimento Hoje",
              hint: () =>
                `${config.honorario_vencimento_hoje_hora}h do dia do vencimento`,
            },
            {
              key: "honorario_pagamento_quitado",
              title: "Confirmação — Pagamento Quitado",
              hint: () => "enviado quando o pagamento total é registrado",
            },
            {
              key: "honorario_pagamento_parcial",
              title: "Confirmação — Pagamento Parcial",
              hint: () => "enviado quando ainda há saldo — usa {{saldo}}",
            },
          ] as const
        ).map(({ key, title, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-semibold text-fg">{title}</label>
              <span className="text-xs text-muted">{hint()}</span>
            </div>
            <textarea
              rows={4}
              value={config[key] as string}
              onChange={(e) => update(key, e.target.value)}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </section>

      {/* ── Videochamada ──────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
            V
          </span>
          <h3 className="font-heading text-sm font-bold text-fg">
            Videochamada / Google Meet
          </h3>
        </div>

        {/* Horários */}
        <div className="rounded-lg border border-border bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Horário dos lembretes automáticos
          </p>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                {
                  key: "videochamada_vespera_hora",
                  label: "Lembrete véspera",
                  suffix: "h",
                },
                {
                  key: "videochamada_dia_hora",
                  label: "Lembrete dia do evento",
                  suffix: "h",
                },
              ] as const
            ).map(({ key, label, suffix }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={config[key] as number}
                    onChange={(e) => update(key, Number(e.target.value))}
                    className="w-16 rounded-md border border-border bg-white px-2 py-1.5 text-center text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted">{suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates Google Meet */}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Mensagens — Google Meet (usa{" "}
          <code className="font-mono">{"{{link}}"}</code>)
        </p>
        {(
          [
            {
              key: "videochamada_convite",
              title: "Convite inicial",
              hint: () => "enviado imediatamente — usa {{link}}",
            },
            {
              key: "videochamada_vespera",
              title: "Lembrete véspera",
              hint: () =>
                `${config.videochamada_vespera_hora}h do dia anterior`,
            },
            {
              key: "videochamada_dia",
              title: "Lembrete dia do evento",
              hint: () => `${config.videochamada_dia_hora}h do dia da reunião`,
            },
          ] as const
        ).map(({ key, title, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-semibold text-fg">{title}</label>
              <span className="text-xs text-muted">{hint()}</span>
            </div>
            <textarea
              rows={5}
              value={config[key] as string}
              onChange={(e) => update(key, e.target.value)}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}

        {/* Templates Ligação WhatsApp */}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Mensagens — Ligação WhatsApp (sem link)
        </p>
        {(
          [
            {
              key: "wpp_call_convite",
              title: "Convite inicial",
              hint: () => "enviado imediatamente — avisa que você vai ligar",
            },
            {
              key: "wpp_call_vespera",
              title: "Lembrete véspera",
              hint: () =>
                `${config.videochamada_vespera_hora}h do dia anterior`,
            },
            {
              key: "wpp_call_dia",
              title: "Lembrete dia do evento",
              hint: () => `${config.videochamada_dia_hora}h do dia da reunião`,
            },
          ] as const
        ).map(({ key, title, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-semibold text-fg">{title}</label>
              <span className="text-xs text-muted">{hint()}</span>
            </div>
            <textarea
              rows={4}
              value={config[key] as string}
              onChange={(e) => update(key, e.target.value)}
              className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-fg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </section>

      {/* Feedback + Save */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckIcon className="h-4 w-4" />
            Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  );
}
