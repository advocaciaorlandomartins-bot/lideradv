import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { enviarEmailNovaPublicacao } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Formato atual enviado pelo TramitaSign (v2)
interface PublicacaoTramitaV2 {
  id?: number;
  uuid?: string;
  link?: string;
  texto?: string;
  nomeOrgao?: string;
  created_at?: string;
  nomeClasse?: string;
  destinatarios?: { nome: string; polo?: string }[];
}

// Formato legado (v1 — mantido para compatibilidade)
interface AdvogadoTramita {
  advogado: { nome: string; uf_oab: string; numero_oab: string };
}
interface PublicacaoTramitaV1 {
  iid?: number;
  data_disponibilizacao?: string;
  publication_date?: string;
  data?: {
    siglaTribunal?: string;
    tipoDocumento?: string;
    link?: string;
    nomeOrgao?: string;
    numeroprocessocommascara?: string;
    destinatarios?: { nome: string }[];
    destinatarioadvogados?: AdvogadoTramita[];
  };
  sanitized_text?: string | null;
  summary?: {
    resumo?: string | null;
    prazo?: number | null;
    necessidade_acao?: string | null;
    data_audiencia?: string | null;
  } | null;
}

// Campos normalizados para inserção
interface PubNormalizada {
  processo: string;
  tipo: string;
  tribunal: string;
  orgao: string;
  link: string | null;
  disponibilizacao: string;
  destinatario: string;
  advogados: string[];
  conteudoCompleto: string | null;
  resumo: string | null;
  prazo: number | null;
  acaoNecessaria: string | null;
}

function extrairTribunal(link?: string): string {
  if (!link) return "";
  try {
    const host = new URL(link).hostname;
    const parts = host.split(".");
    const jidx = parts.lastIndexOf("jus");
    if (jidx > 0) return parts[jidx - 1].toUpperCase();
  } catch {
    // URL inválida
  }
  return "";
}

function extrairProcessoDoTexto(texto?: string): string {
  if (!texto) return "";
  // Remove quebras de linha para não partir o número entre linhas
  const joined = texto.replace(/[\r\n]+/g, " ");
  // Aceita vários formatos: "PROCESSO: ...", "Proc. nº ...", número CNJ solto
  const patterns = [
    /PROCESSO\s*:?\s*N?[Oº°]?\s*\.?\s*(\d{5,7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
    /proc(?:esso)?\s*(?:n[oº°]|nº|\.?)?\s*[:\-]?\s*(\d{5,7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i,
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
    /(\d{5,7}\/\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
  ];
  for (const p of patterns) {
    const m = joined.match(p);
    if (m?.[1]) return m[1].replace(/\//g, "-");
  }
  return "";
}

function normalizarV2(pub: PublicacaoTramitaV2): PubNormalizada | null {
  const processo =
    extrairProcessoDoTexto(pub.texto) ||
    `tramita-${pub.uuid ?? pub.id ?? Date.now()}`;
  const disponibilizacao =
    (pub.created_at ? pub.created_at.slice(0, 10) : null) ??
    new Date().toISOString().slice(0, 10);
  return {
    processo,
    tipo: pub.nomeClasse ?? "Publicação",
    tribunal: extrairTribunal(pub.link),
    orgao: pub.nomeOrgao ?? "—",
    link: pub.link ?? null,
    disponibilizacao,
    // "destinatario" é NOT NULL no banco — publicações de edital/despacho
    // genérico sem parte nomeada chegam sem destinatarios[], e mandar null
    // aqui derrubava o INSERT inteiro (constraint violation) sem try/catch
    // ao redor, perdendo a publicação (e as seguintes do mesmo lote, já
    // que o erro subia cru e abortava o handler). Mesmo fallback "—" já
    // usado em dje-esaj.ts pro mesmo caso.
    destinatario: pub.destinatarios?.[0]?.nome ?? "—",
    // V2 não traz destinatarioadvogados (só existe no formato v1) — não dá
    // pra inventar esse dado.
    advogados: [],
    conteudoCompleto: pub.texto ?? null,
    resumo: null,
    prazo: null,
    acaoNecessaria: null,
  };
}

function normalizarV1(pub: PublicacaoTramitaV1): PubNormalizada | null {
  const processo = pub.data?.numeroprocessocommascara ?? "";
  const disponibilizacao =
    pub.data_disponibilizacao ?? pub.publication_date ?? "";
  if (!processo || !disponibilizacao) return null;
  return {
    processo,
    tipo: pub.data?.tipoDocumento ?? "Publicação",
    tribunal: pub.data?.siglaTribunal ?? "",
    orgao: pub.data?.nomeOrgao ?? "—",
    link: pub.data?.link ?? null,
    disponibilizacao: disponibilizacao.slice(0, 10),
    destinatario: pub.data?.destinatarios?.[0]?.nome ?? "—",
    advogados: (pub.data?.destinatarioadvogados ?? [])
      .map((d) => d.advogado?.nome)
      .filter((n): n is string => !!n),
    conteudoCompleto: pub.sanitized_text ?? null,
    resumo: pub.summary?.resumo ?? null,
    prazo: pub.summary?.prazo ?? null,
    acaoNecessaria: pub.summary?.necessidade_acao ?? null,
  };
}

function verificarAssinatura(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const actual = signature.replace(/^sha256=/, "");
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.TRAMITASIGN_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook não configurado no servidor." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-webhook-signature") ?? "";
  if (!verificarAssinatura(rawBody, sig, secret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let parsedBody: {
    event_type: string;
    // Formato v2 (atual): { payload: { publications: [...] } }
    payload?: { publications?: PublicacaoTramitaV2[] };
    // Formato v1 (legado): { data: { publications: [...] } }
    data?: {
      publications?: PublicacaoTramitaV1[];
      publication?: PublicacaoTramitaV1;
    };
  };

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (parsedBody.event_type !== "publications.created") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Detecta o formato e normaliza para PubNormalizada
  const pubsNormalizadas: PubNormalizada[] = [];

  if (parsedBody.payload?.publications?.length) {
    // Formato v2 (atual)
    for (const pub of parsedBody.payload.publications) {
      const norm = normalizarV2(pub);
      if (norm) pubsNormalizadas.push(norm);
    }
  } else {
    // Formato v1 (legado)
    const v1list: PublicacaoTramitaV1[] =
      parsedBody.data?.publications ??
      (parsedBody.data?.publication ? [parsedBody.data.publication] : []);
    for (const pub of v1list) {
      const norm = normalizarV1(pub);
      if (norm) pubsNormalizadas.push(norm);
    }
  }

  let inseridos = 0;
  const novas: {
    tipo: string;
    processo: string;
    tribunal: string;
    orgao: string;
    disponibilizacao: string;
    resumo: string | null;
    prazo_dias: number | null;
    acao_necessaria: string | null;
  }[] = [];

  for (const pub of pubsNormalizadas) {
    const {
      processo,
      tipo,
      tribunal,
      orgao,
      link,
      disponibilizacao,
      destinatario,
      advogados,
      conteudoCompleto,
      resumo,
      prazo,
      acaoNecessaria,
    } = pub;

    // Uma publicação com erro (ex: violação de constraint) não pode
    // derrubar o lote inteiro — webhooks costumam vir em batch, e antes
    // uma exceção aqui subia crua e abortava as publicações restantes do
    // mesmo request sem inserir nenhuma delas.
    let newId: number | undefined;
    try {
      // INSERT ... SELECT ... WHERE NOT EXISTS: fecha a corrida entre
      // reentregas do mesmo webhook (o provedor reenvia em timeout/não-2xx)
      // como um único statement atômico, sem precisar de UNIQUE constraint.
      const rows = await sql`
        INSERT INTO publicacoes
          (processo, tipo, destinatario, advogados, orgao, tribunal,
           disponibilizacao, status, origem, conteudo, conteudo_completo)
        SELECT
          ${processo},
          ${tipo},
          ${destinatario},
          ${advogados},
          ${orgao},
          ${tribunal},
          ${disponibilizacao}::date,
          'nao_lida',
          'tramitasign',
          ${link},
          ${conteudoCompleto}
        WHERE NOT EXISTS (
          SELECT 1 FROM publicacoes
          WHERE processo = ${processo}
            AND tipo = ${tipo}
            AND disponibilizacao = ${disponibilizacao}::date
        )
        RETURNING id
      `;
      newId = rows[0]?.id as number | undefined;
    } catch (err) {
      console.error("[webhook/tramitasign] erro ao inserir publicação:", err);
      continue;
    }

    if (!newId) continue; // já existia (WHERE NOT EXISTS não inseriu)

    if (resumo) {
      const resumoIa = JSON.stringify({
        texto: resumo,
        prazo_dias: prazo,
        acao_necessaria: acaoNecessaria,
        audiencia: null,
      });
      await sql`
        UPDATE publicacoes SET resumo_ia = ${resumoIa}::jsonb WHERE id = ${newId}
      `;
    }

    inseridos++;
    novas.push({
      tipo,
      processo,
      tribunal,
      orgao,
      disponibilizacao: new Date(
        disponibilizacao + "T12:00:00Z"
      ).toLocaleDateString("pt-BR"),
      resumo,
      prazo_dias: prazo,
      acao_necessaria: acaoNecessaria,
    });
  }

  // Envia email de notificação se houver publicações novas
  if (novas.length > 0) {
    try {
      const configRows = await sql`SELECT email FROM escritorio_config LIMIT 1`;
      const emailDestino = (
        (configRows[0] as { email?: string } | undefined)?.email ?? ""
      ).trim();
      if (emailDestino) {
        await enviarEmailNovaPublicacao({
          para: emailDestino,
          publicacoes: novas,
        });
      }
    } catch (err) {
      console.error("[webhook/tramitasign] erro ao enviar email:", err);
    }
  }

  return NextResponse.json({ ok: true, inseridos });
}
