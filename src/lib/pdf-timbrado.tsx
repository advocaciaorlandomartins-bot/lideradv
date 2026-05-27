/**
 * Papel timbrado compartilhado para todos os templates PDF.
 * Quatro modelos: classico | centralizado | executivo | compacto
 */
import { Text, View, Image } from "@react-pdf/renderer";
import type { EscritorioConfig } from "./escritorio-db";

// Re-export so existing callers that import from here still work
export { TIMBRADO_PADDING_TOP, DEFAULT_PADDING_TOP } from "./pdf-config";

const FONT_MAP: Record<string, { regular: string; bold: string }> = {
  Arial: { regular: "Helvetica", bold: "Helvetica-Bold" },
  Times: { regular: "Times-Roman", bold: "Times-Bold" },
  Courier: { regular: "Courier", bold: "Courier-Bold" },
  Helvetica: { regular: "Helvetica", bold: "Helvetica-Bold" },
};

function getFonts(config: EscritorioConfig) {
  return FONT_MAP[config.font_padrao ?? "Times"] ?? FONT_MAP.Times;
}

// ── Shared dividers ───────────────────────────────────────────────

function DoubleDivider({ mt = 10 }: { mt?: number }) {
  return (
    <>
      <View
        style={{
          borderBottomWidth: 3,
          borderBottomColor: "#1E3A8A",
          marginTop: mt,
          marginBottom: 4,
        }}
      />
      <View
        style={{
          borderBottomWidth: 0.5,
          borderBottomColor: "#B45309",
          marginBottom: 20,
        }}
      />
    </>
  );
}

function SingleDivider() {
  return (
    <View
      style={{
        borderBottomWidth: 2,
        borderBottomColor: "#1E3A8A",
        marginTop: 8,
        marginBottom: 18,
      }}
    />
  );
}

// ── Layout variants ───────────────────────────────────────────────

interface HeaderProps {
  config: EscritorioConfig;
  logoData: string | null;
}

function HeaderClassico({ config, logoData }: HeaderProps) {
  const { regular, bold } = getFonts(config);
  const base = config.tamanho_padrao ?? 12;

  const contact = [config.telefone, config.email, config.site]
    .filter(Boolean)
    .join(" · ");
  const addr = [
    config.endereco,
    config.cidade && config.estado
      ? `${config.cidade}/${config.estado}`
      : (config.cidade ?? config.estado),
    config.cep ? `CEP ${config.cep}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {logoData && (
          <View
            style={{
              width: 76,
              height: 76,
              marginRight: 16,
              flexShrink: 0,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              src={logoData}
              style={{ width: 76, height: 76, objectFit: "contain" }}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: bold,
              fontSize: base + 3,
              color: "#1E3A8A",
              letterSpacing: 0.4,
            }}
          >
            {config.nome.toUpperCase()}
          </Text>
          {config.oab && (
            <Text
              style={{
                fontFamily: regular,
                fontSize: Math.max(base - 2, 9),
                color: "#374151",
                marginTop: 3,
              }}
            >
              {config.oab}
            </Text>
          )}
          {contact.length > 0 && (
            <Text
              style={{
                fontFamily: regular,
                fontSize: Math.max(base - 3, 8),
                color: "#6B7280",
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              {contact}
            </Text>
          )}
          {addr.length > 0 && (
            <Text
              style={{
                fontFamily: regular,
                fontSize: Math.max(base - 3, 8),
                color: "#6B7280",
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              {addr}
            </Text>
          )}
        </View>
      </View>
      <DoubleDivider />
    </>
  );
}

function HeaderCentralizado({ config, logoData }: HeaderProps) {
  const { regular, bold } = getFonts(config);
  const base = config.tamanho_padrao ?? 12;

  const contact = [config.telefone, config.email, config.site]
    .filter(Boolean)
    .join(" · ");
  const addr = [
    config.endereco,
    config.cidade && config.estado
      ? `${config.cidade}/${config.estado}`
      : (config.cidade ?? config.estado),
    config.cep ? `CEP ${config.cep}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View style={{ alignItems: "center" }}>
        {logoData && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            src={logoData}
            style={{
              width: 60,
              height: 60,
              objectFit: "contain",
              marginBottom: 8,
            }}
          />
        )}
        <Text
          style={{
            fontFamily: bold,
            fontSize: base + 3,
            color: "#1E3A8A",
            letterSpacing: 0.5,
            textAlign: "center",
          }}
        >
          {config.nome.toUpperCase()}
        </Text>
        {config.oab && (
          <Text
            style={{
              fontFamily: regular,
              fontSize: Math.max(base - 2, 9),
              color: "#374151",
              marginTop: 3,
              textAlign: "center",
            }}
          >
            {config.oab}
          </Text>
        )}
        {contact.length > 0 && (
          <Text
            style={{
              fontFamily: regular,
              fontSize: Math.max(base - 3, 8),
              color: "#6B7280",
              marginTop: 3,
              textAlign: "center",
            }}
          >
            {contact}
          </Text>
        )}
        {addr.length > 0 && (
          <Text
            style={{
              fontFamily: regular,
              fontSize: Math.max(base - 3, 8),
              color: "#6B7280",
              marginTop: 2,
              textAlign: "center",
            }}
          >
            {addr}
          </Text>
        )}
      </View>
      <DoubleDivider mt={12} />
    </>
  );
}

function HeaderExecutivo({ config, logoData }: HeaderProps) {
  const { regular, bold } = getFonts(config);
  const base = config.tamanho_padrao ?? 12;

  const infoLine = [config.oab, config.telefone, config.email]
    .filter(Boolean)
    .join(" · ");
  const addrLine = [
    config.endereco,
    config.cidade && config.estado
      ? `${config.cidade}/${config.estado}`
      : (config.cidade ?? config.estado),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: bold,
              fontSize: base + 5,
              color: "#1E3A8A",
              letterSpacing: 0.3,
            }}
          >
            {config.nome.toUpperCase()}
          </Text>
          {infoLine.length > 0 && (
            <Text
              style={{
                fontFamily: regular,
                fontSize: Math.max(base - 2, 9),
                color: "#374151",
                marginTop: 4,
              }}
            >
              {infoLine}
            </Text>
          )}
          {addrLine.length > 0 && (
            <Text
              style={{
                fontFamily: regular,
                fontSize: Math.max(base - 3, 8),
                color: "#6B7280",
                marginTop: 2,
              }}
            >
              {addrLine}
            </Text>
          )}
        </View>
        {logoData && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            src={logoData}
            style={{
              width: 52,
              height: 52,
              objectFit: "contain",
              marginLeft: 16,
              flexShrink: 0,
            }}
          />
        )}
      </View>
      <DoubleDivider />
    </>
  );
}

function HeaderCompacto({ config, logoData }: HeaderProps) {
  const { regular, bold } = getFonts(config);
  const base = config.tamanho_padrao ?? 12;

  const contact = [config.telefone, config.email].filter(Boolean).join(" · ");

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {logoData && (
            <Image
              src={logoData}
              style={{
                width: 40,
                height: 40,
                objectFit: "contain",
                marginRight: 12,
              }}
            />
          )}
          <View>
            <Text
              style={{ fontFamily: bold, fontSize: base + 1, color: "#1E3A8A" }}
            >
              {config.nome.toUpperCase()}
            </Text>
            {config.oab && (
              <Text
                style={{
                  fontFamily: regular,
                  fontSize: Math.max(base - 3, 8),
                  color: "#374151",
                  marginTop: 1,
                }}
              >
                {config.oab}
              </Text>
            )}
          </View>
        </View>
        {contact.length > 0 && (
          <Text
            style={{
              fontFamily: regular,
              fontSize: Math.max(base - 3, 8),
              color: "#6B7280",
              textAlign: "right",
            }}
          >
            {contact}
          </Text>
        )}
      </View>
      <SingleDivider />
    </>
  );
}

// ── Public components ─────────────────────────────────────────────

interface TimbradoHeaderProps {
  config: EscritorioConfig;
  logoData: string | null;
}

export function TimbradoHeader({ config, logoData }: TimbradoHeaderProps) {
  const modelo = config.modelo_timbrado ?? "classico";

  return (
    <View fixed>
      {modelo === "centralizado" && (
        <HeaderCentralizado config={config} logoData={logoData} />
      )}
      {modelo === "executivo" && (
        <HeaderExecutivo config={config} logoData={logoData} />
      )}
      {modelo === "compacto" && (
        <HeaderCompacto config={config} logoData={logoData} />
      )}
      {modelo !== "centralizado" &&
        modelo !== "executivo" &&
        modelo !== "compacto" && (
          <HeaderClassico config={config} logoData={logoData} />
        )}
    </View>
  );
}

interface TimbradoFooterProps {
  config: EscritorioConfig;
  date: string;
}

export function TimbradoFooter({ config, date }: TimbradoFooterProps) {
  const { regular } = getFonts(config);
  const base = config.tamanho_padrao ?? 12;
  const footerSize = Math.max(base - 4, 7);

  const infoLine = [config.nome, config.oab, config.telefone, config.email]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{ position: "absolute", bottom: 36, left: 56, right: 56 }}
      fixed
    >
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#D1D5DB",
          marginBottom: 6,
        }}
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: regular,
            fontSize: footerSize,
            color: "#9CA3AF",
            lineHeight: 1.4,
          }}
        >
          {infoLine}
        </Text>
        <Text
          style={{
            fontFamily: regular,
            fontSize: footerSize,
            color: "#9CA3AF",
          }}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages} · ${date}`
          }
        />
      </View>
    </View>
  );
}

/** Helper usado nos API routes para converter logo URL → base64 data URI */
export async function fetchLogoAsDataUri(
  logoUrl: string
): Promise<string | null> {
  // Já é data URI — não precisa buscar
  if (logoUrl.startsWith("data:")) return logoUrl;
  try {
    const res = await fetch(logoUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}
