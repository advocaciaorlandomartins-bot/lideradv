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

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } };

async function processPdf(buffer: Buffer): Promise<ContentPart[]> {
  // pdfjs-dist legacy build is required for Node.js (no DOMMatrix dependency)
  type PdfjsModule = {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (opts: {
      data: Uint8Array;
      useSystemFonts?: boolean;
      verbosity?: number;
    }) => { promise: Promise<PdfDoc> };
  };
  type TextItem = { str: string };
  type PdfPage = {
    getViewport: (opts: { scale: number }) => {
      width: number;
      height: number;
    };
    getTextContent: () => Promise<{ items: TextItem[] }>;
    render: (opts: {
      canvasContext: unknown;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void> };
  };
  type PdfDoc = {
    numPages: number;
    getPage: (n: number) => Promise<PdfPage>;
  };

  const pdfjsLib =
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfjsModule;

  // Disable web worker — runs in-thread in Node.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = Math.min(pdfDoc.numPages, 8);

  // ── 1. Attempt text extraction ─────────────────────────────────────────────
  let fullText = "";
  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((i) => i.str)
      .join(" ")
      .trim();
    if (pageText) fullText += pageText + "\n";
  }

  fullText = fullText.trim();
  if (fullText.length > 80) {
    return [
      {
        type: "text",
        text: `Texto extraído do documento PDF:\n\n${fullText}\n\n${EXTRACTION_PROMPT}`,
      },
    ];
  }

  // ── 2. Scanned PDF — render pages as JPEG images ───────────────────────────
  const { createCanvas } = (await import("@napi-rs/canvas")) as {
    createCanvas: (
      w: number,
      h: number
    ) => {
      getContext: (type: "2d") => unknown;
      toDataURL: (mime: string, quality: number) => string;
    };
  };

  const parts: ContentPart[] = [{ type: "text", text: EXTRACTION_PROMPT }];
  const renderPages = Math.min(pdfDoc.numPages, 2);

  for (let p = 1; p <= renderPages; p++) {
    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const w = Math.ceil(viewport.width);
    const h = Math.ceil(viewport.height);

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    parts.push({
      type: "image_url",
      image_url: { url: canvas.toDataURL("image/jpeg", 0.85), detail: "high" },
    });
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
      // ── PDF: extrai texto ou renderiza páginas como imagem ────────────────
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

      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [{ role: "user", content: pdfContent }],
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
