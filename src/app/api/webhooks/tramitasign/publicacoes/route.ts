import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { enviarEmailNovaPublicacao } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AdvogadoTramita {
  advogado: { nome: string; uf_oab: string; numero_oab: string };
}

interface PublicacaoTramita {
  iid: number;
  data_disponibilizacao: string;
  publication_date: string;
  data: {
    siglaTribunal: string;
    tipoDocumento: string;
    link?: string;
    nomeOrgao: string;
    numeroprocessocommascara: string;
    destinatarios: { nome: string }[];
    destinatarioadvogados: AdvogadoTramita[];
  };
  sanitized_text?: string | null;
  summary?: {
    resumo?: string | null;
    prazo?: number | null;
    necessidade_acao?: string | null;
    data_audiencia?: string | null;
  } | null;
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

  let payload: {
    event_type: string;
    data?: {
      publications?: PublicacaoTramita[];
      publication?: PublicacaoTramita;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (payload.event_type !== "publications.created") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const pubs: PublicacaoTramita[] =
    payload.data?.publications ??
    (payload.data?.publication ? [payload.data.publication] : []);

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

  for (const pub of pubs) {
    const processo = pub.data?.numeroprocessocommascara ?? "";
    const tipo = pub.data?.tipoDocumento ?? "Publicação";
    const disponibilizacao = pub.data_disponibilizacao ?? pub.publication_date;

    if (!processo || !disponibilizacao) continue;

    const tribunal = pub.data?.siglaTribunal ?? "";
    const orgao = pub.data?.nomeOrgao ?? "—";
    const link = pub.data?.link ?? null;
    const conteudoCompleto = pub.sanitized_text ?? null;
    const destinatario = pub.data?.destinatarios?.[0]?.nome ?? null;
    const advogados = (pub.data?.destinatarioadvogados ?? [])
      .map((a) => a.advogado?.nome)
      .filter(Boolean) as string[];

    const existe = await sql`
      SELECT 1 FROM publicacoes
      WHERE processo = ${processo}
        AND tipo = ${tipo}
        AND disponibilizacao = ${disponibilizacao}::date
      LIMIT 1
    `;
    if (existe.length > 0) continue;

    const rows = await sql`
      INSERT INTO publicacoes
        (processo, tipo, destinatario, advogados, orgao, tribunal,
         disponibilizacao, status, origem, conteudo, conteudo_completo)
      VALUES (
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
      )
      RETURNING id
    `;
    const newId = rows[0]?.id;

    if (newId && pub.summary?.resumo) {
      const resumoIa = JSON.stringify({
        texto: pub.summary.resumo ?? null,
        prazo_dias: pub.summary.prazo ?? null,
        acao_necessaria: pub.summary.necessidade_acao ?? null,
        audiencia: pub.summary.data_audiencia ?? null,
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
      disponibilizacao: new Date(disponibilizacao).toLocaleDateString("pt-BR"),
      resumo: pub.summary?.resumo ?? null,
      prazo_dias: pub.summary?.prazo ?? null,
      acao_necessaria: pub.summary?.necessidade_acao ?? null,
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
