import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: SupportedImageMime; data: string };
};
type TextBlock = { type: "text"; text: string };
type ContentPart = TextBlock | ImageBlock;

async function processPdf(buffer: Buffer): Promise<ContentPart[]> {
  type PDFParseClass = new (opts: Record<string, unknown>) => {
    load: () => Promise<unknown>;
    getText: () => Promise<{ pages: { text: string }[] }>;
    getScreenshot: (opts: {
      pageNumbers?: number[];
      imageDataUrl?: boolean;
      imageBuffer?: boolean;
      scale?: number;
    }) => Promise<{ pages: { dataUrl?: string }[] }>;
  };
  type PdfParseModule = {
    PDFParse: PDFParseClass & { setWorker: (src: string) => void };
  };
  type WorkerModule = {
    getPath: () => string;
    CanvasFactory: new () => unknown;
  };

  const { PDFParse } = (await import("pdf-parse")) as unknown as PdfParseModule;
  const { getPath, CanvasFactory } =
    (await import("pdf-parse/worker")) as unknown as WorkerModule;

  PDFParse.setWorker(getPath());

  const textParser = new PDFParse({ data: buffer });
  await textParser.load();
  const textResult = await textParser.getText();
  const fullText = textResult.pages
    .map((p) => p.text)
    .join("\n")
    .trim();

  if (fullText.length > 80) {
    return [
      {
        type: "text",
        text: `Texto extraído do documento PDF:\n\n${fullText}\n\n${EXTRACTION_PROMPT}`,
      },
    ];
  }

  // Scanned PDF — render pages as PNG images
  const screenshotParser = new PDFParse({
    data: buffer,
    canvasFactory: new CanvasFactory(),
  });
  await screenshotParser.load();
  const screenshots = await screenshotParser.getScreenshot({
    imageDataUrl: true,
    imageBuffer: false,
    scale: 2.0,
  });

  const parts: ContentPart[] = [{ type: "text", text: EXTRACTION_PROMPT }];
  for (const pg of screenshots.pages.slice(0, 2)) {
    if (pg.dataUrl) {
      const [, b64] = pg.dataUrl.split(",");
      if (b64) {
        parts.push({
          type: "image",
          source: { type: "base64", media_type: "image/png", data: b64 },
        });
      }
    }
  }

  if (parts.length < 2) {
    throw new Error("PDF sem conteúdo extraível.");
  }

  return parts;
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
  const client = new Anthropic({ apiKey });

  try {
    let rawText = "";

    if (isSupportedImage(fileType)) {
      const base64 = buffer.toString("base64");
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: fileType, data: base64 },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
      const block = res.content[0];
      rawText = block?.type === "text" ? block.text : "";
    } else if (fileType === "application/pdf") {
      let pdfContent: ContentPart[];
      try {
        pdfContent = await processPdf(buffer);
      } catch (e) {
        console.error("PDF processing error:", e);
        return NextResponse.json(
          {
            error:
              "Não foi possível processar o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.",
          },
          { status: 422 }
        );
      }

      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: pdfContent }],
      });
      const block = res.content[0];
      rawText = block?.type === "text" ? block.text : "";
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
    console.error("Anthropic extraction error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json(
      { error: `Erro ao processar: ${msg}` },
      { status: 500 }
    );
  }
}
