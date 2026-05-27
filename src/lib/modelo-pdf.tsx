import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { EscritorioConfig } from "./escritorio-db";
import { TimbradoHeader, TimbradoFooter } from "./pdf-timbrado";
import { getPdfConfig, buildStyles } from "./pdf-config";

interface Props {
  titulo: string;
  conteudo: string;
  date: string;
  clientName: string;
  config?: EscritorioConfig | null;
  logoData?: string | null;
  usarTimbrado?: boolean;
}

export function ModeloPdfDoc({
  titulo,
  conteudo,
  date,
  clientName,
  config,
  logoData,
  usarTimbrado,
}: Props) {
  const withLetterhead = (usarTimbrado ?? false) && !!config;
  const pdfCfg = getPdfConfig(config, withLetterhead);
  const s = buildStyles(pdfCfg);

  const paragraphs = conteudo
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <Document
      title={`${titulo} — ${clientName}`}
      author={config?.nome ?? "Advocacia"}
    >
      <Page size="A4" style={s.page}>
        {withLetterhead ? (
          <TimbradoHeader config={config!} logoData={logoData ?? null} />
        ) : (
          <View fixed>
            <Text style={s.simpleHeader.firmName}>
              {config?.nome?.toUpperCase() ?? "ADVOCACIA ORLANDO MARTINS"}
            </Text>
            {config?.oab && (
              <Text style={s.simpleHeader.firmSub}>{config.oab}</Text>
            )}
            <View style={s.simpleHeader.divider} />
          </View>
        )}

        <Text style={s.docTitle}>{titulo.toUpperCase()}</Text>

        {paragraphs.map((para, i) => (
          <Text key={i} style={[s.body, { marginBottom: 12 }]}>
            {para}
          </Text>
        ))}

        {withLetterhead ? (
          <TimbradoFooter config={config!} date={date} />
        ) : (
          <Text style={s.simpleFooter} fixed>
            Documento gerado em {date} —{" "}
            {config?.nome ?? "Advocacia Orlando Martins"} · Todos os direitos
            reservados
          </Text>
        )}
      </Page>
    </Document>
  );
}
