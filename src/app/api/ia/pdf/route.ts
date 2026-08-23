import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
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

  // Renderização de PDF é cara em CPU (maxDuration 60) — sem teto de tamanho
  // nem limite por usuário dava para derrubar a função com poucas chamadas.
  if (await iaRateLimitExcedido(session.login))
    return NextResponse.json(
      { error: "Limite de gerações excedido. Tente novamente em 1 hora." },
      { status: 429 }
    );

  const body = await request.json().catch(() => null);
  if (!body?.texto || !body?.tipoPeticao)
    return NextResponse.json(
      { error: "texto e tipoPeticao são obrigatórios." },
      { status: 400 }
    );

  const texto = String(body.texto).slice(0, 200_000);
  const tipoPeticao = String(body.tipoPeticao).slice(0, 120);

  const config = await getEscritorioConfig();

  const logoData =
    config.logo_ativo && config.logo_url
      ? await fetchLogoAsDataUri(config.logo_url).catch(() => null)
      : null;

  // Sem timeZone explícito, o servidor (UTC) data o documento um dia à
  // frente para gerações após as 21h no horário de Brasília.
  const date = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const titulo = body.titulo
    ? String(body.titulo).slice(0, 200)
    : `${tipoPeticao} — ${date}`;

  const doc = createElement(PeticaoIaDoc, {
    texto,
    titulo,
    tipoPeticao,
    config,
    logoData,
    date,
  }) as ReactElement<DocumentProps>;

  let buffer = await renderToBuffer(doc);

  if (config.fundo_timbrado_ativo && config.fundo_timbrado) {
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
