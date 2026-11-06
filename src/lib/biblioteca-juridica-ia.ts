import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { extractText } from "./anthropic-text";
import { extractPdfContent, extractPdfText } from "./pdf-extract";
import type { BibliotecaCategoria } from "./biblioteca-juridica-db";

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Mesma lista de códigos de benefício usada nos formulários de processo
// (new-processo-form.tsx e afins) — não existe um export compartilhado
// hoje, copiado aqui só pra orientar a IA sobre quais códigos são válidos
// (ela nunca deveria inventar um código fora dessa lista).
const CODIGOS_BENEFICIO = [
  "B21 - Pensão por morte",
  "B25 - Auxílio-reclusão",
  "B31 - Auxílio por Incapacidade Temporária",
  "B32 - Auxílio por Incapacidade Permanente",
  "B41 - Aposentadoria por idade",
  "B42 - Aposentadoria por tempo de contribuição",
  "B46 - Aposentadoria especial",
  "B80 - Salário Maternidade",
  "B87 - BPC à pessoa com deficiência",
  "B88 - BPC à pessoa idosa",
  "B91 - Auxílio por Incapacidade Temporária Acidentário",
  "B92 - Auxílio por Incapacidade Permanente Acidentário",
  "B94 - Auxílio-acidente",
  "CP - Complemento Positivo",
];

export interface ClassificacaoBiblioteca {
  categoria: BibliotecaCategoria;
  nomeSugerido: string | null;
  resumo: string | null;
  area: string | null;
  tipoPeticao: string | null;
  tribunal: string | null;
  identificacao: string | null;
  tese: string | null;
  beneficiosAplicaveis: string[];
  observacao: string | null;
  textoExtraido: string | null;
  raw: string;
}

const PROMPT = `Você é um assistente jurídico especializado em Direito Previdenciário brasileiro, ajudando a organizar a Biblioteca Jurídica de um escritório. Leia o documento anexado e classifique em UMA das três categorias:

- "modelo_peticao": uma PEÇA PROCESSUAL redigida pelo próprio escritório/advogado (petição inicial, contestação, recurso, impugnação, embargos, manifestação etc) — serve de referência de estilo e argumentação pra casos futuros do mesmo tipo.
- "precedente": uma DECISÃO JUDICIAL (sentença, acórdão, voto, decisão monocrática) que reconhece ou nega direito de um segurado/beneficiário — pode servir de jurisprudência pra fundamentar casos semelhantes.
- "outro": não se encaixa em nenhuma das duas (ex: documento do processo administrativo, laudo médico, procuração, print de sistema etc).

Códigos de benefício válidos (use EXATAMENTE o código antes do hífen, ex: "B87"; nunca invente um código fora desta lista; pode listar mais de um se a peça/decisão se aplicar a mais de um):
${CODIGOS_BENEFICIO.join("\n")}

Retorne APENAS um JSON com a estrutura EXATA abaixo (nenhum texto fora do JSON, sem markdown fences). Preencha só os campos relevantes pra categoria escolhida; deixe null os que não se aplicam.
{
  "categoria": "modelo_peticao" | "precedente" | "outro",
  "nome_sugerido": "nome de arquivo descritivo (sem extensão, até 80 caracteres), ex: 'Modelo - Impugnacao Laudo Pericial - Auxilio Incapacidade' ou 'Precedente - TNU Tema 376 - BPC LOAS Autismo TEA'",
  "resumo": "1-2 frases descrevendo o documento",
  "area": "só se categoria=modelo_peticao: área do direito, ex: 'previdenciario'",
  "tipo_peticao": "só se categoria=modelo_peticao: tipo da peça, ex: 'Petição Inicial', 'Impugnação ao Laudo Pericial', 'Recurso Inominado'",
  "tribunal": "só se categoria=precedente: órgão julgador exato (ex: 'TNU', 'STF', 'STJ', 'TRF5', ou a vara/juízo se for sentença de 1º grau)",
  "identificacao": "só se categoria=precedente: a citação exata que deveria aparecer numa petição (ex: 'Tema 376/TNU', 'RE 580963/STF', ou número do processo se for sentença de vara sem tema afetado)",
  "tese": "só se categoria=precedente: a tese/entendimento jurídico em texto corrido, pronto pra citar numa petição — não copie o acórdão inteiro, só a ratio decidendi",
  "beneficios_aplicaveis": ["códigos da lista acima, ex: B87"],
  "observacao": "só se categoria=precedente: contexto extra relevante (data de julgamento, se é vinculante, se houve modulação de efeitos etc), ou null"
}`;

/**
 * Lê o documento (PDF digital via texto extraído, ou PDF escaneado/imagem
 * via screenshot das páginas — mesmo fallback já usado em
 * modelos/gerar-com-ia) e devolve a classificação + extração sugeridas.
 * NUNCA grava nada sozinho — isso é sempre um rascunho pra revisão humana
 * (ver aprovarItemBiblioteca em biblioteca-juridica-db.ts).
 */
export async function classificarDocumentoBiblioteca(
  buffer: Buffer,
  mimeType: string
): Promise<ClassificacaoBiblioteca> {
  const client = getClient();

  const content =
    mimeType === "application/pdf"
      ? await extractPdfContent(buffer, PROMPT, 4)
      : [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              media_type: mimeType as any,
              data: buffer.toString("base64"),
            },
          },
          { type: "text" as const, text: PROMPT },
        ];

  // Streaming + max_tokens generoso: mesma causa raiz já corrigida em
  // gerarImpugnacaoLaudo/gerarQuesitosMedicos — claude-sonnet-5 usa
  // thinking automaticamente mesmo sem o parâmetro `thinking`, e com
  // max_tokens baixo o raciocínio sozinho consome o limite antes de gerar
  // o JSON.
  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    messages: [{ role: "user", content }],
  });
  const res = await stream.finalMessage();

  const fullText = extractText(res);
  if (!fullText.trim()) {
    console.error("[classificarDocumentoBiblioteca] resposta sem texto", {
      stopReason: res.stop_reason,
      blockTypes: res.content.map((b) => b.type),
      usage: res.usage,
    });
    throw new Error(
      `A IA não retornou uma classificação (motivo: ${res.stop_reason ?? "desconhecido"}).`
    );
  }

  let parsed: Record<string, unknown>;
  try {
    const match = fullText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? fullText);
  } catch {
    throw new Error("A IA não retornou um JSON válido.");
  }

  const categoria = ["modelo_peticao", "precedente", "outro"].includes(
    String(parsed.categoria)
  )
    ? (parsed.categoria as BibliotecaCategoria)
    : "outro";

  const codigosValidos = new Set(
    CODIGOS_BENEFICIO.map((c) => c.split(" - ")[0])
  );
  const beneficiosAplicaveis = Array.isArray(parsed.beneficios_aplicaveis)
    ? parsed.beneficios_aplicaveis
        .map((b) => String(b).trim().toUpperCase())
        .filter((b) => codigosValidos.has(b))
    : [];

  const textoExtraido =
    categoria === "modelo_peticao" && mimeType === "application/pdf"
      ? (await extractPdfText(buffer).catch(() => "")) || null
      : null;

  return {
    categoria,
    nomeSugerido:
      typeof parsed.nome_sugerido === "string" ? parsed.nome_sugerido : null,
    resumo: typeof parsed.resumo === "string" ? parsed.resumo : null,
    area: typeof parsed.area === "string" ? parsed.area : null,
    tipoPeticao:
      typeof parsed.tipo_peticao === "string" ? parsed.tipo_peticao : null,
    tribunal: typeof parsed.tribunal === "string" ? parsed.tribunal : null,
    identificacao:
      typeof parsed.identificacao === "string" ? parsed.identificacao : null,
    tese: typeof parsed.tese === "string" ? parsed.tese : null,
    beneficiosAplicaveis,
    observacao:
      typeof parsed.observacao === "string" ? parsed.observacao : null,
    textoExtraido,
    raw: fullText,
  };
}
