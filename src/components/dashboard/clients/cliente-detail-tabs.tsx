"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client } from "@/lib/clients-db";
import type { Processo } from "@/lib/processos-db";
import type { ClientDebito } from "@/lib/lancamentos-db";
import type { Documento } from "@/lib/documents-db";
import type {
  InboundEmailAddress,
  InboundEmail,
} from "@/lib/inbound-emails-db";
import {
  FolderOpenIcon,
  BanknotesIcon,
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  UsersIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  AlertIcon,
  PlusIcon,
  ArrowRightIcon,
  InboxArrowDownIcon,
} from "@/components/icons";
import ClientDebitsSection from "./client-debits-section";
import DocumentsSection from "../documents/documents-section";
import GerarDocumentoButton from "./gerar-documento-button";
import InboundEmailTab from "./inbound-email-tab";

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Tab = "geral" | "processos" | "financeiro" | "documentos" | "email";

const TABS: {
  key: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "geral", label: "Visão Geral", icon: UsersIcon },
  { key: "processos", label: "Processos", icon: FolderOpenIcon },
  { key: "financeiro", label: "Financeiro", icon: BanknotesIcon },
  { key: "documentos", label: "Documentos", icon: DocumentTextIcon },
  { key: "email", label: "E-mail Exclusivo", icon: InboxArrowDownIcon },
];

// ── Process status badge ──────────────────────────────────────

function ProcessStatusBadge({ status }: { status: Processo["status"] }) {
  const map: Record<string, string> = {
    ativo: "bg-emerald-50 text-emerald-700",
    em_andamento: "bg-blue-50 text-blue-700",
    arquivado: "bg-amber-50 text-amber-700",
    encerrado: "bg-slate-100 text-slate-500",
  };
  const labels: Record<string, string> = {
    ativo: "Ativo",
    em_andamento: "Em andamento",
    arquivado: "Arquivado",
    encerrado: "Encerrado",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-500"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

// ── InfoRow ───────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-muted mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="mt-0.5 font-body text-sm text-fg break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  client: Client;
  processes: Processo[];
  debito: ClientDebito;
  documentos: Documento[];
  inboundAddress: InboundEmailAddress | null;
  inboundEmails: InboundEmail[];
  initialTab?: Tab;
}

export default function ClienteDetailTabs({
  client,
  processes,
  debito,
  documentos,
  inboundAddress,
  inboundEmails,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "geral");
  const naoLidos = inboundEmails.filter((e) => !e.lida).length;

  const activeProcesses = processes.filter(
    (p) => p.status === "ativo" || p.status === "em_andamento"
  );
  const valorTotal = processes.reduce((s, p) => s + (p.valor_causa ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          let badge = 0;
          if (key === "processos") badge = processes.length;
          if (key === "documentos") badge = documentos.length;

          const emailBadge = key === "email" && naoLidos > 0 ? naoLidos : 0;

          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-body text-sm font-semibold transition-all duration-150 ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-slate-50 hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {(badge > 0 || emailBadge > 0) && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${active ? "bg-white/20" : emailBadge > 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {badge > 0 ? badge : emailBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "geral" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* KPI cards */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: FolderOpenIcon,
                  label: "Processos",
                  value: String(processes.length),
                  sub: `${activeProcesses.length} ativos`,
                  color: "text-primary",
                  bg: "bg-primary/5",
                  tab: "processos",
                },
                {
                  icon: BanknotesIcon,
                  label: "Valor total em causa",
                  value: valorTotal > 0 ? formatCurrency(valorTotal) : "—",
                  sub: `${processes.filter((p) => p.valor_causa).length} com valor`,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  tab: "processos",
                },
                {
                  icon: AlertIcon,
                  label: "Débito pendente",
                  value:
                    debito.totalPendente > 0
                      ? formatCurrency(debito.totalPendente)
                      : "Quitado",
                  sub:
                    debito.totalPendente > 0 ? "Em aberto" : "Sem pendências",
                  color:
                    debito.totalPendente > 0
                      ? "text-red-600"
                      : "text-emerald-600",
                  bg: debito.totalPendente > 0 ? "bg-red-50" : "bg-emerald-50",
                  tab: "financeiro",
                },
                {
                  icon: DocumentTextIcon,
                  label: "Documentos",
                  value: String(documentos.length),
                  sub: "arquivos",
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                  tab: "documentos",
                },
              ].map(
                ({
                  icon: Icon,
                  label,
                  value,
                  sub,
                  color,
                  bg,
                  tab: targetTab,
                }) => (
                  <button
                    key={label}
                    onClick={() => setTab(targetTab as Tab)}
                    className={`rounded-xl border border-border ${bg} px-4 py-4 text-left w-full transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                        {label}
                      </p>
                    </div>
                    <p className={`font-heading text-xl font-bold ${color}`}>
                      {value}
                    </p>
                    <p className="font-body text-xs text-muted">{sub}</p>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="font-heading text-sm font-bold text-fg mb-4">
              Informações de contato
            </h3>
            <div className="space-y-4">
              <InfoRow icon={MailIcon} label="E-mail" value={client.email} />
              <InfoRow icon={PhoneIcon} label="Telefone" value={client.phone} />
              <InfoRow
                icon={MapPinIcon}
                label="Cidade/UF"
                value={`${client.city} — ${client.state}`}
              />
              <InfoRow icon={UsersIcon} label="Documento" value={client.doc} />
              <InfoRow
                icon={CalendarIcon}
                label="Cliente desde"
                value={client.since}
              />
            </div>

            {/* Quick actions */}
            <div className="mt-6 flex flex-col gap-2">
              <a
                href={`mailto:${client.email}`}
                className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
              >
                <MailIcon className="h-4 w-4" />
                Enviar e-mail
              </a>
              <a
                href={`tel:${client.phone.replace(/\D/g, "")}`}
                className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
              >
                <PhoneIcon className="h-4 w-4" />
                Ligar
              </a>
            </div>
          </div>

          {/* Recent processes preview */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm font-bold text-fg">
                Processos recentes
              </h3>
              <button
                onClick={() => setTab("processos")}
                className="flex items-center gap-1 font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todos
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {processes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FolderOpenIcon className="h-8 w-8 text-slate-300" />
                <p className="font-body text-sm text-muted">Nenhum processo</p>
                <Link
                  href={`/dashboard/processos/novo?cliente=${client.id}&back=${encodeURIComponent(`/dashboard/clientes/${client.id}?tab=processos`)}`}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-cta px-3 py-1.5 font-body text-xs font-semibold text-white hover:bg-cta-hover"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Adicionar
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {processes.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/processos/${p.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        {p.numero && (
                          <p className="font-mono text-xs text-muted">
                            {p.numero}
                          </p>
                        )}
                        <p className="font-body text-sm font-semibold text-fg truncate">
                          {p.tipo_acao}
                        </p>
                        <p className="font-body text-xs text-muted">{p.area}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <ProcessStatusBadge status={p.status} />
                        {p.valor_causa && (
                          <p className="mt-1 font-body text-xs text-muted">
                            {formatCurrency(p.valor_causa)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
                {processes.length > 4 && (
                  <button
                    onClick={() => setTab("processos")}
                    className="w-full cursor-pointer rounded-lg border border-dashed border-border py-2 font-body text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                  >
                    +{processes.length - 4} mais processos
                  </button>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "processos" && (
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpenIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-fg">
                  Processos ({processes.length})
                </h3>
                <p className="font-body text-xs text-muted">
                  {activeProcesses.length} ativos
                  {valorTotal > 0 &&
                    ` · ${formatCurrency(valorTotal)} em causa`}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/processos/novo?cliente=${client.id}&back=${encodeURIComponent(`/dashboard/clientes/${client.id}?tab=processos`)}`}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Novo processo
            </Link>
          </div>

          {processes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FolderOpenIcon className="h-10 w-10 text-slate-300" />
              <p className="font-body text-sm font-semibold text-muted">
                Nenhum processo cadastrado
              </p>
              <Link
                href={`/dashboard/processos/novo?cliente=${client.id}&back=${encodeURIComponent(`/dashboard/clientes/${client.id}?tab=processos`)}`}
                className="flex items-center gap-2 rounded-lg bg-cta px-4 py-2 font-body text-sm font-semibold text-white hover:bg-cta-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Cadastrar primeiro processo
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {processes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-primary/5"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                        <FolderOpenIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        {p.numero && (
                          <p className="font-mono text-xs text-muted">
                            {p.numero}
                          </p>
                        )}
                        <p className="font-body text-sm font-semibold text-fg">
                          {p.tipo_acao}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-body text-xs text-muted">
                            {p.area}
                          </span>
                          {p.vara && (
                            <span className="font-body text-xs text-muted">
                              · {p.vara}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <ProcessStatusBadge status={p.status} />
                      {p.valor_causa && (
                        <p className="mt-1 font-body text-xs text-muted">
                          {formatCurrency(p.valor_causa)}
                        </p>
                      )}
                      {p.data_distribuicao && (
                        <p className="mt-0.5 flex items-center gap-1 justify-end font-body text-xs text-muted">
                          <ClockIcon className="h-3 w-3" />
                          {p.data_distribuicao}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "financeiro" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                label: "Total pago",
                value: formatCurrency(debito.totalPago),
                icon: CheckCircleIcon,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                label: "Pendente",
                value:
                  debito.totalPendente > 0
                    ? formatCurrency(debito.totalPendente)
                    : "Quitado",
                icon: AlertIcon,
                color:
                  debito.totalPendente > 0
                    ? "text-red-600"
                    : "text-emerald-600",
                bg: debito.totalPendente > 0 ? "bg-red-50" : "bg-emerald-50",
              },
              {
                label: "Total geral",
                value: formatCurrency(debito.totalPago + debito.totalPendente),
                icon: BanknotesIcon,
                color: "text-primary",
                bg: "bg-primary/5",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={`rounded-xl border border-border ${bg} px-4 py-4`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </p>
                </div>
                <p className={`font-heading text-xl font-bold ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <ClientDebitsSection clientId={client.id} debito={debito} />
        </div>
      )}

      {tab === "documentos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-body text-sm text-muted">
              {documentos.length}{" "}
              {documentos.length === 1 ? "documento" : "documentos"} arquivado
              {documentos.length !== 1 ? "s" : ""}
            </p>
            <GerarDocumentoButton
              clientId={client.id}
              clientName={client.name}
            />
          </div>
          <DocumentsSection
            entityType="cliente"
            entityId={client.id}
            documents={documentos}
          />
        </div>
      )}

      {tab === "email" && (
        <InboundEmailTab
          clientId={client.id}
          clientName={client.name}
          address={inboundAddress}
          emails={inboundEmails}
        />
      )}
    </div>
  );
}
