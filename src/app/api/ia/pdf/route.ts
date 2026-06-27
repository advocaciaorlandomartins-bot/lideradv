import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { fetchLogoAsDataUri } from "@/lib/pdf-timbrado";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { PeticaoIaDoc } from "@/lib/pdf-peticao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.texto || !body?.tipoPeticao)
    return NextResponse.json(
      { error: "texto e tipoPeticao são obrigatórios." },
      { status: 400 }
    );

  const config = await getEscritorioConfig();

  const logoData = config.logo_url
    ? await fetchLogoAsDataUri(config.logo_url).catch(() => null)
    : null;

  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const titulo = body.titulo || `${body.tipoPeticao} — ${date}`;

  const doc = createElement(PeticaoIaDoc, {
    texto: body.texto,
    titulo,
    tipoPeticao: body.tipoPeticao,
    config,
    logoData,
    date,
  }) as ReactElement<DocumentProps>;

  let buffer = await renderToBuffer(doc);

  if (config.fundo_timbrado) {
    const withBg = await applyFundoTimbrado(
      new Uint8Array(buffer),
      config.fundo_timbrado
    );
    buffer = Buffer.from(withBg);
  }

  const safeName = titulo
    .replace(/[^a-zA-Z0-9À-ɏ\s\-_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
    },
  });
}
