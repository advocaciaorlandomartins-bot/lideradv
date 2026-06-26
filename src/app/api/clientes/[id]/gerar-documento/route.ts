import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { fetchLogoAsDataUri } from "@/lib/pdf-timbrado";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { getSession } from "@/lib/session";
import {
  ProcuracaoDoc,
  ContratoHonorariosDoc,
  DeclaracaoHipossuficienciaDoc,
  NotificacaoExtrajudicialDoc,
} from "@/lib/pdf-templates";

export const dynamic = "force-dynamic";

const TEMPLATES = {
  procuracao: {
    component: ProcuracaoDoc,
    label: "Procuracao_Ad_Judicia",
  },
  contrato_honorarios: {
    component: ContratoHonorariosDoc,
    label: "Contrato_de_Honorarios",
  },
  declaracao_hipossuficiencia: {
    component: DeclaracaoHipossuficienciaDoc,
    label: "Declaracao_de_Hipossuficiencia",
  },
  notificacao_extrajudicial: {
    component: NotificacaoExtrajudicialDoc,
    label: "Notificacao_Extrajudicial",
  },
} as const;

type TemplateKey = keyof typeof TEMPLATES;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const template = searchParams.get("template") as TemplateKey | null;

  if (!template || !(template in TEMPLATES)) {
    return NextResponse.json({ error: "Template inválido." }, { status: 400 });
  }

  const [client, escritorioConfig] = await Promise.all([
    getClientFull(id),
    getEscritorioConfig(),
  ]);

  if (!client) {
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );
  }

  const logoData = escritorioConfig.logo_url
    ? await fetchLogoAsDataUri(escritorioConfig.logo_url)
    : null;

  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const { component, label } = TEMPLATES[template];
  const doc = createElement(component, {
    client,
    date,
    config: escritorioConfig,
    logoData,
  }) as ReactElement<DocumentProps>;
  let buffer = await renderToBuffer(doc);
  if (escritorioConfig.fundo_timbrado) {
    const withBg = await applyFundoTimbrado(
      new Uint8Array(buffer),
      escritorioConfig.fundo_timbrado
    );
    buffer = Buffer.from(withBg);
  }

  const safeName = client.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const filename = `${label}_${safeName}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
