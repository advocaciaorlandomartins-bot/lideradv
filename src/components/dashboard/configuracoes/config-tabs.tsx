"use client";

import { useState } from "react";
import ConfigForm from "./config-form";
import ComissoesSection from "./comissoes-section";
import MensagensSection from "./mensagens-section";
import { CogIcon, PercentIcon, BellIcon } from "@/components/icons";
import type { EscritorioConfig } from "@/lib/escritorio-db";
import type { ComissaoConfig } from "@/lib/comissoes-config-db";
import type { MensagensConfig } from "@/config/mensagens";

type Tab = "escritorio" | "comissoes" | "mensagens";

interface TabMeta {
  key: Tab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  config: EscritorioConfig;
  comissoes: ComissaoConfig[];
  mensagensConfig: MensagensConfig;
}

const TABS: TabMeta[] = [
  {
    key: "escritorio",
    label: "Escritório",
    description: "Dados do escritório e documentos",
    icon: CogIcon,
  },
  {
    key: "comissoes",
    label: "Comissões e Bonificações",
    description: "Regras de comissão e bonificação",
    icon: PercentIcon,
  },
  {
    key: "mensagens",
    label: "Mensagens Automáticas",
    description: "Templates e intervalos de WhatsApp",
    icon: BellIcon,
  },
];

export default function ConfigTabs({
  config,
  comissoes,
  mensagensConfig,
}: Props) {
  const [tab, setTab] = useState<Tab>("escritorio");

  const activeMeta = TABS.find((t) => t.key === tab)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-4">
      {/* ── Tab cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 cursor-pointer ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary/10" : "bg-slate-100"}`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-primary" : "text-muted"}`}
                />
              </div>
              <div className="min-w-0">
                <p
                  className={`font-body text-sm font-semibold ${active ? "text-primary" : "text-fg"}`}
                >
                  {t.label}
                </p>
                <p className="font-body text-xs text-muted">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Panel ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex items-center gap-3 border-b border-border bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ActiveIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-fg">
              {activeMeta.label}
            </h2>
            <p className="font-body text-xs text-muted">
              {activeMeta.description}
            </p>
          </div>
        </div>

        {/* Panel body */}
        <div className="p-5">
          {tab === "escritorio" && (
            <div className="max-w-3xl">
              <ConfigForm config={config} />
            </div>
          )}
          {tab === "comissoes" && <ComissoesSection comissoes={comissoes} />}
          {tab === "mensagens" && (
            <MensagensSection initialConfig={mensagensConfig} />
          )}
        </div>
      </div>
    </div>
  );
}
