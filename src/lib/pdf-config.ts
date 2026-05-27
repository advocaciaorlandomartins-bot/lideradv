import type { EscritorioConfig } from "./escritorio-db";

/** 1 mm in PDF points */
const MM = 2.835;

export const DEFAULT_PADDING_TOP = 72;

function getTimbradoPaddingTop(modelo?: string): number {
  switch (modelo) {
    case "centralizado":
      return 190;
    case "executivo":
      return 148;
    case "compacto":
      return 100;
    default:
      return 158; // classico
  }
}

/** Keep exported for backward-compat re-exports in pdf-timbrado.tsx */
export const TIMBRADO_PADDING_TOP = 158;

const FONT_MAP: Record<string, { regular: string; bold: string }> = {
  Arial: { regular: "Helvetica", bold: "Helvetica-Bold" },
  Times: { regular: "Times-Roman", bold: "Times-Bold" },
  Courier: { regular: "Courier", bold: "Courier-Bold" },
  Helvetica: { regular: "Helvetica", bold: "Helvetica-Bold" },
};

export interface PdfPageConfig {
  fontRegular: string;
  fontBold: string;
  fontSize: number;
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
}

export function getPdfConfig(
  config: EscritorioConfig | null | undefined,
  withLetterhead: boolean
): PdfPageConfig {
  const fontKey = config?.font_padrao ?? "Times";
  const fonts = FONT_MAP[fontKey] ?? FONT_MAP.Times;

  const fontSize = config?.tamanho_padrao ?? 12;
  const lineHeight = config?.line_height ?? 1.8;

  const topPt = (config?.margem_topo ?? 25) * MM;
  const bottomPt = (config?.margem_inferior ?? 28) * MM;
  const leftPt = (config?.margem_esquerda ?? 25) * MM;
  const rightPt = (config?.margem_direita ?? 25) * MM;

  // When letterhead is active the fixed header needs its own room (varies by layout)
  const paddingTop = withLetterhead
    ? getTimbradoPaddingTop(config?.modelo_timbrado)
    : topPt;

  return {
    fontRegular: fonts.regular,
    fontBold: fonts.bold,
    fontSize,
    lineHeight,
    paddingTop,
    paddingBottom: bottomPt,
    paddingLeft: leftPt,
    paddingRight: rightPt,
  };
}

/** Pre-built style objects derived from PdfPageConfig — use as inline styles */
export function buildStyles(cfg: PdfPageConfig) {
  const {
    fontRegular,
    fontBold,
    fontSize,
    lineHeight,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  } = cfg;

  return {
    page: {
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      fontFamily: fontRegular,
      fontSize,
      color: "#1a1a1a",
    },
    body: {
      fontFamily: fontRegular,
      fontSize,
      lineHeight,
      textAlign: "justify" as const,
    },
    indent: {
      fontFamily: fontRegular,
      fontSize,
      lineHeight,
      textAlign: "justify" as const,
      textIndent: 36,
    },
    docTitle: {
      fontFamily: fontBold,
      fontSize: fontSize + 2,
      textAlign: "center" as const,
      letterSpacing: 0.5,
      marginBottom: 24,
      textDecoration: "underline" as const,
    },
    sectionTitle: {
      fontFamily: fontBold,
      fontSize: Math.max(fontSize - 1, 9),
      marginBottom: 6,
      textTransform: "uppercase" as const,
      letterSpacing: 0.3,
    },
    clauseTitle: {
      fontFamily: fontBold,
      fontSize,
      marginBottom: 4,
      marginTop: 12,
    },
    dataLabel: {
      fontFamily: fontBold,
      fontSize: Math.max(fontSize - 1, 9),
      width: 120,
    },
    dataValue: {
      fontFamily: fontRegular,
      fontSize: Math.max(fontSize - 1, 9),
      flex: 1,
    },
    signatureLabel: {
      fontFamily: fontRegular,
      fontSize: Math.max(fontSize - 2, 8),
      textAlign: "center" as const,
      color: "#444",
    },
    simpleHeader: {
      firmName: {
        fontFamily: fontBold,
        fontSize: fontSize + 2,
        letterSpacing: 0.5,
        textAlign: "center" as const,
      },
      firmSub: {
        fontFamily: fontRegular,
        fontSize: Math.max(fontSize - 2, 9),
        color: "#555",
        textAlign: "center" as const,
        marginBottom: 24,
      },
      divider: {
        borderBottomWidth: 1,
        borderBottomColor: "#1E3A8A",
        marginBottom: 24,
      },
    },
    simpleFooter: {
      position: "absolute" as const,
      bottom: 40,
      left: paddingLeft,
      right: paddingRight,
      textAlign: "center" as const,
      fontSize: Math.max(fontSize - 3, 7),
      color: "#888",
      borderTopWidth: 1,
      borderTopColor: "#ddd",
      paddingTop: 8,
    },
  };
}
