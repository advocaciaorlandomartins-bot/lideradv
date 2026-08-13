"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { Callout } from "./callout-extension";
import { SignatureLine } from "./signature-line-extension";
import { blocksToTiptapDoc, tiptapDocToBlocks } from "./tiptap-adapter";
import EditorToolbar from "./editor-toolbar";
import type { Block } from "@/lib/modelo-blocks";
import "./block-editor.css";

export interface BlockEditorHandle {
  insertVariable: (tag: string) => void;
}

interface Props {
  initialBlocks: Block[] | null;
  onChange: (blocks: Block[]) => void;
}

const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor(
  { initialBlocks, onChange },
  ref
) {
  const [, tick] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        codeBlock: false,
        strike: false,
        code: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      SignatureLine,
      Placeholder.configure({
        placeholder: "Digite o conteúdo do documento...",
      }),
    ],
    content:
      initialBlocks && initialBlocks.length > 0
        ? blocksToTiptapDoc(initialBlocks)
        : "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(tiptapDocToBlocks(editor.getJSON())),
    onSelectionUpdate: () => tick((n) => n + 1),
    onTransaction: () => tick((n) => n + 1),
  });

  useImperativeHandle(
    ref,
    () => ({
      insertVariable: (tag: string) => {
        editor?.chain().focus().insertContent(tag).run();
      },
    }),
    [editor]
  );

  return (
    <div className="rounded-lg border border-border bg-white">
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="modelo-editor-content max-h-[560px] min-h-[420px] overflow-y-auto px-4 py-3 font-body text-sm leading-relaxed text-fg"
      />
    </div>
  );
});

export default BlockEditor;
