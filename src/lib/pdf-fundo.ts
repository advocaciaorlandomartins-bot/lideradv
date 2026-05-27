import { PDFDocument } from "pdf-lib";

/**
 * Aplica um fundo (papel timbrado de fundo) a cada página de um PDF gerado.
 * O fundo é desenhado ANTES do conteúdo, portanto aparece atrás do texto.
 *
 * Formatos suportados via data URI:
 *   - image/png
 *   - image/jpeg | image/jpg
 *   - application/pdf  (usa a primeira página, ou página correspondente)
 *   (SVG é convertido para PNG no browser antes de chegar aqui)
 */
export async function applyFundoTimbrado(
  contentBytes: Uint8Array,
  fundoDataUri: string
): Promise<Uint8Array> {
  const mime = fundoDataUri.match(/^data:([^;]+);/)?.[1] ?? "";
  const base64Part = fundoDataUri.split(",")[1];
  if (!base64Part) return contentBytes;

  const fundoBytes = Buffer.from(base64Part, "base64");

  const contentDoc = await PDFDocument.load(contentBytes);
  const resultDoc = await PDFDocument.create();

  // Embed all content pages once
  const contentPages = contentDoc.getPages();
  const contentEmbeds = await resultDoc.embedPages(contentPages);

  // Prepare background resource
  let bgPng: Awaited<ReturnType<typeof resultDoc.embedPng>> | null = null;
  let bgJpg: Awaited<ReturnType<typeof resultDoc.embedJpg>> | null = null;
  let bgPdfEmbeds: Awaited<ReturnType<typeof resultDoc.embedPages>> = [];

  if (mime === "application/pdf") {
    const bgDoc = await PDFDocument.load(fundoBytes);
    bgPdfEmbeds = await resultDoc.embedPages(bgDoc.getPages());
  } else if (mime === "image/png") {
    bgPng = await resultDoc.embedPng(fundoBytes);
  } else if (mime === "image/jpeg" || mime === "image/jpg") {
    bgJpg = await resultDoc.embedJpg(fundoBytes);
  }

  // Build result pages: background first, then content on top
  for (let i = 0; i < contentPages.length; i++) {
    const { width, height } = contentPages[i].getSize();
    const page = resultDoc.addPage([width, height]);

    if (bgPdfEmbeds.length > 0) {
      const idx = Math.min(i, bgPdfEmbeds.length - 1);
      page.drawPage(bgPdfEmbeds[idx], { x: 0, y: 0, width, height });
    } else if (bgPng) {
      page.drawImage(bgPng, { x: 0, y: 0, width, height });
    } else if (bgJpg) {
      page.drawImage(bgJpg, { x: 0, y: 0, width, height });
    }

    // Content on top
    page.drawPage(contentEmbeds[i], { x: 0, y: 0, width, height });
  }

  return resultDoc.save();
}
