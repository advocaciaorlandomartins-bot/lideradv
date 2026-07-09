import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_MB = 10;

const TIPOS_JUDICIAL = [
  "citacao",
  "intimacao",
  "decisao",
  "sentenca",
  "audiencia",
  "despacho",
  "peticao",
  "alvara",
  "precatorio",
  "outro",
] as const;

export type TipoDocumentoJudicial = (typeof TIPOS_JUDICIAL)[number];

export interface DocumentoJudicialExtraido {
  tipo_documento: TipoDocumentoJudicial;
  numero_processo: string | null;
  vara_tribunal: string | null;
  juiz: string | null;
  partes: string | null;
  tipo_ato: string | null;
  data_audiencia: string | null; // YYYY-MM-DD
  hora_audiencia: string | null; // HH:MM
  local_audiencia: string | null;
  data_prazo: string | null; // YYYY-MM-DD
  prazo_descricao: string | null;
  valor: number | null;
  confianca: "alta" | "media" | "baixa";
  resumo: string;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "API de IA não configurada." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar formulário." },
      { status: 400 }
    );
  }

  const arquivos = form.getAll("arquivos") as File[];
  if (!arquivos.length) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado." },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resultados: DocumentoJudicialExtraido[] = [];

  for (const arquivo of arquivos.slice(0, 10)) {
    if (!ALLOWED_TYPES.has(arquivo.type)) {
      resultados.push({
        tipo_documento: "outro",
        numero_processo: null,
        vara_tribunal: null,
        juiz: null,
        partes: null,
        tipo_ato: null,
        data_audiencia: null,
        hora_audiencia: null,
        local_audiencia: null,
        data_prazo: null,
        prazo_descricao: null,
        valor: null,
        confianca: "baixa",
        resumo: `Tipo de arquivo não suportado: ${arquivo.type}`,
      });
      continue;
    }

    if (arquivo.size > MAX_MB * 1024 * 1024) {
      resultados.push({
        tipo_documento: "outro",
        numero_processo: null,
        vara_tribunal: null,
        juiz: null,
        partes: null,
        tipo_ato: null,
        data_audiencia: null,
        hora_audiencia: null,
        local_audiencia: null,
        data_prazo: null,
        prazo_descricao: null,
        valor: null,
        confianca: "baixa",
        resumo: `Arquivo muito grande (máx ${MAX_MB}MB).`,
      });
      continue;
    }

    const buffer = await arquivo.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const isPdf = arquivo.type === "application/pdf";

    const prompt = `Você é um assistente especializado em documentos judiciais brasileiros. Analise este documento e extraia as informações estruturadas em JSON.

Tipos de documento possíveis:
- citacao: Mandado de citação ou carta citatória
- intimacao: Mandado de intimação ou carta de intimação
- decisao: Decisão interlocutória ou despacho com prazo
- sentenca: Sentença ou acórdão
- audiencia: Designação/pauta de audiência
- despacho: Despacho ordinatório
- peticao: Petição recebida/protocolada
- alvara: Alvará de levantamento ou liberação
- precatorio: Precatório ou RPV judicial
- outro: Outro tipo de documento judicial

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem explicações):
{
  "tipo_documento": "<um dos tipos acima>",
  "numero_processo": "<número CNJ do processo ou null, ex: 0001234-56.2024.8.02.0001>",
  "vara_tribunal": "<vara e tribunal, ex: 1ª Vara Federal de Maceió / TRF-5 ou null>",
  "juiz": "<nome do juiz/desembargador ou null>",
  "partes": "<resumo das partes: Fulano x INSS ou null>",
  "tipo_ato": "<descrição do ato como aparece no doc ou null>",
  "data_audiencia": "<YYYY-MM-DD se houver audiência/sessão, ou null>",
  "hora_audiencia": "<HH:MM se houver, ou null>",
  "local_audiencia": "<endereço/sala da audiência ou null>",
  "data_prazo": "<YYYY-MM-DD do vencimento do prazo principal, ou null>",
  "prazo_descricao": "<descrição do prazo ex: Prazo de 15 dias para contestar ou null>",
  "valor": <valor monetário se houver, número decimal, ou null>,
  "confianca": "<alta|media|baixa>",
  "resumo": "<uma frase descrevendo o documento e o que precisa ser feito>"
}`;

    type ImageMediaType =
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: isPdf
              ? [
                  {
                    type: "document" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "application/pdf" as const,
                      data: base64,
                    },
                  },
                  { type: "text" as const, text: prompt },
                ]
              : [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: arquivo.type as ImageMediaType,
                      data: base64,
                    },
                  },
                  { type: "text" as const, text: prompt },
                ],
          },
        ],
      });

      const text =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "";
      const jsonStr = text
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      const extraido = JSON.parse(jsonStr) as DocumentoJudicialExtraido;
      resultados.push(extraido);
    } catch (err) {
      console.error("[processar-judicial] Erro ao analisar arquivo:", err);
      resultados.push({
        tipo_documento: "outro",
        numero_processo: null,
        vara_tribunal: null,
        juiz: null,
        partes: null,
        tipo_ato: null,
        data_audiencia: null,
        hora_audiencia: null,
        local_audiencia: null,
        data_prazo: null,
        prazo_descricao: null,
        valor: null,
        confianca: "baixa",
        resumo: "Não foi possível extrair os dados deste documento.",
      });
    }
  }

  return NextResponse.json({ resultados });
}
