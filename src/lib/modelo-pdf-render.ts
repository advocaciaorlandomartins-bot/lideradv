import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { ModeloDocumento } from "./modelos-db";
import type { ClientFull } from "./clients-db";
import type { EscritorioConfig } from "./escritorio-db";
import { fetchLogoAsDataUri } from "./pdf-timbrado";
import { applyFundoTimbrado } from "./pdf-fundo";
import { ModeloPdfDoc } from "./modelo-pdf";
import { substituteVariablesInBlocks } from "./modelo-blocks";
import { replaceVars } from "./modelo-vars";

/**
 * Renderiza um modelo + cliente num PDF de verdade (bytes), mesma lógica de
 * /api/gerar-modelo — extraída pra cá pra ser reaproveitada pelo envio de
 * Assinaturas ao TramitaSign, que precisa de PDFs reais (a API deles só
 * aceita upload de arquivo, não HTML solto).
 */
export async function renderModeloParaPdf(params: {
  modelo: ModeloDocumento;
  client: ClientFull;
  escritorioConfig: EscritorioConfig;
  vars: Record<string, string>;
  date: string;
}): Promise<Buffer> {
  const { modelo, client, escritorioConfig, vars, date } = params;

  const logoData =
    escritorioConfig.logo_ativo && escritorioConfig.logo_url
      ? await fetchLogoAsDataUri(escritorioConfig.logo_url)
      : null;

  const conteudo = replaceVars(modelo.conteudo, vars);
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

  let buffer = await renderToBuffer(doc);

  if (
    modelo.usar_fundo_timbrado &&
    escritorioConfig.fundo_timbrado_ativo &&
    escritorioConfig.fundo_timbrado
  ) {
    const withBg = await applyFundoTimbrado(
      new Uint8Array(buffer),
      escritorioConfig.fundo_timbrado
    );
    buffer = Buffer.from(withBg);
  }

  return buffer;
}
