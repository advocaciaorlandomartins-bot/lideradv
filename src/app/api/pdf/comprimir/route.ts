import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from "pdf-lib";
import * as jpegjs from "jpeg-js";
import zlib from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

// JPEG quality for re-encoding (0-100). 75 gives ~50-70% savings with minimal visible loss.
const JPEG_QUALITY = 75;

// Decode FlateDecode (zlib-compressed) stream data
async function flateDecode(data: Buffer, predictor = 1): Promise<Buffer> {
  try {
    return await inflate(data);
  } catch {
    return await inflateRaw(data);
  }
}

// Re-compress a single JPEG image XObject at lower quality
function recompressJpeg(rawJpeg: Buffer): Buffer | null {
  try {
    const decoded = jpegjs.decode(rawJpeg, { useTArray: true });
    if (!decoded || !decoded.data) return null;
    const encoded = jpegjs.encode(
      { data: decoded.data, width: decoded.width, height: decoded.height },
      JPEG_QUALITY
    );
    return Buffer.from(encoded.data);
  } catch {
    return null;
  }
}

// Try to re-compress a FlateDecode RGB image as JPEG
async function flatToJpeg(
  data: Buffer,
  width: number,
  height: number,
  components: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dict: any
): Promise<{ jpeg: Buffer; newDict: typeof dict } | null> {
  if (components !== 3) return null; // only RGB → JPEG
  try {
    const decoded = await flateDecode(data);
    // Expected: width * height * components bytes
    if (decoded.length < width * height * 3) return null;
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = decoded[i * 3];
      rgba[i * 4 + 1] = decoded[i * 3 + 1];
      rgba[i * 4 + 2] = decoded[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    const encoded = jpegjs.encode({ data: rgba, width, height }, JPEG_QUALITY);
    return { jpeg: Buffer.from(encoded.data), newDict: dict };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 }
      );

    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const context = doc.context;

    let imagesProcessed = 0;
    let bytesSaved = 0;

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
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
        // Already JPEG — re-encode at lower quality
        const compressed = recompressJpeg(originalData);
        if (compressed && compressed.length < originalData.length) {
          bytesSaved += originalData.length - compressed.length;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj as any).contents = new Uint8Array(compressed);
          dict.set(PDFName.of("Length"), PDFNumber.of(compressed.length));
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
          const result = await flatToJpeg(originalData, width, height, 3, dict);
          if (result && result.jpeg.length < originalData.length) {
            bytesSaved += originalData.length - result.jpeg.length;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (obj as any).contents = new Uint8Array(result.jpeg);
            dict.set(PDFName.of("Length"), PDFNumber.of(result.jpeg.length));
            dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
            dict.delete(PDFName.of("DecodeParms"));
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
