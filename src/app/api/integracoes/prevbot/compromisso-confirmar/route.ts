import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = process.env.PREVBOT_API_KEY;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function formatarData(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── POST /api/integracoes/prevbot/compromisso-confirmar ─────────────────────
//
// O convite de compromisso ("videochamada_convite", "wpp_call_convite" e o
// convite padrão de agenda) pede pro cliente "confirmar respondendo SIM" —
// mas nada processava essa resposta: o escritório nunca sabia quem realmente
// confirmou. O PrevBot chama esta rota quando detecta uma resposta afirmativa
// logo após um desses convites; aqui localizamos o compromisso pendente mais
// próximo desse cliente, marcamos como confirmado e avisamos o responsável.
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { telefone?: string };
  try {
    body = (await req.json()) as { telefone?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const telefone = (body.telefone ?? "").replace(/\D/g, "");
  if (!telefone) {
    return NextResponse.json(
      { error: "Campo obrigatório: telefone." },
      { status: 400 }
    );
  }

  try {
    const [comp] = await sql`
      SELECT
        comp.id::text, comp.titulo, comp.data_inicio::text AS data_inicio,
        comp.hora_inicio, comp.criado_por,
        cl.name AS cliente_nome
      FROM compromissos comp
      INNER JOIN clients cl ON cl.id = comp.cliente_id
      WHERE regexp_replace(cl.phone, '\D', '', 'g') LIKE ${"%" + telefone.slice(-9)}
        AND comp.status = 'pendente'
        AND comp.confirmado_em IS NULL
        AND comp.data_inicio >= CURRENT_DATE
      ORDER BY comp.data_inicio ASC, comp.hora_inicio ASC NULLS LAST
      LIMIT 1
    `;

    if (!comp) {
      return NextResponse.json({ ok: true, confirmado: false });
    }

    await sql`
      UPDATE compromissos SET confirmado_em = NOW() WHERE id = ${comp.id}::uuid
    `;

    // Avisa o responsável pelo compromisso — sem isso, o escritório só saberia
    // olhando o WhatsApp do cliente manualmente.
    const [resp] = await sql`
      SELECT col.telefone
      FROM usuarios u
      LEFT JOIN colaboradores col ON col.id = u.colaborador_id
      WHERE u.login = ${String(comp.criado_por)}
      LIMIT 1
    `;
    if (resp?.telefone) {
      const dataFmt = formatarData(String(comp.data_inicio));
      const horaStr = comp.hora_inicio
        ? ` às ${String(comp.hora_inicio).slice(0, 5)}`
        : "";
      await enviarMensagemDireta({
        telefone: String(resp.telefone),
        mensagem:
          `✅ *${comp.cliente_nome}* confirmou presença!\n\n` +
          `📌 ${comp.titulo}\n` +
          `🗓️ ${dataFmt}${horaStr}`,
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      confirmado: true,
      titulo: String(comp.titulo),
      data: formatarData(String(comp.data_inicio)),
    });
  } catch (err) {
    console.error(
      "[prevbot/compromisso-confirmar]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
