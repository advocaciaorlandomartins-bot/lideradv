import { Document, Page, Text, View } from "@react-pdf/renderer";
import { configParaDocumento, type EscritorioConfig } from "./escritorio-db";
import { TimbradoHeader, TimbradoFooter } from "./pdf-timbrado";
import { getPdfConfig, buildStyles } from "./pdf-config";
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
}: Props) {
  const withLetterhead =
    (usarTimbrado ?? false) && !!config && config.modelo_timbrado_ativo;
  const pdfCfg = getPdfConfig(config, withLetterhead);
  const s = buildStyles(pdfCfg);
  const identificacaoAtiva = !config || config.identificacao_ativo;
  const nomeExibido = identificacaoAtiva
    ? (config?.nome ?? "Advocacia Orlando Martins")
    : "Advocacia Orlando Martins";
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
          <View fixed>
            <Text style={s.simpleHeader.firmName}>
              {nomeExibido.toUpperCase()}
            </Text>
            {oabExibida && (
              <Text style={s.simpleHeader.firmSub}>{oabExibida}</Text>
            )}
            <View style={s.simpleHeader.divider} />
          </View>
        )}

        <Text style={s.docTitle}>{titulo.toUpperCase()}</Text>

        {blocks && blocks.length > 0
          ? renderBlocks(blocks, s, pdfCfg)
          : paragraphs.map((para, i) => (
              <Text key={i} style={[s.body, { marginBottom: 12 }]}>
                {para}
              </Text>
            ))}

        {withLetterhead ? (
          <TimbradoFooter config={configParaDocumento(config!)} date={date} />
        ) : (
          <Text style={s.simpleFooter} fixed>
            {nomeExibido}
            {oabExibida ? ` — ${oabExibida}` : ""} · {date}
          </Text>
        )}
      </Page>
    </Document>
  );
}
