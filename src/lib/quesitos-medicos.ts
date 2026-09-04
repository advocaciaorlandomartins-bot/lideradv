import "server-only";
import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface DocumentoParaAnalise {
  nome: string;
  mimeType: string;
  base64: string;
}

export interface QuesitosResultado {
  quesitos: string[];
  briefingAdvogado: string;
  resumoCliente: string;
  raw: string;
}

/**
 * Lê petição inicial + laudo do INSS + exames (já anexados ao processo, o
 * usuário escolhe quais) e gera quesitos médicos complementares estratégicos
 * pra perícia judicial — indo além dos quesitos padrão, explorando as
 * fragilidades do laudo administrativo e reforçando pontos favoráveis ao
 * segurado presentes nos exames. Também gera um briefing técnico pro
 * advogado e um resumo em linguagem simples pro cliente se preparar.
 */
export async function gerarQuesitosMedicos(
  documentos: DocumentoParaAnalise[],
  contexto: { tipoAcao?: string | null; clienteNome?: string | null }
): Promise<QuesitosResultado> {
  if (documentos.length === 0) {
    throw new Error("Nenhum documento selecionado.");
  }

  const client = getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = documentos.map((d) => {
    if (d.mimeType.startsWith("image/")) {
      return {
        type: "image",
        source: { type: "base64", media_type: d.mimeType, data: d.base64 },
      };
    }
    if (d.mimeType === "application/pdf") {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: d.base64,
        },
      };
    }
    throw new Error(`Tipo de arquivo não suportado: ${d.mimeType}`);
  });
  const temPdf = documentos.some((d) => d.mimeType === "application/pdf");
  const nomesLista = documentos.map((d) => d.nome).join(", ");

  const res = await client.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system:
        "Você é o Dr. Lex, especialista em Direito Previdenciário brasileiro, com foco em perícias médicas do INSS. Sua tarefa é analisar os documentos anexados (petição inicial, laudo/parecer administrativo do INSS, exames médicos) e gerar quesitos médicos complementares estratégicos para a perícia judicial — específicos ao caso concreto, não genéricos, explorando fragilidades do laudo administrativo e reforçando achados favoráveis ao segurado presentes nos exames.",
      messages: [
        {
          role: "user",
          content: [
            ...blocks,
            {
              type: "text",
              text: `Documentos anexados: ${nomesLista}
${contexto.clienteNome ? `Cliente: ${contexto.clienteNome}\n` : ""}${contexto.tipoAcao ? `Tipo de ação: ${contexto.tipoAcao}\n` : ""}
Gere:
1. Uma lista de 5 a 12 quesitos médicos complementares, específicos ao caso — cada um explorando algo concreto identificado nos documentos (um CID, uma limitação relatada, uma divergência entre o laudo do INSS e os exames, etc). Não repita quesitos genéricos de praxe que não usam nada do documento.
2. Um briefing técnico curto (2-4 parágrafos) pro advogado, explicando a estratégia por trás dos quesitos e o que observar na perícia.
3. Um resumo em linguagem simples, sem jargão médico ou jurídico, pra explicar ao cliente o que esperar da perícia e como se preparar.

Retorne APENAS um JSON com a estrutura EXATA abaixo (nenhum texto fora do JSON, sem markdown fences):
{
  "quesitos": ["quesito 1", "quesito 2"],
  "briefing_advogado": "texto",
  "resumo_cliente": "texto"
}`,
            },
          ],
        },
      ],
    },
    temPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : undefined
  );

  const fullText = res.content[0]?.type === "text" ? res.content[0].text : "{}";

  // Normaliza um item de "quesitos" pra string legível mesmo se a IA
  // devolver um objeto em vez de string (ex: {texto: "..."}) — sem isso
  // vira literalmente o texto "[object Object]" mostrado ao usuário.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function textoDoItem(item: any): string {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const candidato =
        item.texto ?? item.text ?? item.quesito ?? item.pergunta ?? null;
      if (typeof candidato === "string") return candidato;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }
    return String(item);
  }

  try {
    const match = fullText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? fullText) as {
      quesitos?: unknown;
      briefing_advogado?: unknown;
      resumo_cliente?: unknown;
    };
    return {
      quesitos: Array.isArray(parsed.quesitos)
        ? parsed.quesitos.map(textoDoItem)
        : [],
      briefingAdvogado: String(parsed.briefing_advogado ?? ""),
      resumoCliente: String(parsed.resumo_cliente ?? ""),
      raw: fullText,
    };
  } catch {
    return {
      quesitos: [],
      briefingAdvogado: fullText,
      resumoCliente: "",
      raw: fullText,
    };
  }
}
