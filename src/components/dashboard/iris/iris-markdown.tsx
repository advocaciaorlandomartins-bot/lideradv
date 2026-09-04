"use client";

/**
 * Renderizador de markdown leve pras respostas da Íris — sem dependência
 * nova, cobre só o subconjunto que o prompt pede pra usar: títulos (##/###),
 * **negrito**, listas numeradas/com marcador e parágrafos.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={`${keyPrefix}-${i}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={`${keyPrefix}-${i}`}>{part}</span>;
    });
}

interface Line {
  type: "h2" | "h3" | "ul" | "ol" | "p";
  text: string;
}

function parseLines(raw: string): Line[] {
  const lines = raw.split("\n");
  const out: Line[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("### ")) out.push({ type: "h3", text: t.slice(4) });
    else if (t.startsWith("## ")) out.push({ type: "h2", text: t.slice(3) });
    else if (/^[-*]\s+/.test(t))
      out.push({ type: "ul", text: t.replace(/^[-*]\s+/, "") });
    else if (/^\d+[.)]\s+/.test(t))
      out.push({ type: "ol", text: t.replace(/^\d+[.)]\s+/, "") });
    else out.push({ type: "p", text: t });
  }
  return out;
}

export default function IrisMarkdown({ content }: { content: string }) {
  const lines = parseLines(content);
  if (lines.length === 0) return null;

  const blocks: React.ReactNode[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushList(key: string) {
    if (!listBuffer) return;
    const ListTag = listBuffer.type === "ul" ? "ul" : "ol";
    blocks.push(
      <ListTag
        key={key}
        className={
          listBuffer.type === "ul"
            ? "list-disc space-y-0.5 pl-5"
            : "list-decimal space-y-0.5 pl-5"
        }
      >
        {listBuffer.items.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>
        ))}
      </ListTag>
    );
    listBuffer = null;
  }

  lines.forEach((line, i) => {
    if (line.type === "ul" || line.type === "ol") {
      if (listBuffer && listBuffer.type !== line.type) flushList(`list-${i}`);
      if (!listBuffer) listBuffer = { type: line.type, items: [] };
      listBuffer.items.push(line.text);
      return;
    }
    flushList(`list-${i}`);
    if (line.type === "h2")
      blocks.push(
        <h2 key={i} className="mt-1 font-bold text-[0.95em]">
          {renderInline(line.text, `h-${i}`)}
        </h2>
      );
    else if (line.type === "h3")
      blocks.push(
        <h3 key={i} className="mt-1 font-semibold text-[0.92em]">
          {renderInline(line.text, `h-${i}`)}
        </h3>
      );
    else blocks.push(<p key={i}>{renderInline(line.text, `p-${i}`)}</p>);
  });
  flushList("list-end");

  return <div className="space-y-1.5">{blocks}</div>;
}
