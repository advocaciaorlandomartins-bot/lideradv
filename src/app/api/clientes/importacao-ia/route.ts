import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const EXTRACTION_PROMPT = `Extraia todos os dados deste documento de identificação brasileiro e retorne SOMENTE o JSON abaixo. Campos ausentes ou ilegíveis devem ter valor null.

{
  "name": "Nome completo",
  "cpf": "000.000.000-00",
  "rg": "00.000.000-0",
  "rg_orgao": "SSP/UF",
  "rg_data_emissao": "YYYY-MM-DD",
  "birth_date": "YYYY-MM-DD",
  "genero": "Masculino|Feminino|null",
  "father_name": "Nome do pai",
  "mother_name": "Nome da mãe",
  "cnh_numero": "00000000000",
  "cnh_categoria": "AB",
  "cnh_validade": "YYYY-MM-DD",
  "naturalidade_city": "Cidade",
  "naturalidade_state": "UF",
  "zipcode": "00000-000",
  "street": "Logradouro",
  "addr_number": "000",
  "neighborhood": "Bairro",
  "city": "Cidade",
  "state": "UF",
  "document_type": "RG|CNH|CPF|Passaporte|Titulo de Eleitor|Certidao de Nascimento|Certidao de Casamento"
}`;

export interface AiExtractedData {
  name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_orgao: string | null;
  rg_data_emissao: string | null;
  birth_date: string | null;
  genero: string | null;
  father_name: string | null;
  mother_name: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  naturalidade_city: string | null;
  naturalidade_state: string | null;
  zipcode: string | null;
  street: string | null;
  addr_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  document_type: string | null;
}

type SupportedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

function isSupportedImage(t: string): t is SupportedImageMime {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(t);
}

function parseJson(raw: string): AiExtractedData | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as AiExtractedData;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY não configurada no servidor. Adicione-a ao .env.local.",
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envio de arquivo inválido." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "Nenhum arquivo recebido." },
      { status: 400 }
    );
  }

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
  const openai = new OpenAI({ apiKey });

  try {
    let rawText = "";

    if (isSupportedImage(fileType)) {
      // ── Imagem: enviar como vision ────────────────────────────────────────
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${fileType};base64,${base64}`;

      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });

      rawText = res.choices[0]?.message?.content ?? "";
    } else if (fileType === "application/pdf") {
      // ── PDF: extrair texto com import dinâmico e enviar como mensagem ─────
      let pdfText = "";
      try {
        // Dynamic import evita problemas de bundling no Next.js
        const mod = await import("pdf-parse");
        // pdf-parse exports differently depending on bundler
        type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>;
        const pdfParse = ((mod as { default?: PdfParseFn }).default ??
          mod) as PdfParseFn;
        const parsed = await pdfParse(buffer);
        pdfText = (parsed.text as string).trim();
      } catch (e) {
        console.error("pdf-parse error:", e);
        return NextResponse.json(
          {
            error:
              "Não foi possível ler o PDF. Tente enviar uma foto do documento (JPEG ou PNG).",
          },
          { status: 422 }
        );
      }

      if (!pdfText) {
        return NextResponse.json(
          {
            error:
              "O PDF não contém texto legível (documento escaneado como imagem). Tire uma foto e envie como JPEG ou PNG.",
          },
          { status: 422 }
        );
      }

      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content:
              "Você extrai dados de documentos de identificação brasileiros. Responda APENAS com JSON válido.",
          },
          {
            role: "user",
            content: `Texto extraído do documento:\n\n${pdfText}\n\n${EXTRACTION_PROMPT}`,
          },
        ],
      });

      rawText = res.choices[0]?.message?.content ?? "";
    } else {
      return NextResponse.json(
        {
          error: `Formato não suportado: ${fileType}. Use JPEG, PNG, WebP, GIF ou PDF.`,
        },
        { status: 422 }
      );
    }

    const extracted = parseJson(rawText);
    if (!extracted) {
      return NextResponse.json(
        {
          error:
            "O modelo não retornou dados estruturados. Tente com um documento mais legível.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: extracted });
  } catch (err: unknown) {
    console.error("OpenAI extraction error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json(
      { error: `Erro ao processar: ${msg}` },
      { status: 500 }
    );
  }
}
