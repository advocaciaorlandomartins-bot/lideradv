import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ClientFull } from "./clients-db";
import type { EscritorioConfig } from "./escritorio-db";
import { TimbradoHeader, TimbradoFooter } from "./pdf-timbrado";
import { getPdfConfig, buildStyles, type PdfPageConfig } from "./pdf-config";

// ── Shared helpers ────────────────────────────────────────────

interface SharedProps {
  config?: EscritorioConfig | null;
  logoData?: string | null;
}

function PageHeader({
  config,
  logoData,
  s,
}: SharedProps & { s: ReturnType<typeof buildStyles> }) {
  if (config) {
    return <TimbradoHeader config={config} logoData={logoData ?? null} />;
  }
  return (
    <View fixed>
      <Text style={s.simpleHeader.firmName}>ADVOCACIA ORLANDO MARTINS</Text>
      <Text style={s.simpleHeader.firmSub}>OAB/SP — Serviços Advocatícios</Text>
      <View style={s.simpleHeader.divider} />
    </View>
  );
}

function PageFooter({
  config,
  date,
  s,
}: SharedProps & { date: string; s: ReturnType<typeof buildStyles> }) {
  if (config) {
    return <TimbradoFooter config={config} date={date} />;
  }
  return (
    <Text style={s.simpleFooter} fixed>
      Documento gerado em {date} — Advocacia Orlando Martins · Todos os direitos
      reservados
    </Text>
  );
}

// Signature block — structure only, font applied inline
function SignatureBlock({
  lines,
  cfg,
}: {
  lines: string[];
  cfg: PdfPageConfig;
}) {
  return (
    <View style={{ width: "45%", alignItems: "center" }}>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#1a1a1a",
          width: "100%",
          marginBottom: 6,
        }}
      />
      {lines.map((line, i) => (
        <Text
          key={i}
          style={{
            fontFamily: cfg.fontRegular,
            fontSize: Math.max(cfg.fontSize - 2, 8),
            textAlign: "center",
            color: "#444",
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

function formatAddress(c: ClientFull) {
  const parts = [c.street, c.addr_number, c.complement].filter(Boolean);
  return `${parts.join(", ")}, ${c.neighborhood}, ${c.city}/${c.state}, CEP ${c.cep}`;
}

function lawyerName(config?: EscritorioConfig | null) {
  return config?.nome?.toUpperCase() ?? "ORLANDO MARTINS";
}
function lawyerOab(config?: EscritorioConfig | null) {
  return config?.oab ?? "OAB/SP";
}

// ── Procuração Ad Judicia ─────────────────────────────────────

export function ProcuracaoDoc({
  client,
  date,
  config,
  logoData,
}: { client: ClientFull; date: string } & SharedProps) {
  const pdfCfg = getPdfConfig(config, !!config);
  const s = buildStyles(pdfCfg);
  const tipoDoc = client.type === "PF" ? "CPF" : "CNPJ";
  const qualificacao =
    client.type === "PF"
      ? `pessoa física, portador(a) do CPF nº ${client.doc}${client.birth_date ? `, nascido(a) em ${new Date(client.birth_date).toLocaleDateString("pt-BR")}` : ""}`
      : `pessoa jurídica, inscrita no CNPJ sob o nº ${client.doc}`;

  return (
    <Document
      title={`Procuração Ad Judicia — ${client.name}`}
      author={config?.nome ?? "Advocacia Orlando Martins"}
    >
      <Page size="A4" style={s.page}>
        <PageHeader config={config} logoData={logoData} s={s} />

        <Text style={[s.docTitle, { marginBottom: 28 }]}>
          PROCURAÇÃO AD JUDICIA ET EXTRA
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            Pelo presente instrumento particular de mandato,{" "}
            <Text style={{ fontFamily: pdfCfg.fontBold }}>
              {client.name.toUpperCase()}
            </Text>
            , {qualificacao}, residente e domiciliado(a) em{" "}
            {formatAddress(client)}, e-mail {client.email}, telefone{" "}
            {client.phone}, doravante denominado(a) simplesmente OUTORGANTE,
            nomeia e constitui como seu(sua) bastante procurador(a) o(a) Dr(a).{" "}
            <Text style={{ fontFamily: pdfCfg.fontBold }}>
              {lawyerName(config)}, Advogado(a)
            </Text>
            , inscrito(a) na Ordem dos Advogados do Brasil
            {config?.oab ? `, ${config.oab}` : ", Seção de São Paulo (OAB/SP)"},
            ao qual outorga os poderes da cláusula AD JUDICIA ET EXTRA, em
            geral, e em especial para:
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          {[
            "• Representar o(a) OUTORGANTE em todos os atos e termos do processo e dos que dele se originarem, podendo assinar petições, requerimentos e demais documentos;",
            "• Interpor recursos, desistir, transigir, firmar compromisso, receber e dar quitação;",
            "• Substabelecer com ou sem reservas de iguais poderes;",
            "• Praticar todos os atos necessários ao bom e fiel cumprimento do presente mandato.",
          ].map((line, i) => (
            <Text key={i} style={s.body}>
              {line}
            </Text>
          ))}
        </View>

        <Text style={[s.indent, { marginTop: 8 }]}>
          {client.city}, {date}.
        </Text>

        <View
          style={{
            marginTop: 60,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <SignatureBlock
            cfg={pdfCfg}
            lines={[
              client.name.toUpperCase(),
              `${tipoDoc}: ${client.doc}`,
              "Outorgante",
            ]}
          />
          <SignatureBlock
            cfg={pdfCfg}
            lines={[
              lawyerName(config),
              `Advogado(a) — ${lawyerOab(config)}`,
              "Outorgado(a)",
            ]}
          />
        </View>

        <PageFooter config={config} logoData={logoData} date={date} s={s} />
      </Page>
    </Document>
  );
}

// ── Contrato de Honorários ────────────────────────────────────

export function ContratoHonorariosDoc({
  client,
  date,
  config,
  logoData,
}: { client: ClientFull; date: string } & SharedProps) {
  const pdfCfg = getPdfConfig(config, !!config);
  const s = buildStyles(pdfCfg);
  const qualificacao =
    client.type === "PF"
      ? `pessoa física, portador(a) do CPF nº ${client.doc}`
      : `pessoa jurídica, inscrita no CNPJ sob o nº ${client.doc}`;
  const escritorioLocal =
    config?.cidade && config?.estado
      ? `${config.cidade}/${config.estado}`
      : `${client.city}/${client.state}`;

  return (
    <Document
      title={`Contrato de Honorários — ${client.name}`}
      author={config?.nome ?? "Advocacia Orlando Martins"}
    >
      <Page size="A4" style={s.page}>
        <PageHeader config={config} logoData={logoData} s={s} />

        <Text style={s.docTitle}>
          CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
        </Text>

        {/* Partes */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Partes</Text>
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            <Text style={s.dataLabel}>CONTRATANTE:</Text>
            <Text style={s.dataValue}>
              {client.name.toUpperCase()}, {qualificacao}, residente/sediado(a)
              em {client.city}/{client.state}, e-mail: {client.email}, tel.:{" "}
              {client.phone}.
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Text style={s.dataLabel}>CONTRATADO:</Text>
            <Text style={s.dataValue}>
              {lawyerName(config)}, Advogado(a), inscrito(a) na{" "}
              {lawyerOab(config)}, com endereço profissional em{" "}
              {escritorioLocal}.
            </Text>
          </View>
        </View>

        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: "#1E3A8A",
            marginBottom: 16,
          }}
        />

        {/* Cláusulas */}
        <View style={{ marginBottom: 16 }}>
          {[
            [
              "Cláusula 1ª — Do Objeto",
              "O(A) CONTRATADO(A) compromete-se a prestar ao(à) CONTRATANTE serviços de consultoria e assessoria jurídica, bem como representação judicial e extrajudicial, nas áreas e casos que lhe forem confiados, de acordo com as normas do Estatuto da OAB.",
            ],
            [
              "Cláusula 2ª — Dos Honorários",
              "Os honorários advocatícios serão fixados de acordo com a tabela da OAB e negociados entre as partes para cada demanda específica, podendo ser pagos de forma parcelada conforme acordo entre as partes.",
            ],
            [
              "Cláusula 3ª — Da Vigência",
              "O presente contrato vigorará pelo prazo determinado para cada demanda judicial ou extrajudicial confiada ao(à) CONTRATADO(A), podendo ser rescindido por qualquer das partes, mediante notificação prévia de 15 (quinze) dias.",
            ],
            [
              `Cláusula 4ª — Do Foro`,
              `As partes elegem o Foro da Comarca de ${client.city}/${client.state} para dirimir quaisquer questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
            ],
          ].map(([title, text], i) => (
            <View key={i}>
              <Text style={s.clauseTitle}>{title}</Text>
              <Text style={s.indent}>{text}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.indent, { marginTop: 8 }]}>
          {client.city}, {date}.
        </Text>

        <View
          style={{
            marginTop: 60,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <SignatureBlock
            cfg={pdfCfg}
            lines={[client.name.toUpperCase(), "CONTRATANTE"]}
          />
          <SignatureBlock
            cfg={pdfCfg}
            lines={[
              lawyerName(config),
              `Advogado(a) — ${lawyerOab(config)}`,
              "CONTRATADO(A)",
            ]}
          />
        </View>

        <PageFooter config={config} logoData={logoData} date={date} s={s} />
      </Page>
    </Document>
  );
}

// ── Declaração de Hipossuficiência ────────────────────────────

export function DeclaracaoHipossuficienciaDoc({
  client,
  date,
  config,
  logoData,
}: { client: ClientFull; date: string } & SharedProps) {
  const pdfCfg = getPdfConfig(config, !!config);
  const s = buildStyles(pdfCfg);
  const tipoDoc = client.type === "PF" ? "CPF" : "CNPJ";

  return (
    <Document
      title={`Declaração de Hipossuficiência — ${client.name}`}
      author={config?.nome ?? "Advocacia Orlando Martins"}
    >
      <Page size="A4" style={s.page}>
        <PageHeader config={config} logoData={logoData} s={s} />

        <Text style={[s.docTitle, { marginBottom: 28 }]}>
          {"DECLARAÇÃO DE HIPOSSUFICIÊNCIA\n(Art. 99, §3º do CPC)"}
        </Text>

        <View style={{ marginBottom: 16, marginTop: 16 }}>
          <Text style={s.indent}>
            Eu,{" "}
            <Text style={{ fontFamily: pdfCfg.fontBold }}>
              {client.name.toUpperCase()}
            </Text>
            , {client.type === "PF" ? "brasileiro(a), " : ""}portador(a) do{" "}
            {tipoDoc} nº {client.doc}, residente e domiciliado(a) em{" "}
            {formatAddress(client)}, sob as penas da lei, DECLARO que não possuo
            condições financeiras de arcar com as custas processuais e os
            honorários advocatícios sem prejuízo do sustento próprio ou de minha
            família, nos termos do art. 98 do Código de Processo Civil,
            requerendo, portanto, os benefícios da JUSTIÇA GRATUITA.
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            Declaro ainda que as informações prestadas neste documento são
            verdadeiras, estando ciente de que a declaração falsa configura ato
            atentatório à dignidade da justiça (art. 80, inciso I, do CPC),
            sujeitando o declarante às cominações legais.
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            Por ser a expressão da verdade, firmo o presente.
          </Text>
        </View>

        <Text style={[s.body, { marginTop: 8 }]}>
          {client.city}, {date}.
        </Text>

        <View
          style={{
            marginTop: 60,
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <SignatureBlock
            cfg={pdfCfg}
            lines={[
              client.name.toUpperCase(),
              `${tipoDoc}: ${client.doc}`,
              "Declarante",
            ]}
          />
        </View>

        {/* Testemunhas */}
        <View style={{ marginTop: 40 }}>
          <Text
            style={{
              fontFamily: pdfCfg.fontRegular,
              fontSize: Math.max(pdfCfg.fontSize - 2, 9),
              color: "#555",
            }}
          >
            Testemunhas:
          </Text>
          <View
            style={{
              marginTop: 32,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <SignatureBlock cfg={pdfCfg} lines={["Nome:", "CPF:"]} />
            <SignatureBlock cfg={pdfCfg} lines={["Nome:", "CPF:"]} />
          </View>
        </View>

        <PageFooter config={config} logoData={logoData} date={date} s={s} />
      </Page>
    </Document>
  );
}

// ── Comunicado de Honorários ─────────────────────────────────

export interface LancamentoComunicado {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
}

export function ComunicadoHonorariosDoc({
  client,
  lancamentos,
  date,
  config,
  logoData,
}: {
  client: ClientFull;
  lancamentos: LancamentoComunicado[];
  date: string;
} & SharedProps) {
  const pdfCfg = getPdfConfig(config, !!config);
  const s = buildStyles(pdfCfg);
  const total = lancamentos.reduce((sum, l) => sum + l.valor, 0);
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Document
      title={`Comunicado de Honorários — ${client.name}`}
      author={config?.nome ?? "Advocacia Orlando Martins"}
    >
      <Page size="A4" style={s.page}>
        <PageHeader config={config} logoData={logoData} s={s} />

        <Text style={s.docTitle}>COMUNICADO DE HONORÁRIOS ADVOCATÍCIOS</Text>

        {/* Destinatário */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Destinatário</Text>
          {(
            [
              ["Nome:", client.name.toUpperCase()],
              [client.type === "PF" ? "CPF:" : "CNPJ:", client.doc],
              ["E-mail:", client.email],
              ["Telefone:", client.phone],
            ] as [string, string][]
          ).map(([label, value], i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={s.dataLabel}>{label}</Text>
              <Text style={s.dataValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: "#1E3A8A",
            marginBottom: 16,
          }}
        />

        {/* Intro */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            Prezado(a) cliente, comunicamos que os honorários advocatícios
            referentes aos serviços prestados encontram-se disponíveis para
            pagamento, conforme o plano detalhado abaixo.
          </Text>
        </View>

        {/* Tabela de parcelas */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Plano de Pagamento</Text>

          {/* Cabeçalho */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#EEF2FF",
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 4,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                fontFamily: pdfCfg.fontBold,
                fontSize: Math.max(pdfCfg.fontSize - 2, 8),
                flex: 3,
                color: "#1E3A8A",
              }}
            >
              Descrição
            </Text>
            <Text
              style={{
                fontFamily: pdfCfg.fontBold,
                fontSize: Math.max(pdfCfg.fontSize - 2, 8),
                flex: 1.5,
                textAlign: "center",
                color: "#1E3A8A",
              }}
            >
              Vencimento
            </Text>
            <Text
              style={{
                fontFamily: pdfCfg.fontBold,
                fontSize: Math.max(pdfCfg.fontSize - 2, 8),
                flex: 1.5,
                textAlign: "right",
                color: "#1E3A8A",
              }}
            >
              Valor
            </Text>
          </View>

          {lancamentos.length === 0 ? (
            <Text
              style={{
                fontFamily: pdfCfg.fontRegular,
                fontSize: pdfCfg.fontSize,
                color: "#888",
                textAlign: "center",
                padding: 12,
              }}
            >
              Nenhum lançamento pendente encontrado.
            </Text>
          ) : (
            lancamentos.map((l, i) => (
              <View
                key={l.id}
                style={{
                  flexDirection: "row",
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  backgroundColor: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF",
                  borderBottomWidth: 0.5,
                  borderBottomColor: "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    fontFamily: pdfCfg.fontRegular,
                    fontSize: Math.max(pdfCfg.fontSize - 1, 8),
                    flex: 3,
                    color: "#1a1a1a",
                  }}
                >
                  {l.parcela_atual && l.total_parcelas
                    ? `${l.descricao} (${l.parcela_atual}/${l.total_parcelas})`
                    : l.descricao}
                </Text>
                <Text
                  style={{
                    fontFamily: pdfCfg.fontRegular,
                    fontSize: Math.max(pdfCfg.fontSize - 1, 8),
                    flex: 1.5,
                    textAlign: "center",
                    color: "#555",
                  }}
                >
                  {l.data_vencimento ?? "—"}
                </Text>
                <Text
                  style={{
                    fontFamily: pdfCfg.fontRegular,
                    fontSize: Math.max(pdfCfg.fontSize - 1, 8),
                    flex: 1.5,
                    textAlign: "right",
                    color: "#1a1a1a",
                  }}
                >
                  {fmt(l.valor)}
                </Text>
              </View>
            ))
          )}

          {/* Total */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: "#1E3A8A",
              borderRadius: 4,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontFamily: pdfCfg.fontBold,
                fontSize: Math.max(pdfCfg.fontSize - 1, 8),
                flex: 4.5,
                color: "#FFFFFF",
              }}
            >
              Total
            </Text>
            <Text
              style={{
                fontFamily: pdfCfg.fontBold,
                fontSize: Math.max(pdfCfg.fontSize - 1, 8),
                flex: 1.5,
                textAlign: "right",
                color: "#FFFFFF",
              }}
            >
              {fmt(total)}
            </Text>
          </View>
        </View>

        {/* Observação */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            Em caso de dúvidas sobre o plano de pagamento ou para solicitar
            outras formas de quitação, entre em contato com nosso escritório.
          </Text>
        </View>

        <Text style={[s.body, { marginTop: 8 }]}>
          {client.city}, {date}.
        </Text>

        <View
          style={{
            marginTop: 60,
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <SignatureBlock
            cfg={pdfCfg}
            lines={[lawyerName(config), `Advogado(a) — ${lawyerOab(config)}`]}
          />
        </View>

        <PageFooter config={config} logoData={logoData} date={date} s={s} />
      </Page>
    </Document>
  );
}

// ── Notificação Extrajudicial ─────────────────────────────────

export function NotificacaoExtrajudicialDoc({
  client,
  date,
  config,
  logoData,
}: { client: ClientFull; date: string } & SharedProps) {
  const pdfCfg = getPdfConfig(config, !!config);
  const s = buildStyles(pdfCfg);

  return (
    <Document
      title={`Notificação Extrajudicial — ${client.name}`}
      author={config?.nome ?? "Advocacia Orlando Martins"}
    >
      <Page size="A4" style={s.page}>
        <PageHeader config={config} logoData={logoData} s={s} />

        <Text style={s.docTitle}>NOTIFICAÇÃO EXTRAJUDICIAL</Text>

        {/* Notificante */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Notificante</Text>
          {[
            ["Nome:", client.name.toUpperCase()],
            [client.type === "PF" ? "CPF:" : "CNPJ:", client.doc],
            ["Endereço:", formatAddress(client)],
            ["Contato:", `${client.email} | ${client.phone}`],
          ].map(([label, value], i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={s.dataLabel}>{label}</Text>
              <Text style={s.dataValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: "#1E3A8A",
            marginBottom: 16,
          }}
        />

        {/* Notificado */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Notificado(a)</Text>
          {["Nome:", "CPF/CNPJ:", "Endereço:"].map((label, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={s.dataLabel}>{label}</Text>
              <Text style={s.dataValue}>
                _______________________________________________
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: "#1E3A8A",
            marginBottom: 16,
          }}
        />

        {/* Objeto */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Objeto da Notificação</Text>
          <Text style={s.indent}>
            O(A) NOTIFICANTE, por meio de seu(sua) advogado(a) devidamente
            constituído(a), vem NOTIFICAR V. Sa. para que, no prazo de 10 (dez)
            dias úteis a contar do recebimento desta notificação, adote as
            providências necessárias em relação a:{" "}
          </Text>
          <Text
            style={{
              fontFamily: pdfCfg.fontRegular,
              fontSize: Math.max(pdfCfg.fontSize - 1, 9),
              marginTop: 12,
              color: "#888",
            }}
          >
            [Descrever o objeto específico da notificação]
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={s.indent}>
            O não atendimento desta notificação no prazo estabelecido ensejará a
            adoção das medidas judiciais cabíveis, com todos os ônus legais
            decorrentes, incluindo perdas e danos, custas processuais e
            honorários advocatícios.
          </Text>
        </View>

        <Text style={[s.body, { marginTop: 8 }]}>
          {client.city}, {date}.
        </Text>

        <View
          style={{
            marginTop: 60,
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <SignatureBlock
            cfg={pdfCfg}
            lines={[
              lawyerName(config),
              `Advogado(a) — ${lawyerOab(config)}`,
              "Procurador(a) do(a) Notificante",
            ]}
          />
        </View>

        <PageFooter config={config} logoData={logoData} date={date} s={s} />
      </Page>
    </Document>
  );
}
