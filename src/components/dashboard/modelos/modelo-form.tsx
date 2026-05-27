"use client";

import { useRef, useState, useActionState } from "react";
import Link from "next/link";
import { SpinnerIcon } from "@/components/icons";
import type { ModeloDocumento } from "@/lib/modelos-db";
import type { ModeloFormState } from "@/lib/modelo-actions";

// ── Variable definitions ────────────────────────────────────────

const VARIAVEIS = [
  {
    group: "Cliente",
    vars: [
      { tag: "{{nome}}", desc: "Nome completo" },
      { tag: "{{cpf_cnpj}}", desc: "CPF ou CNPJ" },
      { tag: "{{tipo}}", desc: "PF / PJ" },
      { tag: "{{email}}", desc: "E-mail" },
      { tag: "{{telefone}}", desc: "Telefone" },
      { tag: "{{data_nascimento}}", desc: "Nascimento" },
      { tag: "{{nome_fantasia}}", desc: "Nome fantasia" },
      { tag: "{{rg}}", desc: "RG" },
      { tag: "{{rg_orgao}}", desc: "Órgão expedidor" },
      { tag: "{{estado_civil}}", desc: "Estado civil" },
      { tag: "{{genero}}", desc: "Gênero" },
      { tag: "{{profissao}}", desc: "Profissão" },
      { tag: "{{nacionalidade}}", desc: "Nacionalidade" },
      { tag: "{{parceria}}", desc: "Parceria / Origem" },
    ],
  },
  {
    group: "Responsável",
    vars: [
      { tag: "{{responsavel_nome}}", desc: "Nome" },
      { tag: "{{responsavel_cpf}}", desc: "CPF" },
      { tag: "{{responsavel_rg}}", desc: "RG" },
      { tag: "{{responsavel_rg_orgao}}", desc: "Órgão expedidor" },
      { tag: "{{responsavel_telefone}}", desc: "Telefone" },
      { tag: "{{responsavel_email}}", desc: "E-mail" },
      { tag: "{{responsavel_parentesco}}", desc: "Parentesco" },
    ],
  },
  {
    group: "Endereço",
    vars: [
      { tag: "{{endereco}}", desc: "Rua + nº + complemento" },
      { tag: "{{endereco_completo}}", desc: "Endereço com CEP" },
      { tag: "{{bairro}}", desc: "Bairro" },
      { tag: "{{cidade}}", desc: "Cidade" },
      { tag: "{{estado}}", desc: "Estado (UF)" },
      { tag: "{{cep}}", desc: "CEP" },
    ],
  },
  {
    group: "Geral",
    vars: [
      { tag: "{{data_hoje}}", desc: "Data por extenso" },
      { tag: "{{advogado}}", desc: "Nome do advogado" },
    ],
  },
];

const CATEGORIAS = [
  "Contratos",
  "Procurações",
  "Declarações",
  "Notificações",
  "Petições",
  "Previdenciário",
  "Família",
  "Trabalhista",
  "Outro",
];

// ── Component ───────────────────────────────────────────────────

interface Props {
  action: (
    prev: ModeloFormState,
    formData: FormData
  ) => Promise<ModeloFormState>;
  modelo?: ModeloDocumento;
}

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";

export default function ModeloForm({ action, modelo }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [conteudo, setConteudo] = useState(modelo?.conteudo ?? "");
  const [activeGroup, setActiveGroup] = useState(VARIAVEIS[0].group);
  const [usarTimbrado, setUsarTimbrado] = useState(
    modelo?.usar_timbrado ?? true
  );

  function insertVariable(tag: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = conteudo.slice(0, start);
    const after = conteudo.slice(end);
    const newVal = before + tag + after;
    setConteudo(newVal);
    // Restore focus and cursor position after tag
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Hidden field for existing status */}
      {modelo && (
        <input
          type="hidden"
          name="ativo"
          value={modelo.ativo ? "true" : "false"}
        />
      )}

      {/* Error */}
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Basic fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="titulo"
            defaultValue={modelo?.titulo ?? ""}
            required
            placeholder="Ex: Procuração Previdenciária"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Categoria</label>
          <select
            name="categoria"
            defaultValue={modelo?.categoria ?? ""}
            className={selectCls}
          >
            <option value="">— Sem categoria —</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Descrição (resumo)</label>
          <input
            type="text"
            name="descricao"
            defaultValue={modelo?.descricao ?? ""}
            placeholder="Ex: Para processos do INSS"
            className={inputCls}
          />
        </div>
      </div>

      {/* Letterhead toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3">
        <div>
          <p className="font-body text-sm font-semibold text-fg">
            Papel timbrado
          </p>
          <p className="font-body text-xs text-muted mt-0.5">
            Adiciona cabeçalho e rodapé do escritório ao PDF gerado
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={usarTimbrado}
          onClick={() => setUsarTimbrado((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            usarTimbrado ? "bg-primary" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              usarTimbrado ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <input
          type="hidden"
          name="usar_timbrado"
          value={usarTimbrado ? "true" : "false"}
        />
      </div>

      {/* Editor + Variables panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Textarea */}
        <div className="lg:col-span-2">
          <label className={labelCls}>
            Conteúdo do modelo <span className="text-red-500">*</span>
          </label>
          <p className="font-body text-xs text-muted mb-2">
            Use duplo &lt;Enter&gt; para parágrafos. Clique nas variáveis ao
            lado para inserir no cursor.
          </p>
          {/* Hidden input synced with state */}
          <input type="hidden" name="conteudo" value={conteudo} />
          <textarea
            ref={textareaRef}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={22}
            placeholder={`Digite o conteúdo do documento aqui...\n\nUse variáveis como {{nome}}, {{cpf_cnpj}}, {{cidade}} que serão substituídas automaticamente com os dados do cliente ao gerar o PDF.\n\nExemplo:\n\nEu, {{nome}}, portador(a) do CPF/CNPJ {{cpf_cnpj}}, residente em {{endereco_completo}}, venho pelo presente instrumento...`}
            className="w-full resize-y rounded-lg border border-border bg-white p-4 font-mono text-sm text-fg placeholder:text-slate-400 placeholder:font-body outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 leading-relaxed"
          />
        </div>

        {/* Variables panel */}
        <div className="flex flex-col gap-3">
          <div>
            <p className={labelCls}>Variáveis disponíveis</p>
            <p className="font-body text-xs text-muted mb-3">
              Clique para inserir no cursor
            </p>

            {/* Group tabs — 2 rows of 2 */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-slate-50 p-1 mb-3">
              {VARIAVEIS.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  onClick={() => setActiveGroup(g.group)}
                  className={`rounded-md py-1.5 font-body text-[11px] font-semibold transition-colors cursor-pointer truncate px-1 ${
                    activeGroup === g.group
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {g.group}
                </button>
              ))}
            </div>

            {/* Variables — 2 columns */}
            <div className="grid grid-cols-2 gap-1.5">
              {VARIAVEIS.find((g) => g.group === activeGroup)?.vars.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="flex flex-col items-start rounded-lg border border-border bg-white px-2.5 py-2 text-left transition-all hover:border-primary hover:bg-blue-50 cursor-pointer group"
                >
                  <span className="font-mono text-[11px] font-bold text-primary leading-tight break-all">
                    {v.tag}
                  </span>
                  <span className="font-body text-[10px] text-muted mt-0.5 leading-tight">
                    {v.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview note */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="font-body text-xs font-semibold text-primary mb-1">
              Como funciona
            </p>
            <p className="font-body text-xs text-blue-700 leading-relaxed">
              Ao gerar o PDF para um cliente, todas as variáveis são
              substituídas automaticamente pelos dados cadastrados.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Link
          href="/dashboard/modelos"
          className="flex h-10 items-center rounded-lg border border-border px-5 font-body text-sm font-semibold text-fg transition-colors hover:border-slate-400"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {pending && <SpinnerIcon className="h-4 w-4" />}
          {modelo ? "Salvar alterações" : "Criar modelo"}
        </button>
      </div>
    </form>
  );
}
