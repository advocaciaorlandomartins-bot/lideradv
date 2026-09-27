import { Document, Page, Text, View } from "@react-pdf/renderer";
import { getPdfConfig, buildStyles } from "./pdf-config";
import type { EscritorioConfig } from "./escritorio-db";

export interface ProcessoRelatorioItem {
  clientName: string;
  numero: string | null;
  area: string;
  statusLabel: string;
  faseLabel: string;
  varaComarca: string;
}

interface Props {
  itens: ProcessoRelatorioItem[];
  config: EscritorioConfig | null;
  dataGeracao: string;
}

const COLUNAS = [
  { label: "Cliente", width: 23 },
  { label: "Processo", width: 21 },
  { label: "Área", width: 12 },
  { label: "Status", width: 11 },
  { label: "Fase", width: 13 },
  { label: "Vara / Comarca", width: 20 },
] as const;

export function RelatorioProcessosDoc({ itens, config, dataGeracao }: Props) {
  const pdfCfg = getPdfConfig(config, false);
  const s = buildStyles(pdfCfg);
  const identificacaoAtiva = !config || config.identificacao_ativo;
  const nomeExibido = identificacaoAtiva
    ? (config?.nome ?? "Orlando Martins Advocacia")
    : "Advocacia";
  const cellFontSize = Math.max(pdfCfg.fontSize - 2, 9);
  const cellStyle = (width: number) => ({
    width: `${width}%`,
    paddingRight: 6,
    fontSize: cellFontSize,
  });

  return (
    <Document title={`Relatório de Processos — ${dataGeracao}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text
          style={{
            fontFamily: pdfCfg.fontBold,
            fontSize: pdfCfg.fontSize + 1,
            textAlign: "center",
            marginBottom: 2,
          }}
        >
          {nomeExibido.toUpperCase()}
        </Text>
        <Text
          style={{
            ...s.docTitle,
            fontSize: pdfCfg.fontSize + 2,
            marginBottom: 2,
          }}
        >
          RELATÓRIO DE PROCESSOS
        </Text>
        <Text
          style={{
            fontFamily: pdfCfg.fontRegular,
            fontSize: Math.max(pdfCfg.fontSize - 3, 8),
            textAlign: "center",
            marginBottom: 14,
            color: "#555",
          }}
        >
          Gerado em {dataGeracao} · {itens.length} processo
          {itens.length !== 1 ? "s" : ""}
        </Text>

        <View
          fixed
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: "#1a1a1a",
            paddingBottom: 4,
            marginBottom: 2,
          }}
        >
          {COLUNAS.map((c) => (
            <Text
              key={c.label}
              style={{
                ...cellStyle(c.width),
                fontFamily: pdfCfg.fontBold,
              }}
            >
              {c.label}
            </Text>
          ))}
        </View>

        {itens.map((p, i) => (
          <View
            key={i}
            wrap={false}
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
              borderBottomColor: "#ddd",
              paddingVertical: 3,
            }}
          >
            <Text style={cellStyle(COLUNAS[0].width)}>{p.clientName}</Text>
            <Text style={cellStyle(COLUNAS[1].width)}>{p.numero ?? "—"}</Text>
            <Text style={cellStyle(COLUNAS[2].width)}>{p.area}</Text>
            <Text style={cellStyle(COLUNAS[3].width)}>{p.statusLabel}</Text>
            <Text style={cellStyle(COLUNAS[4].width)}>{p.faseLabel}</Text>
            <Text style={cellStyle(COLUNAS[5].width)}>{p.varaComarca}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
