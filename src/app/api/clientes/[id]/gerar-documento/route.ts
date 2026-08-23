import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { fetchLogoAsDataUri } from "@/lib/pdf-timbrado";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getClientPendingEntradas } from "@/lib/lancamentos-db";
import {
  ProcuracaoDoc,
  ContratoHonorariosDoc,
  DeclaracaoHipossuficienciaDoc,
  NotificacaoExtrajudicialDoc,
  ComunicadoHonorariosDoc,
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

type TemplateKey = keyof typeof TEMPLATES | "comunicado_honorarios";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver"))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const { id } = await params;

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const template = searchParams.get("template") as TemplateKey | null;

  const validTemplates = [...Object.keys(TEMPLATES), "comunicado_honorarios"];
  if (!template || !validTemplates.includes(template)) {
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

  const logoData =
    escritorioConfig.logo_ativo && escritorioConfig.logo_url
      ? await fetchLogoAsDataUri(escritorioConfig.logo_url)
      : null;

  // Sem timeZone explícito, o servidor (UTC) data o documento um dia à
  // frente para gerações após as 21h no horário de Brasília.
  const date = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let doc: ReactElement<DocumentProps>;
  let filename: string;

  const safeName = client.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  if (template === "comunicado_honorarios") {
    const lancamentos = await getClientPendingEntradas(id);
    doc = createElement(ComunicadoHonorariosDoc, {
      client,
      lancamentos,
      date,
      config: escritorioConfig,
      logoData,
    }) as ReactElement<DocumentProps>;
    filename = `Comunicado_de_Honorarios_${safeName}.pdf`;
  } else {
    const { component, label } = TEMPLATES[template as keyof typeof TEMPLATES];
    doc = createElement(component, {
      client,
      date,
      config: escritorioConfig,
      logoData,
    }) as ReactElement<DocumentProps>;
    filename = `${label}_${safeName}.pdf`;
  }

  let buffer = await renderToBuffer(doc);
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

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
