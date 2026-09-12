"use client";

import { useState, useTransition } from "react";
import {
  XMarkIcon,
  PlusIcon,
  SpinnerIcon,
  FolderOpenIcon,
  CheckIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
} from "@/components/icons";
import { createProcessoAction } from "@/lib/processo-actions";

type Aba = "judicial" | "extrajudicial";

const TIPOS_ACAO = [
  "B21 - Pensão por morte",
  "B25 - Auxílio-reclusão",
  "B31 - Auxílio-doença",
  "B32 - Aposentadoria por invalidez",
  "B41 - Aposentadoria por idade",
  "B42 - Aposentadoria por tempo de contribuição",
  "B46 - Aposentadoria especial",
  "B80 - Salário Maternidade",
  "B87 - BPC à pessoa com deficiência",
  "B88 - BPC à pessoa idosa",
  "B91 - Auxílio-doença acidentário",
  "B92 - Aposentadoria por invalidez acidentária",
  "B94 - Auxílio-acidente",
  "CP - Complemento Positivo",
  "Revisão do Benefício",
  "Acréscimo de 25%",
];

const JUSTICAS = [
  "Justiça dos Estados",
  "Justiça Federal",
  "Justiça do Trabalho",
  "Justiça Eleitoral",
  "Superior Tribunal de Justiça",
  "Supremo Tribunal Federal",
];

const INSTANCIAS = [
  "1ª Instância",
  "2ª Instância",
  "3ª Instância",
  "Turma Recursal",
  "STJ",
  "STF",
  "TST",
];

const ENVOLVIMENTOS = ["Autor", "Réu", "Interessado", "Terceiro", "Testemunha"];

// Mapeia o dígito "J" do número CNJ (posição 14, resolução CNJ 65/2008) pro
// texto do select "Justiça" — só cobre os ramos que já existem na lista
// JUSTICAS; os demais (Militar, CNJ) ficam sem sugestão automática.
function justicaDoCNJ(numeroDigits: string): string | null {
  const j = numeroDigits[13];
  const mapa: Record<string, string> = {
    "1": "Supremo Tribunal Federal",
    "3": "Superior Tribunal de Justiça",
    "4": "Justiça Federal",
    "5": "Justiça do Trabalho",
    "6": "Justiça Eleitoral",
    "8": "Justiça dos Estados",
  };
  return mapa[j] ?? null;
}

interface DadosProcessoCNJ {
  tribunal: string;
  orgaoJulgador: string | null;
  classe: string | null;
  assuntos: string[];
  dataAjuizamento: string | null;
  grau: string | null;
  partes: { tipo: string; nome: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  defaultClientId?: string;
  onSuccess?: () => void;
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectCls =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelCls =
  "block font-body text-xs font-semibold uppercase tracking-wide text-muted mb-1";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CadastroSimplesModal({
  open,
  onClose,
  clients,
  defaultClientId,
  onSuccess,
}: Props) {
  const [aba, setAba] = useState<Aba>("judicial");
  const [criarOutro, setCriarOutro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tipoAcaoSel, setTipoAcaoSel] = useState("");
  const [tipoAcaoManual, setTipoAcaoManual] = useState("");
  const [cnj, setCnj] = useState("");
  const [justica, setJustica] = useState("");
  const [comarca, setComarca] = useState("");
  const [capturaInfo, setCapturaInfo] = useState<DadosProcessoCNJ | null>(null);
  const [capturaErro, setCapturaErro] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  if (!open) return null;

  function resetForm() {
    setTipoAcaoSel("");
    setTipoAcaoManual("");
    setCnj("");
    setJustica("");
    setComarca("");
    setCapturaInfo(null);
    setCapturaErro(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await createProcessoAction(null, data);
      if (result?.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        if (criarOutro) {
          resetForm();
        } else {
          onClose();
        }
      }
    });
  }

  async function handleCnjCapture() {
    const digits = cnj.replace(/\D/g, "");
    if (digits.length !== 20) {
      setCapturaErro("Digite o número CNJ completo (20 dígitos) primeiro.");
      setCapturaInfo(null);
      return;
    }
    setCapturando(true);
    setCapturaErro(null);
    setCapturaInfo(null);
    try {
      const res = await fetch("/api/processos/buscar-cnj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: cnj }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCapturaErro(json?.error ?? "Não foi possível buscar o processo.");
        return;
      }
      const dados = json.dados as DadosProcessoCNJ;
      setCapturaInfo(dados);
      if (dados.orgaoJulgador) setComarca(dados.orgaoJulgador);
      const justicaSugerida = justicaDoCNJ(digits);
      if (justicaSugerida) setJustica(justicaSugerida);
    } catch {
      setCapturaErro("Erro de conexão ao consultar o tribunal.");
    } finally {
      setCapturando(false);
    }
  }

  const tipoAcaoFinal = tipoAcaoSel === "outro" ? tipoAcaoManual : tipoAcaoSel;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-white shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpenIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-fg">
                Novo Processo
              </h2>
              <p className="font-body text-xs text-muted">Cadastro simples</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Aba selector */}
        <div className="flex border-b border-border px-6 pt-3">
          {(
            [
              { key: "judicial", label: "Judicial", icon: GlobeAltIcon },
              {
                key: "extrajudicial",
                label: "Extrajudicial",
                icon: BuildingOfficeIcon,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 rounded-t-lg px-5 py-2 font-body text-sm font-semibold transition-colors cursor-pointer ${
                aba === key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="area" value="Previdenciário" />
          {tipoAcaoSel !== "outro" && (
            <input type="hidden" name="tipo_acao" value={tipoAcaoFinal} />
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Cliente */}
            <Field label="Cliente" required>
              <select
                name="client_id"
                required
                defaultValue={defaultClientId ?? ""}
                disabled={isPending}
                className={selectCls}
              >
                <option value="">Selecione o cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {aba === "judicial" ? (
              <>
                {/* CNJ */}
                <Field label="Numeração padrão CNJ">
                  <div className="flex gap-2">
                    <input
                      name="numero"
                      type="text"
                      placeholder="0000000-00.0000.0.00.0000"
                      value={cnj}
                      onChange={(e) => setCnj(e.target.value)}
                      disabled={isPending}
                      className={inputCls + " flex-1"}
                    />
                    <button
                      type="button"
                      onClick={handleCnjCapture}
                      disabled={capturando || isPending}
                      title="Buscar órgão/vara e dados do processo no tribunal"
                      className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {capturando ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : (
                        <GlobeAltIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {capturaErro && (
                    <p className="mt-1.5 font-body text-xs text-red-600">
                      {capturaErro}
                    </p>
                  )}
                  {capturaInfo && (
                    <div className="mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-body text-xs text-emerald-800">
                      <p>
                        Encontrado no {capturaInfo.tribunal}
                        {capturaInfo.dataAjuizamento
                          ? ` — distribuído em ${new Date(capturaInfo.dataAjuizamento + "T12:00:00").toLocaleDateString("pt-BR")}`
                          : ""}
                        . Órgão/vara e justiça preenchidos abaixo — confira.
                      </p>
                      {capturaInfo.classe && (
                        <p>
                          <strong>Classe no tribunal:</strong>{" "}
                          {capturaInfo.classe} — escolha o Assunto
                          correspondente abaixo manualmente.
                        </p>
                      )}
                      {capturaInfo.assuntos.length > 0 && (
                        <p>
                          <strong>Assuntos:</strong>{" "}
                          {capturaInfo.assuntos.join(", ")}
                        </p>
                      )}
                      {capturaInfo.partes.length > 0 ? (
                        <p>
                          <strong>Partes (conferir manualmente):</strong>{" "}
                          {capturaInfo.partes
                            .map((p) => `${p.nome} (${p.tipo})`)
                            .join("; ")}
                        </p>
                      ) : (
                        <p className="text-emerald-700/80">
                          O tribunal não disponibilizou o nome das partes nesta
                          consulta pública — comum em TJAL/TRF5/TRT19. Confira o
                          cliente/parte contrária manualmente.
                        </p>
                      )}
                    </div>
                  )}
                </Field>

                {/* Assunto */}
                <Field label="Assunto" required>
                  <select
                    value={tipoAcaoSel}
                    onChange={(e) => {
                      setTipoAcaoSel(e.target.value);
                      if (e.target.value !== "outro") setTipoAcaoManual("");
                    }}
                    disabled={isPending}
                    className={selectCls}
                  >
                    <option value="">— Selecione —</option>
                    {TIPOS_ACAO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="outro">Outro (digitar manualmente)…</option>
                  </select>
                  {tipoAcaoSel === "outro" && (
                    <input
                      name="tipo_acao"
                      type="text"
                      required
                      value={tipoAcaoManual}
                      onChange={(e) => setTipoAcaoManual(e.target.value)}
                      placeholder="Digite o assunto…"
                      disabled={isPending}
                      className={inputCls + " mt-2"}
                    />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Justiça">
                    <select
                      name="vara"
                      value={justica}
                      onChange={(e) => setJustica(e.target.value)}
                      disabled={isPending}
                      className={selectCls}
                    >
                      <option value="">Justiça dos Estados</option>
                      {JUSTICAS.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Instância">
                    <select
                      name="fase"
                      disabled={isPending}
                      className={selectCls}
                      defaultValue=""
                    >
                      <option value="">Selecione…</option>
                      {INSTANCIAS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Órgão / Vara">
                  <input
                    name="comarca"
                    type="text"
                    placeholder="Nome, sigla, cidade ou estado…"
                    value={comarca}
                    onChange={(e) => setComarca(e.target.value)}
                    disabled={isPending}
                    className={inputCls}
                  />
                </Field>
              </>
            ) : (
              <>
                {/* Extrajudicial */}
                <Field label="Assunto" required>
                  <select
                    value={tipoAcaoSel}
                    onChange={(e) => {
                      setTipoAcaoSel(e.target.value);
                      if (e.target.value !== "outro") setTipoAcaoManual("");
                    }}
                    disabled={isPending}
                    className={selectCls}
                  >
                    <option value="">— Selecione —</option>
                    {TIPOS_ACAO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="outro">Outro…</option>
                  </select>
                  {tipoAcaoSel === "outro" && (
                    <input
                      name="tipo_acao"
                      type="text"
                      required
                      value={tipoAcaoManual}
                      onChange={(e) => setTipoAcaoManual(e.target.value)}
                      placeholder="Digite o assunto…"
                      disabled={isPending}
                      className={inputCls + " mt-2"}
                    />
                  )}
                </Field>

                <Field label="Número do processo">
                  <input
                    name="numero"
                    type="text"
                    placeholder="Número interno ou administrativo…"
                    disabled={isPending}
                    className={inputCls}
                  />
                </Field>

                <Field label="Órgão">
                  <div className="flex gap-2">
                    <input
                      name="vara"
                      type="text"
                      placeholder="Nome do órgão…"
                      disabled={isPending}
                      className={inputCls + " flex-1"}
                    />
                    <button
                      type="button"
                      className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 font-body text-xs font-semibold text-muted hover:border-primary hover:text-primary cursor-pointer"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Criar
                    </button>
                  </div>
                </Field>
              </>
            )}

            {/* Common fields */}
            <Field label="Parte contrária / Pessoa">
              <input
                name="parte_contraria"
                type="text"
                placeholder="Nome da parte contrária…"
                disabled={isPending}
                className={inputCls}
              />
            </Field>

            <Field label="Envolvimento">
              <select
                name="fase"
                disabled={isPending}
                className={selectCls}
                defaultValue="Autor"
              >
                {ENVOLVIMENTOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>

            {aba === "judicial" && cnj && (
              <p className="rounded-lg border border-border bg-slate-50 px-3 py-2 font-body text-xs text-muted">
                Todo processo com número CNJ completo já é monitorado
                automaticamente (novas publicações entram sozinhas em
                Publicações) — não precisa ativar nada.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <label className="flex cursor-pointer items-center gap-2">
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  criarOutro
                    ? "border-primary bg-primary"
                    : "border-border bg-white"
                }`}
                onClick={() => setCriarOutro((p) => !p)}
              >
                {criarOutro && <CheckIcon className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="font-body text-sm text-muted">Criar outro</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 cursor-pointer items-center rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:border-slate-300 hover:text-fg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !tipoAcaoFinal.trim()}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-cta px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
