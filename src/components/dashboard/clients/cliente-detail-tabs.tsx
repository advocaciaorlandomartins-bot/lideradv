"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientFull } from "@/lib/clients-db";
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

// ── CopyButton ────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value || value === "—") return null;
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className="ml-1 flex-shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-slate-100 hover:text-primary"
    >
      {copied ? (
        <svg
          className="h-3.5 w-3.5 text-emerald-500"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="5" y="5" width="9" height="9" rx="1.5" />
          <path
            d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
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
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-muted mt-3.5" />}
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          <p className="font-body text-sm text-fg break-words flex-1">
            {value || "—"}
          </p>
          <CopyButton value={value} />
        </div>
      </div>
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────

function SectionCard({
  title,
  children,
  cols = 2,
}: {
  title: string;
  children: React.ReactNode;
  cols?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h3 className="font-heading text-sm font-bold text-fg mb-4">{title}</h3>
      <div className={`grid gap-x-6 gap-y-4 grid-cols-1 sm:grid-cols-${cols}`}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface Props {
  client: ClientFull;
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

          {/* Contato + Endereço + Dados pessoais */}
          <div className="lg:col-span-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Contato */}
            <SectionCard title="Contato" cols={1}>
              <InfoRow icon={MailIcon} label="E-mail" value={client.email} />
              <InfoRow icon={PhoneIcon} label="Telefone" value={client.phone} />
              <InfoRow
                icon={UsersIcon}
                label={client.type === "PJ" ? "CNPJ" : "CPF"}
                value={client.doc}
              />
              {client.rg && (
                <InfoRow
                  label="RG"
                  value={
                    client.rg + (client.rg_orgao ? ` — ${client.rg_orgao}` : "")
                  }
                />
              )}
              {client.birth_date && (
                <InfoRow
                  icon={CalendarIcon}
                  label="Data de nascimento"
                  value={new Date(
                    client.birth_date + "T12:00:00"
                  ).toLocaleDateString("pt-BR")}
                />
              )}
              {client.estado_civil && (
                <InfoRow label="Estado civil" value={client.estado_civil} />
              )}
              {client.genero && (
                <InfoRow label="Gênero" value={client.genero} />
              )}
              {client.profissao && (
                <InfoRow label="Profissão" value={client.profissao} />
              )}
              {client.nacionalidade && (
                <InfoRow label="Nacionalidade" value={client.nacionalidade} />
              )}
              {/* Quick actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
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
            </SectionCard>

            {/* Endereço */}
            <SectionCard title="Endereço" cols={1}>
              <InfoRow icon={MapPinIcon} label="CEP" value={client.cep} />
              <InfoRow label="Logradouro" value={client.street} />
              <InfoRow label="Número" value={client.addr_number} />
              {client.complement && (
                <InfoRow label="Complemento" value={client.complement} />
              )}
              <InfoRow label="Bairro" value={client.neighborhood} />
              <InfoRow label="Cidade" value={client.city} />
              <InfoRow label="Estado" value={client.state} />
              {/* Endereço completo para copiar de uma vez */}
              {client.street && (
                <div className="pt-2 border-t border-border">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                    Endereço completo
                  </p>
                  <div className="flex items-start gap-1">
                    <p className="font-body text-sm text-fg flex-1 break-words">
                      {[
                        client.street,
                        client.addr_number,
                        client.complement,
                        client.neighborhood,
                        client.city,
                        client.state,
                        client.cep,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <CopyButton
                      value={[
                        client.street,
                        client.addr_number,
                        client.complement,
                        client.neighborhood,
                        client.city,
                        client.state,
                        client.cep,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    />
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Responsável legal (se for menor/incapaz) */}
            {client.menor_incapaz && client.responsavel_nome ? (
              <SectionCard title="Responsável Legal" cols={1}>
                <InfoRow
                  icon={UsersIcon}
                  label="Nome"
                  value={client.responsavel_nome}
                />
                {client.responsavel_cpf && (
                  <InfoRow label="CPF" value={client.responsavel_cpf} />
                )}
                {client.responsavel_rg && (
                  <InfoRow
                    label="RG"
                    value={
                      client.responsavel_rg +
                      (client.responsavel_rg_orgao
                        ? ` — ${client.responsavel_rg_orgao}`
                        : "")
                    }
                  />
                )}
                {client.responsavel_parentesco && (
                  <InfoRow
                    label="Parentesco"
                    value={client.responsavel_parentesco}
                  />
                )}
                {client.responsavel_telefone && (
                  <InfoRow
                    icon={PhoneIcon}
                    label="Telefone"
                    value={client.responsavel_telefone}
                  />
                )}
                {client.responsavel_email && (
                  <InfoRow
                    icon={MailIcon}
                    label="E-mail"
                    value={client.responsavel_email}
                  />
                )}
              </SectionCard>
            ) : (
              /* Naturalidade + Filiação (INSS) */
              <SectionCard title="Filiação e Naturalidade" cols={1}>
                {client.filiacao_mae && (
                  <InfoRow label="Nome da mãe" value={client.filiacao_mae} />
                )}
                {client.filiacao_pai && (
                  <InfoRow label="Nome do pai" value={client.filiacao_pai} />
                )}
                {client.naturalidade_cidade && (
                  <InfoRow
                    label="Naturalidade"
                    value={`${client.naturalidade_cidade}${client.naturalidade_estado ? ` / ${client.naturalidade_estado}` : ""}`}
                  />
                )}
                {!client.filiacao_mae &&
                  !client.filiacao_pai &&
                  !client.naturalidade_cidade && (
                    <p className="font-body text-sm text-muted">
                      Nenhum dado cadastrado
                    </p>
                  )}
              </SectionCard>
            )}
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

          {/* Card previdenciário — só aparece se houver dados */}
          {client.type === "PF" &&
            (client.nis ||
              client.num_beneficio ||
              client.status_beneficio ||
              client.cid_principal ||
              client.data_diagnostico ||
              client.data_afastamento) && (
              <div className="lg:col-span-3 rounded-xl border border-blue-100 bg-blue-50/40 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-body text-[10px] font-bold">
                    INSS
                  </span>
                  <h3 className="font-heading text-sm font-bold text-fg">
                    Dados Previdenciários
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
                  {client.nis && (
                    <InfoRow label="NIS / PIS" value={client.nis} />
                  )}
                  {client.num_beneficio && (
                    <InfoRow
                      label="Nº Benefício"
                      value={client.num_beneficio}
                    />
                  )}
                  {client.status_beneficio && (
                    <InfoRow
                      label="Status benefício"
                      value={
                        {
                          ativo: "Ativo",
                          suspenso: "Suspenso",
                          cessado: "Cessado",
                          nao_recebe: "Não recebe",
                        }[client.status_beneficio] ?? client.status_beneficio
                      }
                    />
                  )}
                  {client.tipo_beneficio && (
                    <InfoRow
                      label="Tipo de benefício"
                      value={client.tipo_beneficio}
                    />
                  )}
                  {client.data_inicio_beneficio && (
                    <InfoRow
                      label="Início benefício"
                      value={new Date(
                        client.data_inicio_beneficio + "T12:00:00"
                      ).toLocaleDateString("pt-BR")}
                    />
                  )}
                  {client.valor_beneficio != null && (
                    <InfoRow
                      label="Valor benefício"
                      value={client.valor_beneficio.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    />
                  )}
                  {client.categoria_contribuinte && (
                    <InfoRow
                      label="Categoria contribuinte"
                      value={
                        {
                          empregado: "Empregado",
                          individual: "Contribuinte individual",
                          especial: "Segurado especial",
                          avulso: "Trabalhador avulso",
                          facultativo: "Facultativo",
                        }[client.categoria_contribuinte] ??
                        client.categoria_contribuinte
                      }
                    />
                  )}
                  {client.carencia_atingida != null && (
                    <InfoRow
                      label="Carência atingida"
                      value={client.carencia_atingida ? "Sim" : "Não"}
                    />
                  )}
                  {client.num_contribuicoes != null && (
                    <InfoRow
                      label="Nº contribuições"
                      value={String(client.num_contribuicoes)}
                    />
                  )}
                  {client.cid_principal && (
                    <InfoRow
                      label="CID principal"
                      value={client.cid_principal}
                    />
                  )}
                  {client.tipo_incapacidade && (
                    <InfoRow
                      label="Incapacidade"
                      value={
                        {
                          permanente: "Permanente",
                          temporaria: "Temporária",
                          nao_se_aplica: "Não se aplica",
                        }[client.tipo_incapacidade] ?? client.tipo_incapacidade
                      }
                    />
                  )}
                  {client.data_diagnostico && (
                    <InfoRow
                      label="Data diagnóstico"
                      value={new Date(
                        client.data_diagnostico + "T12:00:00"
                      ).toLocaleDateString("pt-BR")}
                    />
                  )}
                  {client.data_afastamento && (
                    <InfoRow
                      label="Data afastamento"
                      value={new Date(
                        client.data_afastamento + "T12:00:00"
                      ).toLocaleDateString("pt-BR")}
                    />
                  )}
                  {client.atividade_anterior && (
                    <InfoRow
                      label="Atividade anterior"
                      value={client.atividade_anterior}
                    />
                  )}
                </div>
              </div>
            )}
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
