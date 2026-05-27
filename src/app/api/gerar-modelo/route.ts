import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { getModeloById } from "@/lib/modelos-db";
import { getClientFull } from "@/lib/clients-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { fetchLogoAsDataUri } from "@/lib/pdf-timbrado";
import { applyFundoTimbrado } from "@/lib/pdf-fundo";
import { ModeloPdfDoc } from "@/lib/modelo-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modeloId = searchParams.get("modeloId");
  const clienteId = searchParams.get("clienteId");

  if (!modeloId || !clienteId) {
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

  const logoData = escritorioConfig.logo_url
    ? await fetchLogoAsDataUri(escritorioConfig.logo_url)
    : null;

  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Build variable map
  const addrParts = [
    client.street,
    client.addr_number,
    client.complement,
  ].filter(Boolean);
  const enderecoCompleto = `${addrParts.join(", ")}, ${client.neighborhood}, ${client.city}/${client.state}, CEP ${client.cep}`;

  const vars: Record<string, string> = {
    "{{nome}}": client.name,
    "{{cpf_cnpj}}": client.doc,
    "{{tipo}}": client.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica",
    "{{email}}": client.email,
    "{{telefone}}": client.phone,
    "{{cep}}": client.cep ?? "",
    "{{endereco}}": addrParts.join(", "),
    "{{endereco_completo}}": enderecoCompleto,
    "{{bairro}}": client.neighborhood ?? "",
    "{{cidade}}": client.city,
    "{{estado}}": client.state,
    "{{data_nascimento}}": client.birth_date
      ? new Date(client.birth_date).toLocaleDateString("pt-BR")
      : "",
    "{{nome_fantasia}}": client.trade_name ?? "",
    "{{rg}}": client.rg ?? "",
    "{{rg_orgao}}": client.rg_orgao ?? "",
    "{{estado_civil}}": client.estado_civil ?? "",
    "{{genero}}": client.genero ?? "",
    "{{profissao}}": client.profissao ?? "",
    "{{nacionalidade}}": client.nacionalidade ?? "",
    "{{parceria}}": client.parceria ?? "",
    "{{responsavel_nome}}": client.responsavel_nome ?? "",
    "{{responsavel_cpf}}": client.responsavel_cpf ?? "",
    "{{responsavel_rg}}": client.responsavel_rg ?? "",
    "{{responsavel_rg_orgao}}": client.responsavel_rg_orgao ?? "",
    "{{responsavel_telefone}}": client.responsavel_telefone ?? "",
    "{{responsavel_email}}": client.responsavel_email ?? "",
    "{{responsavel_parentesco}}": client.responsavel_parentesco ?? "",
    "{{data_hoje}}": date,
    "{{advogado}}": escritorioConfig.nome,
  };

  // Replace all variables in content
  let conteudo = modelo.conteudo;
  for (const [key, value] of Object.entries(vars)) {
    conteudo = conteudo.split(key).join(value);
  }

  const doc = createElement(ModeloPdfDoc, {
    titulo: modelo.titulo,
    conteudo,
    date,
    clientName: client.name,
    config: escritorioConfig,
    logoData,
    usarTimbrado: modelo.usar_timbrado,
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
