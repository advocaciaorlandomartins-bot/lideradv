import { Document, Page, Text, View } from "@react-pdf/renderer";
import { configParaDocumento, type EscritorioConfig } from "./escritorio-db";
import { TimbradoHeader, TimbradoFooter } from "./pdf-timbrado";
import { getPdfConfig, buildStyles, type PdfPageConfig } from "./pdf-config";
import { renderBlocks } from "./modelo-pdf-blocks";
import type { Block } from "./modelo-blocks";

interface Props {
  titulo: string;
  conteudo: string;
  blocks?: Block[] | null;
  date: string;
  clientName: string;
  config?: EscritorioConfig | null;
  logoData?: string | null;
  usarTimbrado?: boolean;
  ocultarIdentificacao?: boolean;
  /** modelos_documento.fonte_tamanho — override por modelo (ex: Procuração e
   * Contrato, que é texto denso e não precisa do tamanho pensado pra
   * petições longas). null usa o padrão do escritório sem alteração. */
  fonteTamanho?: number | null;
}

export function ModeloPdfDoc({
  titulo,
  conteudo,
  blocks,
  date,
  clientName,
  config,
  logoData,
  usarTimbrado,
  ocultarIdentificacao,
  fonteTamanho,
}: Props) {
  const withLetterhead =
    !ocultarIdentificacao &&
    (usarTimbrado ?? false) &&
    !!config &&
    config.modelo_timbrado_ativo;
  const baseCfg = getPdfConfig(config, withLetterhead);
  const pdfCfg: PdfPageConfig =
    fonteTamanho != null
      ? {
          ...baseCfg,
          fontSize: fonteTamanho,
          lineHeight: Math.max(baseCfg.lineHeight - 0.4, 1.3),
        }
      : baseCfg;
  const s = buildStyles(pdfCfg);
  const identificacaoAtiva =
    !ocultarIdentificacao && (!config || config.identificacao_ativo);
  const nomeExibido = identificacaoAtiva
    ? (config?.nome ?? "Orlando Martins Advocacia")
    : "Orlando Martins Advocacia";
  const oabExibida = identificacaoAtiva ? (config?.oab ?? null) : null;

  const paragraphs = conteudo
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <Document
      title={`${titulo} — ${clientName}`}
      author={identificacaoAtiva ? (config?.nome ?? "Advocacia") : "Advocacia"}
    >
      <Page size="A4" style={s.page}>
        {withLetterhead ? (
          <TimbradoHeader
            config={configParaDocumento(config!)}
            logoData={logoData ?? null}
          />
        ) : (
          !ocultarIdentificacao && (
            <View fixed>
              <Text style={s.simpleHeader.firmName}>
                {nomeExibido.toUpperCase()}
              </Text>
              {oabExibida && (
                <Text style={s.simpleHeader.firmSub}>{oabExibida}</Text>
              )}
              <View style={s.simpleHeader.divider} />
            </View>
          )
        )}

        <Text style={s.docTitle}>{titulo.toUpperCase()}</Text>

        {blocks && blocks.length > 0
          ? renderBlocks(blocks, s, pdfCfg)
          : paragraphs.map((para, i) => (
              <Text key={i} style={[s.body, { marginBottom: 12 }]}>
                {para}
              </Text>
            ))}

        {withLetterhead && (
          <TimbradoFooter config={configParaDocumento(config!)} date={date} />
        )}
      </Page>
    </Document>
  );
}
