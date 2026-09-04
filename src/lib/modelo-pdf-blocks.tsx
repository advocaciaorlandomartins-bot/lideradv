/**
 * Renderiza a árvore estruturada de blocos (ver modelo-blocks.ts) como
 * elementos @react-pdf/renderer — negrito/itálico/sublinhado/cor por span,
 * títulos, listas, tabelas, caixas destacadas (callout) e linha de
 * assinatura. Usado por ModeloPdfDoc quando o modelo tem conteudo_blocks.
 */
import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { Block, TextSpan } from "./modelo-blocks";
import {
  getFontVariants,
  type PdfPageConfig,
  type buildStyles,
} from "./pdf-config";

type Styles = ReturnType<typeof buildStyles>;

function spanFontFamily(cfg: PdfPageConfig, span: TextSpan): string {
  const variants = span.font
    ? getFontVariants(span.font)
    : {
        regular: cfg.fontRegular,
        bold: cfg.fontBold,
        italic: cfg.fontItalic,
        boldItalic: cfg.fontBoldItalic,
      };
  if (span.bold && span.italic) return variants.boldItalic;
  if (span.bold) return variants.bold;
  if (span.italic) return variants.italic;
  return variants.regular;
}

// Documentos gerados são sempre preto e branco — cor/destaque de span ou
// bloco vindos da IA (ou salvos em modelos antigos) são ignorados de
// propósito, não é só falta de instrução no prompt.
function renderSpans(spans: TextSpan[], cfg: PdfPageConfig, fontSize: number) {
  return spans.map((span, i) => (
    <Text
      key={i}
      style={{
        fontFamily: spanFontFamily(cfg, span),
        fontSize,
        textDecoration: span.underline ? ("underline" as const) : undefined,
        color: "#1a1a1a",
      }}
    >
      {span.text}
    </Text>
  ));
}

export function renderBlocks(
  blocks: Block[],
  s: Styles,
  pdfCfg: PdfPageConfig
): ReactElement[] {
  return blocks.map((block, idx): ReactElement => {
    switch (block.type) {
      case "paragraph":
        return (
          <Text
            key={idx}
            style={[
              s.body,
              { textAlign: block.align ?? "justify", marginBottom: 10 },
            ]}
          >
            {renderSpans(block.spans, pdfCfg, pdfCfg.fontSize)}
          </Text>
        );

      case "heading": {
        const base =
          block.level === 1
            ? s.docTitle
            : block.level === 2
              ? s.sectionTitle
              : s.clauseTitle;
        return (
          <Text
            key={idx}
            style={{
              ...base,
              ...(block.align ? { textAlign: block.align } : {}),
            }}
          >
            {renderSpans(block.spans, pdfCfg, base.fontSize)}
          </Text>
        );
      }

      case "list":
        return (
          <View key={idx} style={{ marginBottom: 10 }}>
            {block.items.map((item, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text
                  style={{
                    fontFamily: pdfCfg.fontRegular,
                    fontSize: pdfCfg.fontSize,
                    width: 16,
                  }}
                >
                  {block.ordered ? `${i + 1}.` : "•"}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: pdfCfg.fontRegular,
                    fontSize: pdfCfg.fontSize,
                    lineHeight: pdfCfg.lineHeight,
                    textAlign: "justify",
                  }}
                >
                  {renderSpans(item, pdfCfg, pdfCfg.fontSize)}
                </Text>
              </View>
            ))}
          </View>
        );

      case "divider":
        return (
          <View
            key={idx}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "#1E3A8A",
              marginTop: 8,
              marginBottom: 14,
            }}
          />
        );

      case "table":
        return (
          <View
            key={idx}
            style={{
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#D1D5DB",
            }}
          >
            {block.rows.map((row, ri) => (
              <View
                key={ri}
                style={{
                  flexDirection: "row",
                  borderBottomWidth: ri < block.rows.length - 1 ? 1 : 0,
                  borderBottomColor: "#D1D5DB",
                }}
              >
                {row.map((cell, ci) => (
                  <View
                    key={ci}
                    style={{
                      flex: 1,
                      padding: 6,
                      borderRightWidth: ci < row.length - 1 ? 1 : 0,
                      borderRightColor: "#D1D5DB",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: pdfCfg.fontRegular,
                        fontSize: Math.max(pdfCfg.fontSize - 1, 9),
                        lineHeight: 1.4,
                      }}
                    >
                      {renderSpans(
                        cell,
                        pdfCfg,
                        Math.max(pdfCfg.fontSize - 1, 9)
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );

      case "callout": {
        return (
          <View
            key={idx}
            style={{
              marginBottom: 14,
              backgroundColor: "#f8f8f8",
              borderLeftWidth: 3,
              borderLeftColor: "#1a1a1a",
              padding: 10,
            }}
          >
            {block.title && (
              <Text
                wrap={false}
                style={{
                  fontFamily: pdfCfg.fontBold,
                  fontSize: pdfCfg.fontSize,
                  color: "#1a1a1a",
                  marginBottom: 4,
                }}
              >
                {block.title}
              </Text>
            )}
            <Text
              style={{
                fontFamily: pdfCfg.fontRegular,
                fontSize: pdfCfg.fontSize,
                lineHeight: pdfCfg.lineHeight,
                textAlign: "justify",
              }}
            >
              {renderSpans(block.spans, pdfCfg, pdfCfg.fontSize)}
            </Text>
          </View>
        );
      }

      case "signatureLine":
        return (
          <View
            key={idx}
            wrap={false}
            style={{ marginTop: 40, alignSelf: "center", width: 260 }}
          >
            <View
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#1a1a1a",
                width: "100%",
                marginBottom: 6,
              }}
            />
            <Text style={s.signatureLabel}>{block.label}</Text>
          </View>
        );
    }
  });
}
