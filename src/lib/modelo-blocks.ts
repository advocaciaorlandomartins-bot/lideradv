/**
 * Schema estruturado do conteúdo de um modelo de documento — substitui o
 * antigo texto puro por uma árvore de blocos que suporta negrito, itálico,
 * sublinhado, cor, alinhamento, títulos, listas, tabelas, caixas destacadas
 * (callout) e linhas de assinatura. É o contrato único usado pelo editor
 * (Tiptap), pelo renderer de PDF e pela geração de modelo via IA.
 */

export type FontFamily = "Times" | "Arial" | "Courier";

const FONT_FAMILIES: FontFamily[] = ["Times", "Arial", "Courier"];

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  /** Cor de destaque atrás do texto (marca-texto). */
  highlight?: string;
  /** Família tipográfica do trecho — se ausente, usa a fonte padrão do escritório. */
  font?: FontFamily;
}

export type Align = "left" | "center" | "right" | "justify";

export type Block =
  | { type: "paragraph"; align?: Align; spans: TextSpan[] }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      align?: Align;
      color?: string;
      spans: TextSpan[];
    }
  | { type: "list"; ordered?: boolean; items: TextSpan[][] }
  | { type: "divider" }
  | { type: "table"; rows: TextSpan[][][] }
  | { type: "callout"; title?: string; color?: string; spans: TextSpan[] }
  | { type: "signatureLine"; label: string };

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

function isTextSpan(v: unknown): v is TextSpan {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.text !== "string") return false;
  if (s.bold !== undefined && typeof s.bold !== "boolean") return false;
  if (s.italic !== undefined && typeof s.italic !== "boolean") return false;
  if (s.underline !== undefined && typeof s.underline !== "boolean")
    return false;
  if (s.color !== undefined && !isValidHexColor(s.color)) return false;
  if (s.highlight !== undefined && !isValidHexColor(s.highlight)) return false;
  if (s.font !== undefined && !FONT_FAMILIES.includes(s.font as FontFamily))
    return false;
  return true;
}

function isSpanArray(v: unknown): v is TextSpan[] {
  return Array.isArray(v) && v.every(isTextSpan);
}

const ALIGNS: Align[] = ["left", "center", "right", "justify"];

function isBlock(v: unknown): v is Block {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;

  switch (b.type) {
    case "paragraph":
      if (b.align !== undefined && !ALIGNS.includes(b.align as Align))
        return false;
      return isSpanArray(b.spans);
    case "heading":
      if (![1, 2, 3].includes(b.level as number)) return false;
      if (b.align !== undefined && !ALIGNS.includes(b.align as Align))
        return false;
      if (b.color !== undefined && !isValidHexColor(b.color)) return false;
      return isSpanArray(b.spans);
    case "list":
      if (b.ordered !== undefined && typeof b.ordered !== "boolean")
        return false;
      return Array.isArray(b.items) && b.items.every(isSpanArray);
    case "divider":
      return true;
    case "table":
      return (
        Array.isArray(b.rows) &&
        b.rows.every(
          (row) => Array.isArray(row) && row.every((cell) => isSpanArray(cell))
        )
      );
    case "callout":
      if (b.title !== undefined && typeof b.title !== "string") return false;
      if (b.color !== undefined && !isValidHexColor(b.color)) return false;
      return isSpanArray(b.spans);
    case "signatureLine":
      return typeof b.label === "string";
    default:
      return false;
  }
}

/** Type-guard defensivo — usado ao ler do banco e ao receber saída da IA. */
export function isValidBlocks(value: unknown): value is Block[] {
  return Array.isArray(value) && value.every(isBlock);
}

/** Mirror em texto plano — usado no contador de caracteres da listagem. */
export function flattenBlocksToText(blocks: Block[]): string {
  const spansToText = (spans: TextSpan[]) => spans.map((s) => s.text).join("");

  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "heading":
        case "callout":
          return spansToText(b.spans);
        case "list":
          return b.items.map((item) => spansToText(item)).join("\n");
        case "table":
          return b.rows
            .map((row) => row.map((cell) => spansToText(cell)).join(" "))
            .join("\n");
        case "divider":
          return "";
        case "signatureLine":
          return b.label;
      }
    })
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/**
 * Substitui {{variavel}} pelo valor correspondente em cada TextSpan,
 * retornando uma cópia dos blocos (não muta o original).
 */
export function substituteVariablesInBlocks(
  blocks: Block[],
  vars: Record<string, string>
): Block[] {
  const replaceInText = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      result = result.split(key).join(value);
    }
    return result;
  };

  const replaceInSpans = (spans: TextSpan[]): TextSpan[] =>
    spans.map((s) => ({ ...s, text: replaceInText(s.text) }));

  return blocks.map((b): Block => {
    switch (b.type) {
      case "paragraph":
        return { ...b, spans: replaceInSpans(b.spans) };
      case "heading":
        return { ...b, spans: replaceInSpans(b.spans) };
      case "callout":
        return { ...b, spans: replaceInSpans(b.spans) };
      case "list":
        return { ...b, items: b.items.map(replaceInSpans) };
      case "table":
        return { ...b, rows: b.rows.map((row) => row.map(replaceInSpans)) };
      case "divider":
        return b;
      case "signatureLine":
        return { ...b, label: replaceInText(b.label) };
    }
  });
}
