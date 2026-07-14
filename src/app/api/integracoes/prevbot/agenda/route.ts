import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { criarCompromisso } from "@/lib/compromissos-db";
import { agendarNotificacoesCompromisso } from "@/lib/lembretes";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

const TIPOS_VALIDOS = new Set([
  "videochamada",
  "reuniao",
  "fechamento",
  "consulta",
  "outro",
]);

// ── Resolução do responsável a partir do CPF do cliente ──────────────────────
//
// Estratégia em cascata:
//  1. Busca processo mais recente do cliente com responsavel_id preenchido
//     → retorna colaborador + usuário vinculado
//  2. Sem processo com responsável → usa primeiro admin ativo do sistema

interface ResponsavelResolucao {
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  usuarioId: string;
  usuarioLogin: string;
  responsavelNome: string;
  responsavelTelefone: string | null;
}

async function resolverResponsavel(
  cpfNorm: string,
  clienteNomeFallback: string
): Promise<ResponsavelResolucao> {
  // Tenta localizar cliente + processo com responsável
  const rows = await sql`
    SELECT
      cl.id::text            AS cliente_id,
      cl.name                AS cliente_nome,
      cl.phone               AS cliente_telefone,
      col.nome               AS responsavel_nome,
      col.telefone           AS responsavel_telefone,
      u.id::text             AS usuario_id,
      u.login                AS usuario_login
    FROM clients cl
    LEFT JOIN processos p
           ON p.client_id = cl.id
          AND p.deleted_at IS NULL
          AND p.responsavel_id IS NOT NULL
    LEFT JOIN colaboradores col
           ON col.id = p.responsavel_id
          AND col.status = 'ativo'
    LEFT JOIN usuarios u
           ON u.colaborador_id = col.id
          AND u.ativo = true
    WHERE regexp_replace(cl.cpf, '[^0-9]', '', 'g') = ${cpfNorm}
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1
  `.catch(() => [] as Record<string, unknown>[]);

  if (rows.length > 0) {
    const r = rows[0];
    // Cliente encontrado — responsável pode ou não ter sido resolvido
    if (r.usuario_id && r.usuario_login) {
      return {
        clienteId: String(r.cliente_id),
        clienteNome: String(r.cliente_nome),
        clienteTelefone: r.cliente_telefone ? String(r.cliente_telefone) : null,
        usuarioId: String(r.usuario_id),
        usuarioLogin: String(r.usuario_login),
        responsavelNome: String(r.responsavel_nome),
        responsavelTelefone: r.responsavel_telefone
          ? String(r.responsavel_telefone)
          : null,
      };
    }

    // Cliente existe mas sem processo / responsável → cai no admin abaixo
    // mas mantemos os dados do cliente
    const admin = await resolverAdmin();
    return {
      clienteId: String(r.cliente_id),
      clienteNome: String(r.cliente_nome),
      clienteTelefone: r.cliente_telefone ? String(r.cliente_telefone) : null,
      ...admin,
    };
  }

  // Cliente não cadastrado pelo CPF → usa nome enviado + admin
  const admin = await resolverAdmin();
  return {
    clienteId: null,
    clienteNome: clienteNomeFallback || "Cliente",
    clienteTelefone: null,
    ...admin,
  };
}

async function resolverAdmin(): Promise<
  Pick<
    ResponsavelResolucao,
    "usuarioId" | "usuarioLogin" | "responsavelNome" | "responsavelTelefone"
  >
> {
  const rows = await sql`
    SELECT
      u.id::text   AS usuario_id,
      u.login      AS usuario_login,
      COALESCE(col.nome, u.login) AS responsavel_nome,
      col.telefone AS responsavel_telefone
    FROM usuarios u
    LEFT JOIN colaboradores col ON col.id = u.colaborador_id
    WHERE u.categoria = 'admin' AND u.ativo = true
    ORDER BY u.id
    LIMIT 1
  `;

  if (!rows.length) throw new Error("Nenhum usuário admin encontrado.");

  const r = rows[0];
  return {
    usuarioId: String(r.usuario_id),
    usuarioLogin: String(r.usuario_login),
    responsavelNome: String(r.responsavel_nome),
    responsavelTelefone: r.responsavel_telefone
      ? String(r.responsavel_telefone)
      : null,
  };
}

// ── POST /api/integracoes/prevbot/agenda ──────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // ── Campos obrigatórios ──
  const titulo = String(body.titulo ?? "").trim();
  const data = String(body.data ?? "").trim(); // YYYY-MM-DD
  if (!titulo || !data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { error: "Campos obrigatórios: titulo (string) e data (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  // ── Campos opcionais ──
  const horaInicio = String(body.hora_inicio ?? "").trim() || null;
  const horaFim = String(body.hora_fim ?? "").trim() || null;
  const tipoRaw = String(body.tipo ?? "outro")
    .trim()
    .toLowerCase();
  const tipo = TIPOS_VALIDOS.has(tipoRaw) ? tipoRaw : "outro";
  const clienteNomeRaw = String(body.cliente_nome ?? "").trim();
  const clienteCpfRaw = String(body.cliente_cpf ?? "").trim();
  const descricao = String(body.descricao ?? "").trim() || null;
  // localLink: link de videochamada ou endereço físico
  const localLink = String(body.local_link ?? body.link ?? "").trim() || null;

  const cpfNorm = normalizarCpf(clienteCpfRaw);

  try {
    // ── Resolve responsável e dados do cliente ──
    const resolvido = cpfNorm
      ? await resolverResponsavel(cpfNorm, clienteNomeRaw)
      : await resolverAdmin().then((admin) => ({
          clienteId: null,
          clienteNome: clienteNomeRaw || "Cliente",
          clienteTelefone: null,
          ...admin,
        }));

    const {
      clienteId,
      clienteNome,
      clienteTelefone,
      usuarioId,
      usuarioLogin,
      responsavelNome,
      responsavelTelefone,
    } = resolvido;

    // ── Cria compromisso ──
    const compromissoId = await criarCompromisso({
      titulo,
      tipo,
      dataInicio: data,
      horaInicio,
      horaFim,
      localLink,
      descricao,
      criadoPor: usuarioLogin,
      clienteId,
    });

    // ── Notificações e controle (apenas para eventos futuros) ──
    const dataEvento = new Date(data + "T12:00:00");
    if (dataEvento > new Date()) {
      const link = localLink?.startsWith("http") ? localLink : null;

      await agendarNotificacoesCompromisso({
        compromissoId,
        titulo,
        tipo,
        dataEvento,
        hora: horaInicio,
        local: link ? null : localLink,
        link,
        colaborador: responsavelTelefone
          ? { nome: responsavelNome, telefone: responsavelTelefone }
          : null,
        cliente:
          clienteId && clienteTelefone
            ? { id: clienteId, nome: clienteNome, telefone: clienteTelefone }
            : null,
      }).catch(() => null);

      // Cria controle em Minhas Tarefas para o responsável
      const tipoLabel: Record<string, string> = {
        videochamada: "Videochamada",
        reuniao: "Reunião",
        fechamento: "Fechamento",
        consulta: "Consulta",
        outro: "Compromisso",
      };
      const descricaoControle = `${tipoLabel[tipo] ?? tipo}: ${titulo}${
        clienteNome ? ` — ${clienteNome}` : ""
      }`;

      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, responsavel_id, cliente_id,
           tipo_demanda, prioridade)
        VALUES
          ('agenda',
           ${data}::date,
           ${descricaoControle},
           ${usuarioId}::uuid,
           ${clienteId ? sql`${clienteId}::uuid` : sql`NULL`},
           ${titulo},
           'normal')
      `.catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      compromisso_id: compromissoId,
      responsavel: {
        login: usuarioLogin,
        nome: responsavelNome,
      },
      cliente: {
        id: clienteId,
        nome: clienteNome,
        cpf_buscado: cpfNorm || null,
      },
      notificacoes_agendadas: dataEvento > new Date(),
    });
  } catch (err) {
    console.error(
      "[prevbot/agenda]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro interno ao criar compromisso." },
      { status: 500 }
    );
  }
}
