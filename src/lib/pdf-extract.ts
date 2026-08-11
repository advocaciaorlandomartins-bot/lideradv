/**
 * Extrai o conteúdo de um arquivo (PDF ou imagem) como blocos de conteúdo
 * prontos para enviar à API da Anthropic — texto para PDFs digitais,
 * screenshots das páginas para PDFs escaneados (via pdf-parse/worker),
 * imagem direta para arquivos de imagem. Compartilhado entre a importação de
 * documentos de cliente e a geração de modelo por IA.
 */

export type SupportedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export function isSupportedImage(t: string): t is SupportedImageMime {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(t);
}

export type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: SupportedImageMime; data: string };
};
export type TextBlock = { type: "text"; text: string };
export type ContentPart = TextBlock | ImageBlock;

/** Limite da API da Anthropic é 10 MB por imagem em base64. */
const MAX_IMG_BYTES = 9 * 1024 * 1024;

/**
 * Extrai um PDF como texto (digital) ou como imagens das páginas (escaneado).
 * `promptText` é anexado ao final do texto digital, ou enviado como primeiro
 * bloco antes das imagens no caso escaneado.
 */
export async function extractPdfContent(
  buffer: Buffer,
  promptText: string,
  maxScannedPages = 2
): Promise<ContentPart[]> {
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
        text: `Texto extraído do documento PDF:\n\n${fullText}\n\n${promptText}`,
      },
    ];
  }

  // PDF escaneado — renderiza as páginas como PNG
  const screenshotParser = new PDFParse({
    data: buffer,
    canvasFactory: new CanvasFactory(),
  });
  await screenshotParser.load();
  const screenshots = await screenshotParser.getScreenshot({
    imageDataUrl: true,
    imageBuffer: false,
    scale: 1.5,
  });

  const parts: ContentPart[] = [{ type: "text", text: promptText }];
  for (const pg of screenshots.pages.slice(0, maxScannedPages)) {
    if (pg.dataUrl) {
      const [, b64] = pg.dataUrl.split(",");
      if (b64 && b64.length <= MAX_IMG_BYTES) {
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
