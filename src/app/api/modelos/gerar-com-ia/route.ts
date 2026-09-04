import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import {
  extractPdfContent,
  isSupportedImage,
  type ContentPart,
} from "@/lib/pdf-extract";
import { isValidBlocks, type Block } from "@/lib/modelo-blocks";
import { VARIAVEIS, CATEGORIAS } from "@/lib/modelo-variaveis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAGS_DISPONIVEIS = VARIAVEIS.flatMap((g) =>
  g.vars.map((v) => `${v.tag} (${v.desc})`)
).join(", ");

const PROMPT = `Você é um assistente jurídico que transforma um documento de exemplo em um MODELO reutilizável para um sistema de gestão de escritório de advocacia.

Tarefas:
1. Leia o documento de exemplo (texto, PDF ou imagem) fornecido.
2. Identifique trechos que representam dados específicos de uma pessoa (nome, CPF/CNPJ, RG, endereço, e-mail, telefone, data de nascimento, profissão, estado civil, nacionalidade, dados do responsável legal etc.) e substitua CADA ocorrência pela variável exata correspondente da lista abaixo — NUNCA invente uma tag que não esteja na lista, e NUNCA deixe o dado real da pessoa do exemplo no texto.
3. Reconstrua o restante do documento (cláusulas, títulos, avisos legais) como blocos estruturados, preservando **ao máximo a redação original, inclusive a estrutura** — não resuma, não parafraseie e não corte texto do exemplo.
4. Cláusulas numeradas/tituladas ou destacadas visualmente no original (avisos, seções com borda) viram blocos "callout", com o título da cláusula em "title".
   - **Caixas em formato PERGUNTA/RESPOSTA são o caso mais importante de preservar literalmente**: se o exemplo tem uma pergunta seguida da resposta (ex: "PERGUNTA: ...? RESPOSTA: ..."), o bloco "callout" tem que manter as DUAS partes dentro de "spans" — a pergunta em negrito seguida da resposta, exatamente como no original (pode usar "title" para o título da cláusula, tipo "A) BENEFÍCIO PARCIAL...", mas a pergunta em si NUNCA vira só o "title" no lugar do texto — ela tem que continuar aparecendo por extenso dentro do corpo, com a resposta logo depois). NUNCA rebaixe uma caixa pergunta/resposta pra um "paragraph" comum nem apague a pergunta.
5. Títulos de seção viram blocos "heading" (level 1 para o título principal do documento, 2 para seções, 3 para subseções).
6. Uma linha para assinatura (traço + "Nome/Outorgante" etc.) vira um bloco "signatureLine" com "label" apropriado.
7. Sugira um "titulo" curto para o modelo e uma "categoria" dentre exatamente estas opções: ${CATEGORIAS.join(", ")}.
8. **NUNCA use a propriedade "color" em bloco ou span nenhum** — o documento final é sempre preto e branco, sem cor de destaque em texto, título ou callout. Não inclua esse campo na resposta, mesmo que o exemplo original tenha cor.

Variáveis disponíveis (use exatamente estas tags): ${TAGS_DISPONIVEIS}

Responda SOMENTE com um JSON no formato:
{
  "titulo": "string",
  "categoria": "uma das opções listadas ou null",
  "blocks": [ ... ]
}

Onde cada item de "blocks" segue um destes formatos:
{ "type": "paragraph", "align": "left|center|right|justify" (opcional), "spans": [ { "text": "...", "bold": true|false, "italic": true|false, "underline": true|false } ] }
{ "type": "heading", "level": 1|2|3, "spans": [ ...spans ] }
{ "type": "list", "ordered": true|false, "items": [ [ ...spans ], [ ...spans ] ] }
{ "type": "divider" }
{ "type": "table", "rows": [ [ [ ...spans ], [ ...spans ] ] ] }
{ "type": "callout", "title": "string" (opcional), "spans": [ ...spans ] }
{ "type": "signatureLine", "label": "string" }

Não inclua nenhum texto fora do JSON.`;

interface AiTemplateResult {
  titulo: string;
  categoria: string | null;
  blocks: Block[];
}

function parseResult(raw: string): AiTemplateResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      !parsed ||
      typeof parsed.titulo !== "string" ||
      !isValidBlocks(parsed.blocks)
    ) {
      return null;
    }
    const categoria =
      typeof parsed.categoria === "string" &&
      (CATEGORIAS as readonly string[]).includes(parsed.categoria)
        ? parsed.categoria
        : null;
    return { titulo: parsed.titulo, categoria, blocks: parsed.blocks };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "criar"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY não configurada no servidor. Adicione-a ao .env.local.",
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const texto = ((formData.get("texto") as string) ?? "").trim();

  if (!file && !texto) {
    return NextResponse.json(
      { error: "Envie um arquivo ou cole o texto do exemplo." },
      { status: 400 }
    );
  }

  let content: ContentPart[];

  if (file) {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`,
        },
        { status: 422 }
      );
    }

    const fileType = file.type === "image/jpg" ? "image/jpeg" : file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isSupportedImage(fileType)) {
      content = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: fileType,
            data: buffer.toString("base64"),
          },
        },
        { type: "text", text: PROMPT },
      ];
    } else if (fileType === "application/pdf") {
      try {
        content = await extractPdfContent(buffer, PROMPT, 4);
      } catch (e) {
        console.error("gerar-com-ia PDF processing error:", e);
        return NextResponse.json(
          {
            error:
              "Não foi possível processar o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.",
          },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: `Formato não suportado: ${fileType}. Use JPEG, PNG, WebP, GIF, PDF ou cole o texto.`,
        },
        { status: 422 }
      );
    }
  } else {
    content = [
      {
        type: "text",
        text: `Texto do documento de exemplo:\n\n${texto}\n\n${PROMPT}`,
      },
    ];
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    });
    const block = res.content[0];
    const rawText = block?.type === "text" ? block.text : "";

    const result = parseResult(rawText);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "A IA não retornou um modelo válido. Tente novamente ou com um exemplo mais claro.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    console.error(
      "gerar-com-ia error:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro ao gerar modelo com IA. Tente novamente." },
      { status: 500 }
    );
  }
}
