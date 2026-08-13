"use client";

import type { Editor } from "@tiptap/react";
import type { FontFamily } from "@/lib/modelo-blocks";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
  ListBulletIcon,
  OrderedListIcon,
  HighlighterIcon,
  TableCellsIcon,
  SquareStackIcon,
  MinusIcon,
  PenSignIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

interface Props {
  editor: Editor | null;
}

const btnBase =
  "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-slate-100 hover:text-fg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";
const btnActive = "bg-blue-50 text-primary hover:bg-blue-50 hover:text-primary";
const FONTS: FontFamily[] = ["Times", "Arial", "Courier"];

export default function EditorToolbar({ editor }: Props) {
  if (!editor) return null;

  const isCallout = editor.isActive("callout");
  const calloutAttrs = editor.getAttributes("callout");
  const isTable = editor.isActive("table");
  const currentFont = (editor.getAttributes("textStyle").fontFamily ??
    "") as string;
  const currentBlockValue = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : editor.isActive("callout")
          ? "callout"
          : editor.isActive("signatureLine")
            ? "signature"
            : "paragraph";

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <select
          value={currentBlockValue}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "paragraph") chain.setParagraph().run();
            else if (v === "h1") chain.setHeading({ level: 1 }).run();
            else if (v === "h2") chain.setHeading({ level: 2 }).run();
            else if (v === "h3") chain.setHeading({ level: 3 }).run();
            else if (v === "callout")
              chain.setCallout({ color: "#1E3A8A" }).run();
            else if (v === "signature") chain.setSignatureLine().run();
          }}
          className="h-8 cursor-pointer rounded-md border border-border bg-white px-2 font-body text-xs font-semibold text-fg outline-none focus:border-primary"
        >
          <option value="paragraph">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="callout">Caixa destacada</option>
          <option value="signature">Linha de assinatura</option>
        </select>

        <select
          title="Fonte do trecho selecionado"
          value={FONTS.includes(currentFont as FontFamily) ? currentFont : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontFamily(v).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          className="h-8 cursor-pointer rounded-md border border-border bg-white px-2 font-body text-xs font-semibold text-fg outline-none focus:border-primary"
        >
          <option value="">Fonte padrão</option>
          <option value="Times">Times</option>
          <option value="Arial">Arial</option>
          <option value="Courier">Courier</option>
        </select>

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          title="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${btnBase} ${editor.isActive("bold") ? btnActive : ""}`}
        >
          <BoldIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${btnBase} ${editor.isActive("italic") ? btnActive : ""}`}
        >
          <ItalicIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Sublinhado"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${btnBase} ${editor.isActive("underline") ? btnActive : ""}`}
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <label
          title="Cor do texto"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100"
        >
          <input
            type="color"
            value={editor.getAttributes("textStyle").color ?? "#1a1a1a"}
            onChange={(e) => editor.chain().setColor(e.target.value).run()}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <label
          title="Marca-texto (destacar trecho)"
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100 ${editor.isActive("highlight") ? btnActive : ""}`}
        >
          <HighlighterIcon className="h-4 w-4" />
          <input
            type="color"
            value={editor.getAttributes("highlight").color ?? "#fff3a3"}
            onChange={(e) =>
              editor.chain().setHighlight({ color: e.target.value }).run()
            }
            className="hidden"
          />
        </label>
        {editor.isActive("highlight") && (
          <button
            type="button"
            title="Remover marca-texto"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            className={btnBase}
          >
            <MinusIcon className="h-4 w-4" />
          </button>
        )}

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          title="Alinhar à esquerda"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`${btnBase} ${editor.isActive({ textAlign: "left" }) ? btnActive : ""}`}
        >
          <AlignLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Centralizar"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`${btnBase} ${editor.isActive({ textAlign: "center" }) ? btnActive : ""}`}
        >
          <AlignCenterIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Alinhar à direita"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`${btnBase} ${editor.isActive({ textAlign: "right" }) ? btnActive : ""}`}
        >
          <AlignRightIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Justificar"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`${btnBase} ${editor.isActive({ textAlign: "justify" }) ? btnActive : ""}`}
        >
          <AlignJustifyIcon className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          title="Lista com marcadores"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${btnBase} ${editor.isActive("bulletList") ? btnActive : ""}`}
        >
          <ListBulletIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${btnBase} ${editor.isActive("orderedList") ? btnActive : ""}`}
        >
          <OrderedListIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Inserir tabela"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 2, withHeaderRow: false })
              .run()
          }
          className={btnBase}
        >
          <TableCellsIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Caixa destacada"
          onClick={() =>
            editor.chain().focus().setCallout({ color: "#1E3A8A" }).run()
          }
          className={`${btnBase} ${isCallout ? btnActive : ""}`}
        >
          <SquareStackIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Linha de assinatura"
          onClick={() => editor.chain().focus().setSignatureLine().run()}
          className={`${btnBase} ${editor.isActive("signatureLine") ? btnActive : ""}`}
        >
          <PenSignIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Divisor"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={btnBase}
        >
          <MinusIcon className="h-4 w-4" />
        </button>
      </div>

      {isCallout && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
          <label className="flex items-center gap-1.5 font-body text-xs text-muted">
            Cor da caixa
            <input
              type="color"
              value={calloutAttrs.color ?? "#1E3A8A"}
              onChange={(e) =>
                editor
                  .chain()
                  .updateAttributes("callout", { color: e.target.value })
                  .run()
              }
              className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <input
            type="text"
            placeholder="Título da caixa (opcional)"
            value={calloutAttrs.title ?? ""}
            onChange={(e) =>
              editor
                .chain()
                .updateAttributes("callout", { title: e.target.value || null })
                .run()
            }
            className="h-7 min-w-[160px] flex-1 rounded-md border border-border bg-white px-2 font-body text-xs text-fg outline-none focus:border-primary"
          />
        </div>
      )}

      {isTable && (
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-slate-50 px-2 py-1.5">
          <span className="font-body text-xs font-semibold text-muted mr-1">
            Tabela:
          </span>
          <button
            type="button"
            title="Adicionar linha acima"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-fg hover:bg-white cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Linha ↑
          </button>
          <button
            type="button"
            title="Adicionar linha abaixo"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-fg hover:bg-white cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Linha ↓
          </button>
          <button
            type="button"
            title="Excluir linha"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-red-600 hover:bg-white cursor-pointer"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Linha
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            title="Adicionar coluna à esquerda"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-fg hover:bg-white cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Coluna ←
          </button>
          <button
            type="button"
            title="Adicionar coluna à direita"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-fg hover:bg-white cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Coluna →
          </button>
          <button
            type="button"
            title="Excluir coluna"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-red-600 hover:bg-white cursor-pointer"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Coluna
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            title="Excluir tabela"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-body text-xs text-red-600 hover:bg-white cursor-pointer"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Tabela
          </button>
        </div>
      )}
    </div>
  );
}
