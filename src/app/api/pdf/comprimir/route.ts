import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  PDFRawStream,
  PDFName,
  PDFNumber,
  EncryptedPDFError,
} from "pdf-lib";
import * as jpegjs from "jpeg-js";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { getSession } from "@/lib/session";

const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

// JPEG quality for re-encoding (0-100). 75 gives ~50-70% savings com imagem
// JÁ comprimida em JPEG de baixa qualidade. O achado real (Orlando,
// 2026-10-10, comparando contra a compressão do TramitaSign: "8MB vira
// 1MB, a nossa é tudo errado") é que isso sozinho não chega perto — a
// maior parte do peso de um PDF escaneado é RESOLUÇÃO, não qualidade de
// JPEG. Um scanner/celular comum salva a 200-300 DPI (ex: carta a 300
// DPI = ~2550×3300px), muito além do que precisa pra ler texto na tela
// ou imprimir — por isso agora também reduz a resolução antes de
// reencodar, não só a qualidade.
const JPEG_QUALITY = 75;
// ~150 DPI numa página carta/A4 — nitidamente legível (inclusive
// assinatura), mas uma fração dos pixels de um scan a 300 DPI.
const MAX_DIMENSAO_PX = 1700;

// Decode FlateDecode (zlib-compressed) stream data
async function flateDecode(data: Buffer, _predictor = 1): Promise<Buffer> {
  try {
    return await inflate(data);
  } catch {
    return await inflateRaw(data);
  }
}

/** Box filter (média de blocos) — mais simples que reamostragem bicúbica,
 * mas sem o serrilhado de nearest-neighbor; suficiente pra foto de
 * documento, que não tem detalhe fino crítico pra preservar. */
function downsampleRGBA(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor(dy * yRatio);
    const sy1 = Math.max(
      sy0 + 1,
      Math.min(srcH, Math.floor((dy + 1) * yRatio))
    );
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor(dx * xRatio);
      const sx1 = Math.max(
        sx0 + 1,
        Math.min(srcW, Math.floor((dx + 1) * xRatio))
      );
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const idx = (sy * srcW + sx) * 4;
          r += src[idx];
          g += src[idx + 1];
          b += src[idx + 2];
          a += src[idx + 3];
          count++;
        }
      }
      const didx = (dy * dstW + dx) * 4;
      dst[didx] = r / count;
      dst[didx + 1] = g / count;
      dst[didx + 2] = b / count;
      dst[didx + 3] = a / count;
    }
  }
  return dst;
}

function reduzirSeNecessario(
  data: Uint8Array,
  width: number,
  height: number
): { data: Uint8Array; width: number; height: number } {
  const maiorLado = Math.max(width, height);
  if (maiorLado <= MAX_DIMENSAO_PX) return { data, width, height };
  const escala = MAX_DIMENSAO_PX / maiorLado;
  const novaW = Math.max(1, Math.round(width * escala));
  const novaH = Math.max(1, Math.round(height * escala));
  return {
    data: downsampleRGBA(data, width, height, novaW, novaH),
    width: novaW,
    height: novaH,
  };
}

// Re-compress a single JPEG image XObject at lower quality (e, se a
// resolução original exceder MAX_DIMENSAO_PX, também reduz o tamanho —
// devolve a nova largura/altura pro chamador atualizar o dicionário do
// PDF, já que a posição/tamanho exibido na página vem da matriz de
// transformação do conteúdo, não da resolução da imagem — só muda o
// "DPI" efetivo, não o tamanho visível).
function recompressJpeg(
  rawJpeg: Buffer
): { data: Buffer; width: number; height: number } | null {
  try {
    const decoded = jpegjs.decode(rawJpeg, { useTArray: true });
    if (!decoded || !decoded.data) return null;
    const reduzido = reduzirSeNecessario(
      decoded.data,
      decoded.width,
      decoded.height
    );
    const encoded = jpegjs.encode(
      {
        data: reduzido.data,
        width: reduzido.width,
        height: reduzido.height,
      },
      JPEG_QUALITY
    );
    return {
      data: Buffer.from(encoded.data),
      width: reduzido.width,
      height: reduzido.height,
    };
  } catch {
    return null;
  }
}

// Try to re-compress a FlateDecode RGB image as JPEG (com a mesma redução
// de resolução de recompressJpeg quando aplicável)
async function flatToJpeg(
  data: Buffer,
  width: number,
  height: number,
  components: number
): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  if (components !== 3) return null; // only RGB → JPEG
  try {
    const decoded = await flateDecode(data);
    // Expected: width * height * components bytes
    if (decoded.length < width * height * 3) return null;
    // width/height vêm direto do dicionário do XObject dentro do PDF —
    // sem esse teto, um PDF pequeno cujo FlateDecode descomprime pra um
    // volume grande (mas plausível o bastante pra passar no check acima)
    // conseguia forçar uma alocação desproporcional aqui.
    const MAX_PIXELS = 50_000_000; // ~50MP, bem acima de qualquer imagem real de PDF
    if (width * height > MAX_PIXELS) return null;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = decoded[i * 3];
      rgba[i * 4 + 1] = decoded[i * 3 + 1];
      rgba[i * 4 + 2] = decoded[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    const reduzido = reduzirSeNecessario(rgba, width, height);
    const encoded = jpegjs.encode(
      { data: reduzido.data, width: reduzido.width, height: reduzido.height },
      JPEG_QUALITY
    );
    return {
      jpeg: Buffer.from(encoded.data),
      width: reduzido.width,
      height: reduzido.height,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json(
        { error: "Arquivo muito grande. Limite: 50 MB." },
        { status: 413 }
      );

    const buf = await file.arrayBuffer();
    // Sem ignoreEncryption — ver comentário em remover-senha/route.ts: com
    // true, o load "funciona" sobre a estrutura ainda criptografada e o
    // save completa sem erro, mas o PDF salvo continua corrompido/ilegível
    // (pdf-lib não decripta). Achado em auditoria de 2026-10-09.
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(buf);
    } catch (err) {
      if (
        err instanceof EncryptedPDFError ||
        String(err).toLowerCase().includes("encrypt")
      ) {
        return NextResponse.json(
          {
            error:
              "Este PDF está protegido por senha e não pode ser processado: nossa ferramenta não suporta PDFs criptografados no momento.",
          },
          { status: 400 }
        );
      }
      throw err;
    }
    const context = doc.context;

    let imagesProcessed = 0;

    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;

      const subtype = dict.get(PDFName.of("Subtype"));
      if (!subtype || subtype.toString() !== "/Image") continue;

      const filterRaw = dict.get(PDFName.of("Filter"));
      const filterStr = filterRaw?.toString() ?? "";

      const wRaw = dict.get(PDFName.of("Width"));
      const hRaw = dict.get(PDFName.of("Height"));
      const width = wRaw instanceof PDFNumber ? wRaw.asNumber() : 0;
      const height = hRaw instanceof PDFNumber ? hRaw.asNumber() : 0;

      const originalData = Buffer.from(obj.asUint8Array());

      if (filterStr === "/DCTDecode") {
        // Already JPEG — re-encode at lower quality (e possivelmente
        // menor resolução, ver recompressJpeg)
        const resultado = recompressJpeg(originalData);
        if (resultado && resultado.data.length < originalData.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj as any).contents = new Uint8Array(resultado.data);
          dict.set(PDFName.of("Length"), PDFNumber.of(resultado.data.length));
          if (resultado.width !== width || resultado.height !== height) {
            dict.set(PDFName.of("Width"), PDFNumber.of(resultado.width));
            dict.set(PDFName.of("Height"), PDFNumber.of(resultado.height));
          }
          imagesProcessed++;
        }
      } else if (
        filterStr === "/FlateDecode" &&
        width > 0 &&
        height > 0 &&
        originalData.length > 10_000
      ) {
        // Large zlib-compressed RGB image — try converting to JPEG for lossy compression
        const csRaw = dict.get(PDFName.of("ColorSpace"));
        const cs = csRaw?.toString() ?? "";
        const bpcRaw = dict.get(PDFName.of("BitsPerComponent"));
        const bpc = bpcRaw instanceof PDFNumber ? bpcRaw.asNumber() : 8;

        if (cs === "/DeviceRGB" && bpc === 8) {
          const result = await flatToJpeg(originalData, width, height, 3);
          if (result && result.jpeg.length < originalData.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (obj as any).contents = new Uint8Array(result.jpeg);
            dict.set(PDFName.of("Length"), PDFNumber.of(result.jpeg.length));
            dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
            dict.delete(PDFName.of("DecodeParms"));
            if (result.width !== width || result.height !== height) {
              dict.set(PDFName.of("Width"), PDFNumber.of(result.width));
              dict.set(PDFName.of("Height"), PDFNumber.of(result.height));
            }
            imagesProcessed++;
          }
        }
      }
    }

    const bytes = await doc.save({ useObjectStreams: true });

    const original = buf.byteLength;
    const resultado = bytes.byteLength;
    const finalBytes =
      resultado < original ? Buffer.from(bytes) : Buffer.from(buf);
    const finalSize = Math.min(resultado, original);
    const reducao = Math.max(0, Math.round((1 - finalSize / original) * 100));

    return new NextResponse(finalBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="comprimido.pdf"',
        "X-Original-Size": String(original),
        "X-Result-Size": String(finalSize),
        "X-Reducao-Pct": String(reducao),
        "X-Ja-Otimizado": reducao < 3 ? "1" : "0",
        "X-Imagens-Processadas": String(imagesProcessed),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao comprimir PDF." },
      { status: 500 }
    );
  }
}
