"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AiExtractedData } from "@/app/api/clientes/importacao-ia/route";
import {
  DocumentArrowUpIcon,
  SpinnerIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  UserPlusIcon,
  UploadIcon,
} from "@/components/icons";
import { createClientAction } from "@/lib/client-actions";

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_SIZE_MB = 10;

const DOCUMENT_TYPES = [
  "RG",
  "CNH",
  "CPF",
  "Passaporte",
  "Título de Eleitor",
  "Certidão de Nascimento",
  "Certidão de Casamento",
];

const ESTADOS_UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = "upload" | "extracting" | "review" | "creating" | "success";

// ── Helpers ────────────────────────────────────────────────────────────────────

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const selectCls =
  "h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
const labelCls = "block font-body text-xs font-semibold text-muted mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Selecionar" },
    { key: "extracting", label: "Extraindo" },
    { key: "review", label: "Revisar" },
    { key: "creating", label: "Salvar" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full font-body text-xs font-bold transition-colors ${
              i < idx
                ? "bg-emerald-500 text-white"
                : i === idx
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-muted"
            }`}
          >
            {i < idx ? <CheckCircleIcon className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`hidden font-body text-xs font-semibold sm:inline ${
              i <= idx ? "text-fg" : "text-muted"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-5 ${i < idx ? "bg-emerald-300" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void;
  onSuccess?: () => void;
  compact?: boolean;
}

export default function AiDocumentImport({
  onClose,
  onSuccess,
  compact = false,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFetchedCep = useRef("");

  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<AiExtractedData | null>(null);

  // Review form
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [rgOrgao, setRgOrgao] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [genero, setGenero] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [notes, setNotes] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Responsável legal (menor/incapaz)
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respTelefone, setRespTelefone] = useState("");
  const [respImporting, setRespImporting] = useState(false);
  const respFileRef = useRef<HTMLInputElement>(null);

  const [, startTransition] = useTransition();

  // force=true: sempre sobrescreve (usuário digitou CEP manualmente)
  // force=false: só preenche campos vazios (IA preencheu CEP sem endereço)
  async function fetchCep(digits: string, force = false) {
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (force) {
          setStreet(data.logradouro ?? "");
          setNeighborhood(data.bairro ?? "");
          setCity(data.localidade ?? "");
          setStateUf(data.uf ?? "");
        } else {
          setStreet((prev) => prev || (data.logradouro ?? ""));
          setNeighborhood((prev) => prev || (data.bairro ?? ""));
          setCity((prev) => prev || (data.localidade ?? ""));
          setStateUf((prev) => prev || (data.uf ?? ""));
        }
      }
    } catch {
      // silently fail
    } finally {
      setCepLoading(false);
    }
  }

  async function handleRespFileSelect(file: File) {
    const errs = validateFile(file);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setRespImporting(true);
    setErrors([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/clientes/importacao-ia", {
        method: "POST",
        body: fd,
      });
      const result: { data?: AiExtractedData; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || result.error || !result.data) {
        setErrors([
          result.error ?? "Erro ao processar documento do responsável.",
        ]);
        return;
      }
      const d = result.data;
      if (d.name) setRespNome(d.name);
      if (d.cpf) setRespCpf(maskCPF(d.cpf));
    } catch {
      setErrors(["Erro ao processar documento do responsável."]);
    } finally {
      setRespImporting(false);
    }
  }

  function validateFile(file: File): string[] {
    const errs: string[] = [];
    const normalized = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!ACCEPTED_TYPES.includes(normalized)) {
      errs.push(
        `Formato não suportado: ${file.type || "desconhecido"}. Use PDF, JPEG, PNG, WebP ou GIF.`
      );
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      errs.push(
        `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: ${MAX_SIZE_MB} MB.`
      );
    }
    return errs;
  }

  function handleFileSelect(file: File) {
    const errs = validateFile(file);
    if (errs.length > 0) {
      setErrors(errs);
      setSelectedFile(null);
      return;
    }
    setErrors([]);
    setSelectedFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function populateForm(data: AiExtractedData) {
    setName(data.name ?? "");
    setCpf(data.cpf ? maskCPF(data.cpf) : "");
    setRg(data.rg ?? "");
    setRgOrgao(data.rg_orgao ?? "");
    setBirthDate(data.birth_date ?? "");
    setGenero(data.genero ?? "");
    const cepDigits = (data.zipcode ?? "").replace(/\D/g, "");
    setCep(cepDigits ? maskCEP(cepDigits) : "");
    setStreet(data.street ?? "");
    setAddrNumber(data.addr_number ?? "");
    setNeighborhood(data.neighborhood ?? "");
    setCity(data.city ?? "");
    setStateUf(data.state ?? "");
    const extras = [
      data.document_type && `Doc: ${data.document_type}`,
      data.father_name && `Pai: ${data.father_name}`,
      data.mother_name && `Mãe: ${data.mother_name}`,
      data.cnh_numero &&
        `CNH: ${data.cnh_numero}${data.cnh_validade ? ` (val. ${data.cnh_validade})` : ""}`,
    ]
      .filter(Boolean)
      .join(" | ");
    if (extras) setNotes(extras);
    // Auto-busca CEP quando IA trouxe CEP mas não o endereço completo
    if (cepDigits.length === 8 && !data.street) {
      fetchCep(cepDigits);
    }
  }

  async function handleExtract() {
    if (!selectedFile) return;
    setErrors([]);
    setStep("extracting");
    setUploadProgress(10);

    // Simulate progress while waiting
    const timer = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 8, 88));
    }, 400);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      let res: Response;
      try {
        res = await fetch("/api/clientes/importacao-ia", {
          method: "POST",
          body: fd,
        });
      } catch {
        clearInterval(timer);
        setErrors([
          "Não foi possível conectar ao servidor. Verifique se o servidor está rodando.",
        ]);
        setStep("upload");
        return;
      }

      clearInterval(timer);
      setUploadProgress(100);

      // Parse JSON — handle case where server returns HTML error page
      let result: { data?: AiExtractedData; error?: string };
      try {
        result = await res.json();
      } catch {
        setErrors([
          `Erro interno do servidor (HTTP ${res.status}). Verifique o console do servidor.`,
        ]);
        setStep("upload");
        return;
      }

      if (!res.ok || result.error || !result.data) {
        setErrors([result.error ?? `Erro ao processar (HTTP ${res.status}).`]);
        setStep("upload");
        return;
      }

      setExtracted(result.data);
      populateForm(result.data);
      setStep("review");
    } catch (err) {
      clearInterval(timer);
      console.error("extract error:", err);
      setErrors([
        "Erro inesperado. Verifique o console do servidor para detalhes.",
      ]);
      setStep("upload");
    }
  }

  async function handleCreateClient() {
    const missing: string[] = [];
    if (!name.trim()) missing.push("nome");
    if (!cpf.trim()) missing.push("CPF");
    if (missing.length > 0) {
      setErrors([`Informe os campos obrigatórios: ${missing.join(", ")}.`]);
      return;
    }
    setErrors([]);
    setStep("creating");

    const temResponsavel = respNome.trim().length > 0;

    const fd = new FormData();
    fd.set("type", "PF");
    fd.set("name", name.trim());
    fd.set("doc", cpf.trim());
    fd.set("rg", rg);
    fd.set("rg_orgao", rgOrgao);
    fd.set("birth_date", birthDate);
    fd.set("genero", genero);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("cep", cep || "00000-000");
    fd.set("street", street || "A preencher");
    fd.set("number", addrNumber || "S/N");
    fd.set("neighborhood", neighborhood || "A preencher");
    fd.set("city", city || "A preencher");
    fd.set("state", stateUf || "AL");
    fd.set("notes", notes);
    fd.set("menor_incapaz", temResponsavel ? "true" : "false");
    fd.set("responsavel_nome", respNome.trim());
    fd.set("responsavel_cpf", respCpf.trim());
    fd.set("responsavel_telefone", respTelefone.trim());
    fd.set("origem_tipo", "");
    fd.set("origem_texto", "");
    fd.set("indicador_id", "");
    fd.set("indicador_tipo_trabalho", "");
    fd.set("comissao_tipo", "");
    fd.set("comissao_valor", "");

    startTransition(async () => {
      const result = await createClientAction(null, fd);
      if (result?.error) {
        setErrors([result.error]);
        setStep("review");
      } else {
        setStep("success");
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push("/dashboard/clientes");
          }
          router.refresh();
        }, 1500);
      }
    });
  }

  function reset() {
    setStep("upload");
    setSelectedFile(null);
    setUploadProgress(0);
    setErrors([]);
    setExtracted(null);
    setName("");
    setCpf("");
    setRg("");
    setRgOrgao("");
    setBirthDate("");
    setGenero("");
    setEmail("");
    setPhone("");
    setCep("");
    setStreet("");
    setAddrNumber("");
    setNeighborhood("");
    setCity("");
    setStateUf("");
    setNotes("");
    setRespNome("");
    setRespCpf("");
    setRespTelefone("");
    lastFetchedCep.current = "";
  }

  const isProcessing = step === "extracting" || step === "creating";

  return (
    <div
      className={`space-y-5 ${compact ? "" : "rounded-xl border border-border bg-white p-6 shadow-sm"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-fg">
            Cadastro por IA
          </h2>
          <p className="mt-0.5 font-body text-xs text-muted">
            Envie um documento para preencher automaticamente os dados do
            cliente
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StepIndicator step={step} />
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted transition-colors hover:text-fg"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p
              key={i}
              className="flex items-start gap-2 font-body text-sm text-red-700"
            >
              <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : selectedFile
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-border bg-slate-50 hover:border-primary/40 hover:bg-slate-100"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleInputChange}
              className="hidden"
            />
            {selectedFile ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <DocumentArrowUpIcon className="h-7 w-7 text-emerald-600" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-fg">
                    {selectedFile.name}
                  </p>
                  <p className="mt-0.5 font-body text-xs text-muted">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setErrors([]);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 font-body text-xs font-semibold text-muted transition-colors hover:text-red-600"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                  Remover
                </button>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <UploadIcon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-fg">
                    Arraste o documento aqui
                  </p>
                  <p className="mt-1 font-body text-xs text-muted">
                    ou clique para selecionar
                  </p>
                  <p className="mt-2 font-body text-xs text-slate-400">
                    PDF, JPEG, PNG, WebP · máx. {MAX_SIZE_MB} MB
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-slate-50 p-4">
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-muted">
              Documentos aceitos
            </p>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPES.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-border bg-white px-3 py-1 font-body text-xs text-fg"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExtract}
              disabled={!selectedFile}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DocumentArrowUpIcon className="h-4 w-4" />
              Extrair dados com IA
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Extracting ── */}
      {step === "extracting" && (
        <div className="flex flex-col items-center gap-6 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <SpinnerIcon className="h-10 w-10 animate-spin text-primary" />
          </div>
          <div className="w-full max-w-xs space-y-3 text-center">
            <p className="font-body text-sm font-semibold text-fg">
              {uploadProgress < 40
                ? "Enviando documento…"
                : uploadProgress < 85
                  ? "Analisando com IA…"
                  : "Finalizando extração…"}
            </p>
            <ProgressBar value={uploadProgress} />
            <p className="font-body text-xs text-muted">
              Isso pode levar alguns segundos
            </p>
          </div>
        </div>
      )}

      {/* ── Step: Review ── */}
      {step === "review" && extracted && (
        <div className="space-y-5">
          {extracted.document_type && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <p className="font-body text-sm font-semibold text-emerald-700">
                Documento detectado: {extracted.document_type}
              </p>
            </div>
          )}

          <p className="font-body text-xs text-muted">
            Revise e complete os dados antes de salvar. Campos em branco podem
            ser preenchidos manualmente.
          </p>

          {/* Dados pessoais */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                Dados pessoais
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nome completo *">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Nome completo"
                  />
                </Field>
              </div>
              <Field label="CPF *">
                <input
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  className={inputCls}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Data de Nascimento">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="RG">
                <input
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  className={inputCls}
                  placeholder="00.000.000-0"
                />
              </Field>
              <Field label="Órgão Expedidor">
                <input
                  value={rgOrgao}
                  onChange={(e) => setRgOrgao(e.target.value)}
                  className={inputCls}
                  placeholder="SSP/AL"
                />
              </Field>
              <Field label="Gênero">
                <select
                  value={genero}
                  onChange={(e) => setGenero(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— Selecione —</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Homem trans">Homem trans</option>
                  <option value="Mulher trans">Mulher trans</option>
                  <option value="Não binário">Não binário</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                Contato
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="E-mail">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="email@exemplo.com"
                />
              </Field>
              <Field label="Telefone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  className={inputCls}
                  placeholder="(82) 9 0000-0000"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                Endereço
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Field label="CEP">
                  <div className="relative">
                    <input
                      value={cep}
                      onChange={(e) => {
                        const masked = maskCEP(e.target.value);
                        setCep(masked);
                        const digits = masked.replace(/\D/g, "");
                        if (
                          digits.length === 8 &&
                          digits !== lastFetchedCep.current
                        ) {
                          lastFetchedCep.current = digits;
                          fetchCep(digits, true);
                        }
                      }}
                      className={`${inputCls} pr-10`}
                      placeholder="00000-000"
                      inputMode="numeric"
                    />
                    {cepLoading && (
                      <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
                    )}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Logradouro">
                  <input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className={inputCls}
                    placeholder="Rua, Av., Travessa…"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Número">
                  <input
                    value={addrNumber}
                    onChange={(e) => setAddrNumber(e.target.value)}
                    className={inputCls}
                    placeholder="123"
                  />
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Bairro">
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className={inputCls}
                    placeholder="Bairro"
                  />
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Cidade">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputCls}
                    placeholder="Cidade"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Estado">
                  <select
                    value={stateUf}
                    onChange={(e) => setStateUf(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">UF</option>
                    {ESTADOS_UF.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* Responsável Legal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="font-body text-xs font-bold uppercase tracking-wide text-muted">
                Responsável Legal (opcional)
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <input
              ref={respFileRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRespFileSelect(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => respFileRef.current?.click()}
              disabled={respImporting}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {respImporting ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <DocumentArrowUpIcon className="h-4 w-4" />
              )}
              {respImporting
                ? "Importando documento…"
                : "Importar documento do responsável (genitora/pai/tutor)"}
            </button>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nome do responsável">
                  <input
                    value={respNome}
                    onChange={(e) => setRespNome(e.target.value)}
                    className={inputCls}
                    placeholder="Nome completo"
                  />
                </Field>
              </div>
              <Field label="CPF do responsável">
                <input
                  value={respCpf}
                  onChange={(e) => setRespCpf(maskCPF(e.target.value))}
                  className={inputCls}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Telefone do responsável">
                <input
                  value={respTelefone}
                  onChange={(e) => setRespTelefone(maskPhone(e.target.value))}
                  className={inputCls}
                  placeholder="(82) 9 0000-0000"
                  type="tel"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Field label="Observações">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
                placeholder="Dados extras do documento…"
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <button
              onClick={reset}
              disabled={isProcessing}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 font-body text-sm font-semibold text-muted transition-colors hover:text-fg disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
              Novo documento
            </button>
            <button
              onClick={handleCreateClient}
              disabled={isProcessing || !name.trim() || !cpf.trim()}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-cta px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlusIcon className="h-4 w-4" />
              Criar cliente
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Creating ── */}
      {step === "creating" && (
        <div className="flex flex-col items-center gap-4 py-10">
          <SpinnerIcon className="h-10 w-10 animate-spin text-primary" />
          <p className="font-body text-sm font-semibold text-fg">
            Criando cliente…
          </p>
        </div>
      )}

      {/* ── Step: Success ── */}
      {step === "success" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p className="font-body text-base font-semibold text-fg">
              Cliente criado com sucesso!
            </p>
            <p className="mt-1 font-body text-sm text-muted">Redirecionando…</p>
          </div>
        </div>
      )}
    </div>
  );
}
