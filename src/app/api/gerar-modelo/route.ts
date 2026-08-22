import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { getModeloById } from "@/lib/modelos-db";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { fetchLogoAsDataUri } from "@/lib/pdf-timbrado";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { ModeloPdfDoc } from "@/lib/modelo-pdf";
import { substituteVariablesInBlocks } from "@/lib/modelo-blocks";
import { buildModeloVars } from "@/lib/modelo-vars";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const modeloId = searchParams.get("modeloId");
  const clienteId = searchParams.get("clienteId");

  if (!modeloId || !clienteId) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(modeloId) || !UUID_RE.test(clienteId)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  }

  const [modelo, client, escritorioConfig] = await Promise.all([
    getModeloById(modeloId),
    getClientFull(clienteId),
    getEscritorioConfig(),
  ]);

  if (!modelo)
    return NextResponse.json(
      { error: "Modelo não encontrado." },
      { status: 404 }
    );
  if (!client)
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );

  const logoData =
    escritorioConfig.logo_ativo && escritorioConfig.logo_url
      ? await fetchLogoAsDataUri(escritorioConfig.logo_url)
      : null;

  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Build variable map
  const vars = buildModeloVars(client, escritorioConfig, date);

  // Replace all variables in content
  let conteudo = modelo.conteudo;
  for (const [key, value] of Object.entries(vars)) {
    conteudo = conteudo.split(key).join(value);
  }
  const blocks = modelo.conteudo_blocks
    ? substituteVariablesInBlocks(modelo.conteudo_blocks, vars)
    : null;

  const doc = createElement(ModeloPdfDoc, {
    titulo: modelo.titulo,
    conteudo,
    blocks,
    date,
    clientName: client.name,
    config: escritorioConfig,
    logoData,
    usarTimbrado: modelo.usar_timbrado,
  }) as ReactElement<DocumentProps>;

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(doc);
    if (
      escritorioConfig.fundo_timbrado_ativo &&
      escritorioConfig.fundo_timbrado
    ) {
      const withBg = await applyFundoTimbrado(
        new Uint8Array(buffer),
        escritorioConfig.fundo_timbrado
      );
      buffer = Buffer.from(withBg);
    }
  } catch (err) {
    console.error("gerar-modelo render error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar o PDF. Verifique a formatação do modelo." },
      { status: 500 }
    );
  }

  const safeName = client.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const safeTitle = modelo.titulo
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}_${safeName}.pdf"`,
    },
  });
}
