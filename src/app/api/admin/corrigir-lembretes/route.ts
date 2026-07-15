import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import { agendarNotificacoesCompromisso } from "@/lib/lembretes";
import { agendarLembretesInss } from "@/lib/lembretes";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/corrigir-lembretes
 * 1. Corrige textos antigos ("Seu/seu {{servico}}") nos lembretes pendentes não enviados.
 * 2. Lista compromissos futuros sem nenhum lembrete e re-agenda.
 * Requer sessão ativa.
 */
export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  // ── 1. Corrige textos antigos nos lembretes INSS ainda não enviados ──────────
  // Remove "Seu " e "seu " dos textos armazenados (problema de gênero: avaliação é feminino).
  // O nome do serviço em maiúsculas já se destaca; em futuros lembretes vem com *bold*.
  const fixResult = await sql`
    UPDATE lembretes_agendados
    SET mensagem = regexp_replace(
          regexp_replace(mensagem, '\\bSeu\\s+', '', 'g'),
          '\\bseu\\s+', '', 'g'
        )
    WHERE enviado = false
      AND tipo LIKE 'inss_%'
      AND (mensagem LIKE '%Seu %' OR mensagem LIKE '%seu %')
    RETURNING id::text
  `.catch(() => [] as Record<string, unknown>[]);

  const textosCorridos = Array.isArray(fixResult) ? fixResult.length : 0;

  // ── 2. Compromissos futuros sem nenhum lembrete ──────────────────────────────
  const semLembrete = await sql`
    SELECT
      c.id::text,
      c.titulo,
      c.tipo,
      c.data_inicio,
      c.hora_inicio,
      c.local_link,
      c.cliente_id::text,
      cl.name                   AS cliente_nome,
      cl.phone                  AS cliente_telefone,
      cl.responsavel_nome       AS guardian_nome,
      cl.responsavel_telefone   AS guardian_telefone,
      col.nome                  AS responsavel_nome,
      col.telefone              AS responsavel_telefone
    FROM compromissos c
    LEFT JOIN clients cl ON cl.id = c.cliente_id
    LEFT JOIN LATERAL (
      SELECT p.responsavel_id
      FROM processos p
      WHERE p.client_id = c.cliente_id
        AND p.deleted_at IS NULL
        AND p.responsavel_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    ) lp ON true
    LEFT JOIN colaboradores col ON col.id = lp.responsavel_id AND col.status = 'ativo'
    WHERE c.data_inicio >= CURRENT_DATE
      AND c.data_inicio <= CURRENT_DATE + 14
      AND c.status != 'concluido'
      AND NOT EXISTS (
        SELECT 1 FROM lembretes_agendados la
        WHERE la.referencia_id = c.id
          AND la.enviado = false
      )
    ORDER BY c.data_inicio ASC
  `.catch(() => [] as Record<string, unknown>[]);

  const reagendados: string[] = [];

  // ── 3. Re-agenda lembretes para cada compromisso sem cobertura ───────────────
  for (const r of semLembrete) {
    const dataEvento = new Date(String(r.data_inicio) + "T12:00:00");
    if (dataEvento <= new Date()) continue;

    const localLink = r.local_link ? String(r.local_link) : null;
    const link = localLink?.startsWith("http") ? localLink : null;
    const local = !link ? localLink : null;

    try {
      await agendarNotificacoesCompromisso({
        compromissoId: String(r.id),
        titulo: String(r.titulo),
        tipo: String(r.tipo),
        dataEvento,
        hora: r.hora_inicio ? String(r.hora_inicio) : null,
        local,
        link,
        colaborador: r.responsavel_telefone
          ? {
              nome: String(r.responsavel_nome),
              telefone: String(r.responsavel_telefone),
            }
          : null,
        cliente:
          r.cliente_id && r.cliente_telefone
            ? {
                id: String(r.cliente_id),
                nome: String(r.cliente_nome),
                telefone: String(r.cliente_telefone),
              }
            : null,
        clienteResponsavel:
          r.guardian_nome && r.guardian_telefone
            ? {
                nome: String(r.guardian_nome),
                telefone: String(r.guardian_telefone),
              }
            : null,
      });
      reagendados.push(
        `${r.titulo} (${r.data_inicio}) — ${r.cliente_nome ?? "sem cliente"}`
      );
    } catch {
      // continua para o próximo
    }
  }

  return NextResponse.json({
    ok: true,
    textos_corrigidos: textosCorridos,
    compromissos_sem_lembrete_encontrados: semLembrete.length,
    reagendados,
    detalhe: semLembrete.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      tipo: r.tipo,
      data: r.data_inicio,
      cliente: r.cliente_nome,
      cliente_telefone: r.cliente_telefone,
      responsavel: r.responsavel_nome,
    })),
  });
}
