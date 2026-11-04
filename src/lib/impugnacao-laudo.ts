import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { extractText } from "./anthropic-text";
import type { DocumentoParaAnalise } from "./quesitos-medicos";

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface VicioLaudo {
  resumo: string;
  trechoCitado: string;
  fundamento: string;
}

export interface ImpugnacaoLaudoResultado {
  vicios: VicioLaudo[];
  quesitosComplementares: string[];
  tesesJuridicas: string[];
  minutaImpugnacao: string;
  raw: string;
}

/**
 * Lê um laudo pericial judicial já realizado (e, opcionalmente, outros
 * documentos do processo anexados junto — petição inicial, laudo
 * administrativo do INSS, exames) e monta a base pra impugnar o laudo:
 * vícios/contradições concretos (com o trecho exato citado), quesitos de
 * esclarecimento pro perito, teses jurídicas e uma minuta da petição —
 * nos moldes do art. 480 c/c art. 477, §1º, do CPC. Não é quesito prévio
 * de praxe pra perícia que ainda vai acontecer (isso é gerarQuesitosMedicos,
 * em quesitos-medicos.ts) — este aqui pressupõe que a perícia JÁ ocorreu e
 * o laudo já foi juntado aos autos.
 */
export async function gerarImpugnacaoLaudo(
  documentos: DocumentoParaAnalise[],
  contexto: {
    clienteNome?: string | null;
    processoNumero?: string | null;
    tipoAcao?: string | null;
  }
): Promise<ImpugnacaoLaudoResultado> {
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
      max_tokens: 4000,
      system:
        "Você é o Dr. Lex, o melhor especialista em Direito Previdenciário brasileiro, com foco em perícia médica judicial. Sua tarefa é analisar um laudo pericial já realizado (SISPERJUD/CNJ ou formato livre) e, se houver, outros documentos do processo anexados junto, pra montar a base técnica e jurídica de uma impugnação ao laudo. Leia cada campo do laudo com rigor: campos obrigatórios deixados em branco, contradições entre a conclusão e os dados do próprio laudo (ex: doença classificada como grave mas prazo de recuperação fixado sem exame que o próprio perito diz não ter), datas-base inconsistentes com a documentação mais completa, sintomas relatados na anamnese sem o CID correspondente, respostas que ignoram anexos/benefícios anteriores do próprio processo, seções de quesitos do juízo deixadas em branco. Nunca aponte um vício que não esteja de fato no texto — cite o trecho exato entre aspas. Nunca invente ou arredonde número de lei, súmula, acórdão ou citação jurisprudencial — só cite base legal de que tenha certeza (ex: art. 480 e art. 477, §1º, do CPC; art. 60, §§8º-9º, e art. 26, II/art. 151 da Lei 8.213/91, quando pertinente); se não tiver certeza de uma citação mais específica, diga que precisa ser conferida antes de protocolar, em vez de inventar.",
      messages: [
        {
          role: "user",
          content: [
            ...blocks,
            {
              type: "text",
              text: `Documentos anexados: ${nomesLista}
${contexto.clienteNome ? `Cliente: ${contexto.clienteNome}\n` : ""}${contexto.processoNumero ? `Processo: ${contexto.processoNumero}\n` : ""}${contexto.tipoAcao ? `Tipo de ação: ${contexto.tipoAcao}\n` : ""}
Gere:
1. Uma lista de vícios/contradições concretos do laudo (3 a 10 itens) — cada um com um resumo do problema, o trecho exato citado do laudo (entre aspas) e o porquê isso enfraquece a conclusão pericial.
2. Uma lista de 5 a 10 quesitos complementares de esclarecimento, pra protocolar junto com a impugnação pedindo que o perito responda — cada um específico a um vício identificado, não genérico.
3. Uma lista de 3 a 6 teses jurídicas que sustentam o pedido de esclarecimentos/nova perícia, cada uma como uma frase única já citando o fundamento legal (artigo de lei/CPC) quando tiver certeza.
4. Uma minuta de petição de "Impugnação ao Laudo Pericial / Requerimento de Esclarecimentos", em português jurídico, com endereçamento genérico (deixe [Vara/Juízo], [número do processo] e [nome da parte] como placeholders caso não tenha certeza desses dados), estrutura clássica (síntese do laudo, dos vícios, dos quesitos complementares, dos fundamentos jurídicos, dos pedidos) — pronta pra o advogado revisar e protocolar, não um resumo.

Retorne APENAS um JSON com a estrutura EXATA abaixo (nenhum texto fora do JSON, sem markdown fences):
{
  "vicios": [{"resumo": "...", "trecho_citado": "...", "fundamento": "..."}],
  "quesitos_complementares": ["quesito 1", "quesito 2"],
  "teses_juridicas": ["tese 1", "tese 2"],
  "minuta_impugnacao": "texto completo da petição"
}`,
            },
          ],
        },
      ],
    },
    temPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : undefined
  );

  // Nunca cair silenciosamente num "{}" quando a API não devolve bloco de
  // texto — já aconteceu de verdade em produção (mesma causa raiz do bug
  // em gerarQuesitosMedicos) e o resultado virava "sucesso" com tudo vazio
  // (0 vícios, 0 quesitos, minuta vazia) sem nenhum erro visível. Melhor
  // falhar alto, com o stop_reason no log, do que devolver um resultado
  // que parece ok mas não serve pra nada.
  const fullText = extractText(res);
  if (!fullText.trim()) {
    console.error("[gerarImpugnacaoLaudo] resposta sem texto", {
      stopReason: res.stop_reason,
      blockTypes: res.content.map((b) => b.type),
      usage: res.usage,
    });
    throw new Error(
      `A IA não retornou uma análise (motivo: ${res.stop_reason ?? "desconhecido"}). Tente novamente — se persistir, tente com menos documentos selecionados.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function textoDoItem(item: any): string {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const candidato =
        item.texto ??
        item.text ??
        item.tese ??
        item.quesito ??
        item.pergunta ??
        null;
      if (typeof candidato === "string") return candidato;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }
    return String(item);
  }

  function vicioDoItem(item: unknown): VicioLaudo {
    if (item && typeof item === "object") {
      const v = item as Record<string, unknown>;
      return {
        resumo: String(v.resumo ?? v.texto ?? v.text ?? ""),
        trechoCitado: String(v.trecho_citado ?? v.trechoCitado ?? ""),
        fundamento: String(v.fundamento ?? ""),
      };
    }
    return { resumo: String(item), trechoCitado: "", fundamento: "" };
  }

  try {
    const match = fullText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? fullText) as {
      vicios?: unknown;
      quesitos_complementares?: unknown;
      teses_juridicas?: unknown;
      minuta_impugnacao?: unknown;
    };
    return {
      vicios: Array.isArray(parsed.vicios)
        ? parsed.vicios.map(vicioDoItem)
        : [],
      quesitosComplementares: Array.isArray(parsed.quesitos_complementares)
        ? parsed.quesitos_complementares.map(textoDoItem)
        : [],
      tesesJuridicas: Array.isArray(parsed.teses_juridicas)
        ? parsed.teses_juridicas.map(textoDoItem)
        : [],
      minutaImpugnacao: String(parsed.minuta_impugnacao ?? ""),
      raw: fullText,
    };
  } catch {
    return {
      vicios: [],
      quesitosComplementares: [],
      tesesJuridicas: [],
      minutaImpugnacao: fullText,
      raw: fullText,
    };
  }
}
