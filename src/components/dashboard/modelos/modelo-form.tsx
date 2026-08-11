"use client";

import { useRef, useState, useActionState } from "react";
import Link from "next/link";
import { SparklesIcon, SpinnerIcon } from "@/components/icons";
import type { ModeloDocumento } from "@/lib/modelos-db";
import type { ModeloFormState } from "@/lib/modelo-actions";
import type { Block } from "@/lib/modelo-blocks";
import { flattenBlocksToText } from "@/lib/modelo-blocks";
import { VARIAVEIS, CATEGORIAS } from "@/lib/modelo-variaveis";
import BlockEditor, {
  type BlockEditorHandle,
} from "@/components/dashboard/modelos/block-editor";
import AiModeloImport, {
  type AiModeloResult,
} from "@/components/dashboard/modelos/ai-modelo-import";

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
  const editorRef = useRef<BlockEditorHandle>(null);
  const [blocks, setBlocks] = useState<Block[]>(modelo?.conteudo_blocks ?? []);
  const [editorKey, setEditorKey] = useState(0);
  const [titulo, setTitulo] = useState(modelo?.titulo ?? "");
  const [categoria, setCategoria] = useState(modelo?.categoria ?? "");
  const [showAiModal, setShowAiModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState<
    (typeof VARIAVEIS)[number]["group"]
  >(VARIAVEIS[0].group);
  const [usarTimbrado, setUsarTimbrado] = useState(
    modelo?.usar_timbrado ?? true
  );

  function insertVariable(tag: string) {
    editorRef.current?.insertVariable(tag);
  }

  function handleAiGenerated(result: AiModeloResult) {
    setTitulo(result.titulo);
    setCategoria(result.categoria ?? "");
    setBlocks(result.blocks);
    setEditorKey((k) => k + 1);
    setShowAiModal(false);
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

      {/* AI generation */}
      {!modelo && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-blue-50/50 px-4 py-3">
          <div>
            <p className="font-body text-sm font-semibold text-fg">
              Começar com um exemplo pronto?
            </p>
            <p className="font-body text-xs text-muted mt-0.5">
              Envie um documento ou cole um texto e a IA monta o modelo com a
              formatação e as variáveis já inseridas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-white px-4 font-body text-sm font-semibold text-primary transition-colors hover:bg-blue-50 cursor-pointer"
          >
            <SparklesIcon className="h-4 w-4" />
            Gerar com IA
          </button>
        </div>
      )}

      {showAiModal && (
        <AiModeloImport
          onGenerated={handleAiGenerated}
          onClose={() => setShowAiModal(false)}
        />
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
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            placeholder="Ex: Procuração Previdenciária"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Categoria</label>
          <select
            name="categoria"
            value={categoria ?? ""}
            onChange={(e) => setCategoria(e.target.value)}
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
        {/* Rich text editor */}
        <div className="lg:col-span-2">
          <label className={labelCls}>
            Conteúdo do modelo <span className="text-red-500">*</span>
          </label>
          <p className="font-body text-xs text-muted mb-2">
            Use a barra de formatação para negrito, cores, títulos, tabelas e
            caixas destacadas. Clique nas variáveis ao lado para inserir no
            cursor.
          </p>
          {/* Hidden input synced with editor state */}
          <input
            type="hidden"
            name="conteudo_blocks"
            value={JSON.stringify(blocks)}
          />
          <input
            type="hidden"
            name="conteudo"
            value={flattenBlocksToText(blocks)}
          />
          <BlockEditor
            key={editorKey}
            ref={editorRef}
            initialBlocks={blocks.length > 0 ? blocks : null}
            onChange={setBlocks}
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
