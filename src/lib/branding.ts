import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getEscritorioConfig } from "./escritorio-db";

function decodeDataUrl(dataUrl: string): Buffer {
  const base64 = dataUrl.split(",").pop() ?? "";
  return Buffer.from(base64, "base64");
}

/** Logo completa e ícone (só a marca) para uso em <img> client-side —
 * data URI quando customizado em Configurações, senão o arquivo padrão. */
export async function getBrandingSrcs(): Promise<{
  logoSrc: string;
  iconSrc: string;
}> {
  const config = await getEscritorioConfig();
  return {
    logoSrc: config.logo_app_url || "/logo.png",
    iconSrc: config.logo_app_icon_url || "/logo-icon.png",
  };
}

/** Ícone (só a marca) em PNG, redimensionado — para favicon, apple-icon e
 * manifest do PWA, que precisam de uma URL real servindo bytes de imagem. */
export async function getIconPng(size: number): Promise<Buffer> {
  const config = await getEscritorioConfig();
  const source = config.logo_app_icon_url
    ? decodeDataUrl(config.logo_app_icon_url)
    : await readFile(path.join(process.cwd(), "public", "logo-icon.png"));
  return sharp(source)
    .resize(size, size, { fit: "contain", background: "#000000" })
    .flatten({ background: "#000000" })
    .png()
    .toBuffer();
}
