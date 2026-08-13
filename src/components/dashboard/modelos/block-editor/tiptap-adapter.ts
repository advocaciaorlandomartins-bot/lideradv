/**
 * Ponte entre o schema interno do Tiptap/ProseMirror e o nosso contrato
 * Block[]/TextSpan (src/lib/modelo-blocks.ts) — o JSON do Tiptap NUNCA é
 * gravado no banco diretamente, só passa por aqui.
 */
import type { JSONContent } from "@tiptap/core";
import type { Align, Block, FontFamily, TextSpan } from "@/lib/modelo-blocks";
import { isValidHexColor } from "@/lib/modelo-blocks";

const ALIGNS: Align[] = ["left", "center", "right", "justify"];
const FONT_FAMILIES: FontFamily[] = ["Times", "Arial", "Courier"];

function alignFromAttrs(attrs?: Record<string, unknown>): Align | undefined {
  const a = attrs?.textAlign;
  return typeof a === "string" && ALIGNS.includes(a as Align)
    ? (a as Align)
    : undefined;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

function inlineContentToSpans(content?: JSONContent[]): TextSpan[] {
  const spans: TextSpan[] = [];
  for (const node of content ?? []) {
    if (node.type === "text" && node.text) {
      const span: TextSpan = { text: node.text };
      for (const mark of (node.marks ?? []) as TiptapMark[]) {
        if (mark.type === "bold") span.bold = true;
        else if (mark.type === "italic") span.italic = true;
        else if (mark.type === "underline") span.underline = true;
        else if (mark.type === "textStyle") {
          if (isValidHexColor(mark.attrs?.color))
            span.color = mark.attrs!.color as string;
          const family = mark.attrs?.fontFamily;
          if (
            typeof family === "string" &&
            FONT_FAMILIES.includes(family as FontFamily)
          )
            span.font = family as FontFamily;
        } else if (
          mark.type === "highlight" &&
          isValidHexColor(mark.attrs?.color)
        ) {
          span.highlight = mark.attrs!.color as string;
        }
      }
      spans.push(span);
    } else if (node.type === "hardBreak") {
      spans.push({ text: "\n" });
    }
  }
  return spans;
}

function spansToInlineContent(spans: TextSpan[]): JSONContent[] {
  return spans
    .filter((s) => s.text.length > 0)
    .map((s) => {
      const marks: NonNullable<JSONContent["marks"]> = [];
      if (s.bold) marks.push({ type: "bold" });
      if (s.italic) marks.push({ type: "italic" });
      if (s.underline) marks.push({ type: "underline" });
      if (s.color || s.font) {
        marks.push({
          type: "textStyle",
          attrs: {
            ...(s.color ? { color: s.color } : {}),
            ...(s.font ? { fontFamily: s.font } : {}),
          },
        });
      }
      if (s.highlight) {
        marks.push({ type: "highlight", attrs: { color: s.highlight } });
      }
      return {
        type: "text",
        text: s.text,
        ...(marks.length ? { marks } : {}),
      };
    });
}

function cellSpans(cell: JSONContent): TextSpan[] {
  const para = cell.content?.find((c) => c.type === "paragraph");
  return inlineContentToSpans(para?.content);
}

export function tiptapDocToBlocks(doc: JSONContent): Block[] {
  const blocks: Block[] = [];

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "paragraph":
        blocks.push({
          type: "paragraph",
          align: alignFromAttrs(node.attrs),
          spans: inlineContentToSpans(node.content),
        });
        break;

      case "heading": {
        const level = node.attrs?.level;
        blocks.push({
          type: "heading",
          level: level === 2 || level === 3 ? level : 1,
          align: alignFromAttrs(node.attrs),
          spans: inlineContentToSpans(node.content),
        });
        break;
      }

      case "bulletList":
      case "orderedList":
        blocks.push({
          type: "list",
          ordered: node.type === "orderedList",
          items: (node.content ?? []).map((li) => cellSpans(li)),
        });
        break;

      case "horizontalRule":
        blocks.push({ type: "divider" });
        break;

      case "table":
        blocks.push({
          type: "table",
          rows: (node.content ?? []).map((row) =>
            (row.content ?? []).map((cell) => cellSpans(cell))
          ),
        });
        break;

      case "callout": {
        const color = node.attrs?.color;
        const title = node.attrs?.title;
        blocks.push({
          type: "callout",
          title: typeof title === "string" && title ? title : undefined,
          color: isValidHexColor(color) ? color : undefined,
          spans: inlineContentToSpans(node.content),
        });
        break;
      }

      case "signatureLine":
        blocks.push({
          type: "signatureLine",
          label: inlineContentToSpans(node.content)
            .map((s) => s.text)
            .join(""),
        });
        break;
    }
  }

  return blocks;
}

export function blocksToTiptapDoc(blocks: Block[]): JSONContent {
  const content: JSONContent[] = blocks.map((b): JSONContent => {
    switch (b.type) {
      case "paragraph":
        return {
          type: "paragraph",
          ...(b.align ? { attrs: { textAlign: b.align } } : {}),
          content: spansToInlineContent(b.spans),
        };

      case "heading":
        return {
          type: "heading",
          attrs: { level: b.level, ...(b.align ? { textAlign: b.align } : {}) },
          content: spansToInlineContent(b.spans),
        };

      case "list":
        return {
          type: b.ordered ? "orderedList" : "bulletList",
          content: b.items.map((item) => ({
            type: "listItem",
            content: [
              { type: "paragraph", content: spansToInlineContent(item) },
            ],
          })),
        };

      case "divider":
        return { type: "horizontalRule" };

      case "table":
        return {
          type: "table",
          content: b.rows.map((row) => ({
            type: "tableRow",
            content: row.map((cell) => ({
              type: "tableCell",
              content: [
                { type: "paragraph", content: spansToInlineContent(cell) },
              ],
            })),
          })),
        };

      case "callout":
        return {
          type: "callout",
          attrs: { color: b.color ?? "#1E3A8A", title: b.title ?? null },
          content: spansToInlineContent(b.spans),
        };

      case "signatureLine":
        return {
          type: "signatureLine",
          content: b.label ? [{ type: "text", text: b.label }] : [],
        };
    }
  });

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}
