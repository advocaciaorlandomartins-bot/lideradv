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

const TIPOS_INSS = [
  "agendamento_avaliacao_social",
  "agendamento_pericia_medica",
  "agendamento_generico",
  "comprovante_pagamento",
  "rpv",
  "resultado_pericia",
  "outro",
] as const;

export type TipoDocumentoInss = (typeof TIPOS_INSS)[number];

export interface DocumentoInssExtraido {
  tipo_documento: TipoDocumentoInss;
  protocolo: string | null;
  data_agendamento: string | null; // ISO date YYYY-MM-DD
  hora_agendamento: string | null; // HH:MM
  local_nome: string | null;
  local_endereco: string | null;
  tipo_servico: string | null;
  nome_requerente: string | null;
  cpf_requerente: string | null;
  nome_mae: string | null;
  valor: number | null; // para pagamentos/RPV
  data_pagamento: string | null; // ISO date YYYY-MM-DD
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
  const resultados: DocumentoInssExtraido[] = [];

  for (const arquivo of arquivos.slice(0, 10)) {
    if (!ALLOWED_TYPES.has(arquivo.type)) {
      resultados.push({
        tipo_documento: "outro",
        protocolo: null,
        data_agendamento: null,
        hora_agendamento: null,
        local_nome: null,
        local_endereco: null,
        tipo_servico: null,
        nome_requerente: null,
        cpf_requerente: null,
        nome_mae: null,
        valor: null,
        data_pagamento: null,
        confianca: "baixa",
        resumo: `Tipo de arquivo não suportado: ${arquivo.type}`,
      });
      continue;
    }

    if (arquivo.size > MAX_MB * 1024 * 1024) {
      resultados.push({
        tipo_documento: "outro",
        protocolo: null,
        data_agendamento: null,
        hora_agendamento: null,
        local_nome: null,
        local_endereco: null,
        tipo_servico: null,
        nome_requerente: null,
        cpf_requerente: null,
        nome_mae: null,
        valor: null,
        data_pagamento: null,
        confianca: "baixa",
        resumo: `Arquivo muito grande (máx ${MAX_MB}MB).`,
      });
      continue;
    }

    const buffer = await arquivo.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const isPdf = arquivo.type === "application/pdf";

    const prompt = `Você é um assistente especializado em documentos do INSS brasileiro. Analise este documento e extraia as informações estruturadas em JSON.

Tipos de documento possíveis:
- agendamento_avaliacao_social: Comprovante de agendamento de Avaliação Social BPC/LOAS
- agendamento_pericia_medica: Comprovante de agendamento de Perícia Médica
- agendamento_generico: Outro tipo de agendamento INSS
- comprovante_pagamento: Comprovante de pagamento de benefício
- rpv: Requisição de Pequeno Valor (RPV)
- resultado_pericia: Resultado de perícia médica
- outro: Outro tipo de documento

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem explicações):
{
  "tipo_documento": "<um dos tipos acima>",
  "protocolo": "<número do protocolo ou null>",
  "data_agendamento": "<YYYY-MM-DD ou null>",
  "hora_agendamento": "<HH:MM ou null>",
  "local_nome": "<nome da agência/local ou null>",
  "local_endereco": "<endereço completo do local ou null>",
  "tipo_servico": "<descrição do serviço como consta no documento ou null>",
  "nome_requerente": "<nome completo do requerente ou null>",
  "cpf_requerente": "<CPF formatado ou null>",
  "nome_mae": "<nome da mãe ou null>",
  "valor": <número decimal ou null>,
  "data_pagamento": "<YYYY-MM-DD ou null>",
  "confianca": "<alta|media|baixa>",
  "resumo": "<uma frase descrevendo o documento>"
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
      const extraido = JSON.parse(jsonStr) as DocumentoInssExtraido;
      resultados.push(extraido);
    } catch (err) {
      console.error("[processar-inss] Erro ao analisar arquivo:", err);
      resultados.push({
        tipo_documento: "outro",
        protocolo: null,
        data_agendamento: null,
        hora_agendamento: null,
        local_nome: null,
        local_endereco: null,
        tipo_servico: null,
        nome_requerente: null,
        cpf_requerente: null,
        nome_mae: null,
        valor: null,
        data_pagamento: null,
        confianca: "baixa",
        resumo: "Não foi possível extrair os dados deste documento.",
      });
    }
  }

  return NextResponse.json({ resultados });
}
