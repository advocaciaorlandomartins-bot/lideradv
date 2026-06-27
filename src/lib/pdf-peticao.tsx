/**
 * Template React-PDF para petições geradas pela IA jurídica.
 * Usa o mesmo sistema de timbrado dos demais documentos do escritório.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { EscritorioConfig } from "./escritorio-db";
import { TimbradoHeader, TimbradoFooter } from "./pdf-timbrado";
import { getPdfConfig, buildStyles } from "./pdf-config";

interface PeticaoIaDocProps {
  texto: string;
  titulo: string;
  tipoPeticao: string;
  config?: EscritorioConfig | null;
  logoData?: string | null;
  date: string;
}

// Quebra o texto em linhas, detectando seções em maiúsculas e parágrafos
function parseLinhas(
  texto: string
): { tipo: "secao" | "paragrafo" | "blank"; text: string }[] {
  const linhas = texto.split("\n");
  return linhas.map((linha) => {
    const t = linha.trim();
    if (!t) return { tipo: "blank" as const, text: "" };
    // Seção: linha toda em maiúsculas, ou começa com número romano e ponto
    if (
      (t === t.toUpperCase() && t.length > 3 && /[A-Z]/.test(t)) ||
      /^[IVX]+\.\s/i.test(t) ||
      /^\d+\.\s[A-Z]/.test(t)
    ) {
      return { tipo: "secao" as const, text: t };
    }
    return { tipo: "paragrafo" as const, text: t };
  });
}

export function PeticaoIaDoc({
  texto,
  titulo,
  tipoPeticao,
  config,
  logoData,
  date,
}: PeticaoIaDocProps) {
  const comTimbrado = !!config;
  const cfg = getPdfConfig(config, comTimbrado);
  const s = buildStyles(cfg);

  const linhas = parseLinhas(texto);

  return (
    <Document
      title={titulo}
      author={config?.nome ?? "Escritório de Advocacia"}
      creator="LiderAdv — Dr. Lex IA"
    >
      <Page size="A4" style={s.page}>
        {comTimbrado && config && (
          <TimbradoHeader config={config} logoData={logoData ?? null} />
        )}

        {/* Título da peça */}
        <View style={{ marginBottom: 18 }}>
          <Text
            style={{
              ...s.docTitle,
              fontSize: (config?.tamanho_padrao ?? 12) + 2,
            }}
          >
            {tipoPeticao.toUpperCase()}
          </Text>
        </View>

        {/* Corpo da petição */}
        {linhas.map((linha, i) => {
          if (linha.tipo === "blank") {
            return <View key={i} style={{ height: 8 }} />;
          }
          if (linha.tipo === "secao") {
            return (
              <Text
                key={i}
                style={{ ...s.sectionTitle, marginTop: 14, marginBottom: 6 }}
              >
                {linha.text}
              </Text>
            );
          }
          return (
            <Text key={i} style={{ ...s.body, marginBottom: 4 }}>
              {linha.text}
            </Text>
          );
        })}

        {comTimbrado && config && (
          <TimbradoFooter config={config} date={date} />
        )}
      </Page>
    </Document>
  );
}
