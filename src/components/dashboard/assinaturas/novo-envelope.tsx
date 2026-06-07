"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { salvarEnvelopeAction } from "@/lib/assinaturas-actions";
import {
  CheckIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  XMarkIcon,
  ChevronRightIcon,
} from "@/components/icons";

/* ─── types ─── */
type SigTipo = "eu_mesmo" | "colaborador" | "cliente" | "outro";
type SigPapel = "assinante" | "testemunha" | "avalista";

interface Assinante {
  key: string;
  tipo: SigTipo;
  nome: string;
  email: string;
  papel: SigPapel;
  valEmail: boolean;
  valSelfie: boolean;
  valDocumento: boolean;
  // used only for select lookup
  refId?: string;
}

interface DocFile {
  key: string;
  file: File;
}

interface Props {
  userLogin: string;
  colaboradores: { id: string; nome: string; email: string }[];
  clientes: { id: string; nome: string; email: string }[];
}

/* ─── helpers ─── */
function uid() {
  return Math.random().toString(36).slice(2);
}

const STEP_LABELS = [
  "Envelope",
  "Documentos",
  "Assinantes",
  "Notificações",
  "Revisão",
];

function StepBar({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-0 font-body text-xs">
      {STEP_LABELS.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <li key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-semibold transition-colors
                  ${done ? "border-primary bg-primary text-white" : active ? "border-primary bg-white text-primary" : "border-border bg-white text-muted"}`}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : idx}
              </div>
              <span
                className={`hidden sm:block whitespace-nowrap ${active ? "font-semibold text-primary" : done ? "text-primary" : "text-muted"}`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-8 sm:w-12 flex-shrink-0 rounded ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── main ─── */
export default function NovoEnvelope({
  userLogin,
  colaboradores,
  clientes,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [nome, setNome] = useState("");
  const [prazo, setPrazo] = useState("");

  // Step 2
  const [docs, setDocs] = useState<DocFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [newTipo, setNewTipo] = useState<SigTipo>("eu_mesmo");
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPapel, setNewPapel] = useState<SigPapel>("assinante");
  const [newValEmail, setNewValEmail] = useState(true);
  const [newValSelfie, setNewValSelfie] = useState(false);
  const [newValDoc, setNewValDoc] = useState(false);
  const [newRefId, setNewRefId] = useState("");

  // Step 4
  const [notifAssinantes, setNotifAssinantes] = useState(true);
  const [notifCriador, setNotifCriador] = useState(true);
  const [notifEscritorio, setNotifEscritorio] = useState(false);

  /* ─── file drop ─── */
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf");
    setDocs((prev) => [...prev, ...pdfs.map((f) => ({ key: uid(), file: f }))]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  /* ─── add signer ─── */
  function fillFromRef(tipo: SigTipo, refId: string) {
    if (tipo === "eu_mesmo") {
      setNewNome(userLogin);
      setNewEmail("");
      return;
    }
    if (tipo === "colaborador") {
      const c = colaboradores.find((x) => x.id === refId);
      if (c) {
        setNewNome(c.nome);
        setNewEmail(c.email);
      }
      return;
    }
    if (tipo === "cliente") {
      const c = clientes.find((x) => x.id === refId);
      if (c) {
        setNewNome(c.nome);
        setNewEmail(c.email);
      }
      return;
    }
  }

  function addAssinante() {
    if (!newNome.trim() || !newEmail.trim()) return;
    setAssinantes((prev) => [
      ...prev,
      {
        key: uid(),
        tipo: newTipo,
        nome: newNome.trim(),
        email: newEmail.trim(),
        papel: newPapel,
        valEmail: newValEmail,
        valSelfie: newValSelfie,
        valDocumento: newValDoc,
        refId: newRefId,
      },
    ]);
    setNewNome("");
    setNewEmail("");
    setNewRefId("");
  }

  /* ─── submit ─── */
  async function submit(enviar: boolean) {
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("nome", nome.trim());
      fd.set("prazo", prazo);
      fd.set("enviar", enviar ? "1" : "0");
      fd.set("notif_assinantes", notifAssinantes ? "1" : "0");
      fd.set("notif_criador", notifCriador ? "1" : "0");
      fd.set("notif_escritorio", notifEscritorio ? "1" : "0");
      fd.set(
        "assinantes",
        JSON.stringify(
          assinantes.map((a, i) => ({
            tipo: a.tipo,
            nome: a.nome,
            email: a.email,
            papel: a.papel,
            valEmail: a.valEmail,
            valSelfie: a.valSelfie,
            valDocumento: a.valDocumento,
            ordem: i + 1,
          }))
        )
      );
      fd.set(
        "documentos",
        JSON.stringify(
          docs.map((d, i) => ({
            nome: d.file.name,
            tamanhoBytes: d.file.size,
            ordem: i + 1,
          }))
        )
      );
      await salvarEnvelopeAction(fd);
      router.push("/dashboard/assinaturas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
      setSaving(false);
    }
  }

  /* ─── render steps ─── */
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <StepBar step={step} />
      </div>

      {/* Step 1 — Envelope */}
      {step === 1 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-heading text-lg font-semibold text-fg">
            Dados do envelope
          </h2>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block font-body text-sm font-medium text-fg mb-1">
                Nome do envelope <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Contrato de honorários — João Silva"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block font-body text-sm font-medium text-fg mb-1">
                Prazo para assinatura
              </label>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1 font-body text-xs text-muted">
                Opcional. Após o prazo o envelope expira automaticamente.
              </p>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                if (nome.trim()) setStep(2);
              }}
              disabled={!nome.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Próximo <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Documentos */}
      {step === 2 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-heading text-lg font-semibold text-fg">
            Documentos para assinar
          </h2>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-slate-50 py-12 cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <UploadIcon className="h-10 w-10 text-muted/40" />
            <div className="text-center">
              <p className="font-body text-sm font-semibold text-fg">
                Arraste PDFs aqui ou clique para selecionar
              </p>
              <p className="font-body text-xs text-muted mt-0.5">
                Apenas arquivos PDF são aceitos
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {docs.length > 0 && (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5"
                >
                  <span className="flex-1 font-body text-sm text-fg truncate">
                    {d.file.name}
                  </span>
                  <span className="font-body text-xs text-muted whitespace-nowrap">
                    {(d.file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDocs((prev) => prev.filter((x) => x.key !== d.key))
                    }
                    className="rounded p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-border px-5 py-2 font-body text-sm font-medium text-fg transition-colors hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                if (docs.length > 0) setStep(3);
              }}
              disabled={docs.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Próximo <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Assinantes */}
      {step === 3 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-heading text-lg font-semibold text-fg">
            Assinantes
          </h2>

          {/* Existing signers list */}
          {assinantes.length > 0 && (
            <ul className="space-y-2">
              {assinantes.map((a, i) => (
                <li
                  key={a.key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-body text-xs font-bold text-primary flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold text-fg truncate">
                      {a.nome}
                    </p>
                    <p className="font-body text-xs text-muted truncate">
                      {a.email} · {a.papel}
                    </p>
                  </div>
                  <div className="flex gap-1 text-xs text-muted flex-shrink-0">
                    {a.valEmail && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        Email
                      </span>
                    )}
                    {a.valSelfie && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        Selfie
                      </span>
                    )}
                    {a.valDocumento && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        Doc
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAssinantes((prev) =>
                        prev.filter((x) => x.key !== a.key)
                      )
                    }
                    className="rounded p-1 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add signer form */}
          <div className="rounded-xl border border-dashed border-border bg-slate-50 p-4 space-y-4">
            <p className="font-body text-sm font-semibold text-fg">
              Adicionar assinante
            </p>

            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                ["eu_mesmo", "colaborador", "cliente", "outro"] as SigTipo[]
              ).map((t) => {
                const labels: Record<SigTipo, string> = {
                  eu_mesmo: "Eu mesmo",
                  colaborador: "Colaborador",
                  cliente: "Cliente",
                  outro: "Outra pessoa",
                };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setNewTipo(t);
                      setNewRefId("");
                      setNewNome("");
                      setNewEmail("");
                      if (t === "eu_mesmo") fillFromRef(t, "");
                    }}
                    className={`rounded-lg border px-3 py-2 font-body text-xs font-semibold transition-colors
                      ${newTipo === t ? "border-primary bg-primary text-white" : "border-border bg-white text-fg hover:border-primary/50"}`}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            {/* Select for colaborador/cliente */}
            {(newTipo === "colaborador" || newTipo === "cliente") && (
              <select
                value={newRefId}
                onChange={(e) => {
                  setNewRefId(e.target.value);
                  fillFromRef(newTipo, e.target.value);
                }}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">
                  {newTipo === "colaborador"
                    ? "Selecione um colaborador…"
                    : "Selecione um cliente…"}
                </option>
                {(newTipo === "colaborador" ? colaboradores : clientes).map(
                  (x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  )
                )}
              </select>
            )}

            {/* Nome e Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-xs font-medium text-muted mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  readOnly={newTipo === "eu_mesmo"}
                  placeholder="Nome completo"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block font-body text-xs font-medium text-muted mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Papel */}
            <div>
              <label className="block font-body text-xs font-medium text-muted mb-1.5">
                Papel
              </label>
              <div className="flex gap-2">
                {(["assinante", "testemunha", "avalista"] as SigPapel[]).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPapel(p)}
                      className={`rounded-lg border px-3 py-1.5 font-body text-xs font-semibold capitalize transition-colors
                      ${newPapel === p ? "border-primary bg-primary text-white" : "border-border bg-white text-fg hover:border-primary/50"}`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Validações */}
            <div>
              <label className="block font-body text-xs font-medium text-muted mb-1.5">
                Validações obrigatórias
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  {
                    key: "email",
                    label: "Email",
                    val: newValEmail,
                    set: setNewValEmail,
                  },
                  {
                    key: "selfie",
                    label: "Selfie",
                    val: newValSelfie,
                    set: setNewValSelfie,
                  },
                  {
                    key: "doc",
                    label: "Documento",
                    val: newValDoc,
                    set: setNewValDoc,
                  },
                ].map(({ key, label, val, set }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) => set(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="font-body text-sm text-fg">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={addAssinante}
              disabled={!newNome.trim() || !newEmail.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-primary px-4 py-2 font-body text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-40"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar assinante
            </button>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-border px-5 py-2 font-body text-sm font-medium text-fg transition-colors hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                if (assinantes.length > 0) setStep(4);
              }}
              disabled={assinantes.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Próximo <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Notificações */}
      {step === 4 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-5">
          <h2 className="font-heading text-lg font-semibold text-fg">
            Notificações por email
          </h2>
          <p className="font-body text-sm text-muted">
            Quem deve ser notificado quando o envelope for enviado e concluído?
          </p>

          <div className="space-y-3 max-w-sm">
            {[
              {
                key: "assinantes",
                label: "Notificar os assinantes",
                desc: "Cada assinante recebe um link para assinar",
                val: notifAssinantes,
                set: setNotifAssinantes,
              },
              {
                key: "criador",
                label: "Notificar o criador do envelope",
                desc: "Você recebe atualizações de status",
                val: notifCriador,
                set: setNotifCriador,
              },
              {
                key: "escritorio",
                label: "Notificar o escritório",
                desc: "Email geral do escritório recebe cópia",
                val: notifEscritorio,
                set: setNotifEscritorio,
              },
            ].map(({ key, label, desc, val, set }) => (
              <label
                key={key}
                className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 transition-colors hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <div>
                  <p className="font-body text-sm font-semibold text-fg">
                    {label}
                  </p>
                  <p className="font-body text-xs text-muted mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(3)}
              className="rounded-lg border border-border px-5 py-2 font-body text-sm font-medium text-fg transition-colors hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep(5)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Revisar <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — Revisão */}
      {step === 5 && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-6">
          <h2 className="font-heading text-lg font-semibold text-fg">
            Revisão do envelope
          </h2>

          {/* Summary */}
          <dl className="space-y-3 font-body text-sm">
            <div className="flex gap-3">
              <dt className="w-32 flex-shrink-0 font-semibold text-muted">
                Nome
              </dt>
              <dd className="text-fg">{nome}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 flex-shrink-0 font-semibold text-muted">
                Prazo
              </dt>
              <dd className="text-fg">
                {prazo
                  ? new Date(prazo + "T12:00:00").toLocaleDateString("pt-BR")
                  : "Sem prazo"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 flex-shrink-0 font-semibold text-muted">
                Documentos
              </dt>
              <dd className="text-fg">
                {docs.length} PDF{docs.length !== 1 ? "s" : ""}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 flex-shrink-0 font-semibold text-muted">
                Assinantes
              </dt>
              <dd className="text-fg">
                <ul className="space-y-0.5">
                  {assinantes.map((a) => (
                    <li key={a.key}>
                      {a.nome} ({a.email}) — {a.papel}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 flex-shrink-0 font-semibold text-muted">
                Notificações
              </dt>
              <dd className="text-fg">
                {[
                  notifAssinantes && "Assinantes",
                  notifCriador && "Criador",
                  notifEscritorio && "Escritório",
                ]
                  .filter(Boolean)
                  .join(", ") || "Nenhuma"}
              </dd>
            </div>
          </dl>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
            <button
              onClick={() => setStep(4)}
              className="rounded-lg border border-border px-5 py-2 font-body text-sm font-medium text-fg transition-colors hover:bg-slate-50"
            >
              Voltar
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => submit(false)}
                disabled={saving}
                className="rounded-lg border border-border px-5 py-2 font-body text-sm font-semibold text-fg transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                {saving ? "Salvando…" : "Salvar rascunho"}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {saving ? "Enviando…" : "Salvar e enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
