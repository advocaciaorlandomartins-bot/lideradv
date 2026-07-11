import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { fetchGoogleEvents, getStoredToken } from "@/lib/google-calendar";

const TIPO_COLORS: Record<string, string> = {
  audiencias: "#7c3aed",
  prazos: "#dc2626",
  pericias: "#0891b2",
  dcb: "#ea580c",
  beneficios: "#059669",
  implantados: "#2563eb",
  "implantados-data": "#2563eb",
  alvaras: "#d97706",
};

const TIPO_LABELS: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Implantado",
  "implantados-data": "Impl. Data",
  alvaras: "Alvará",
};

const EVENTO_COLORS: Record<string, string> = {
  audiencias: "#7c3aed",
  prazos: "#dc2626",
  pericias: "#0891b2",
  dcb: "#ea580c",
  beneficios: "#059669",
  implantados: "#2563eb",
  alvaras: "#d97706",
};
const EVENTO_LABELS: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Implantado",
  alvaras: "Alvará",
};

const TIPO_ICONS_COMP: Record<string, string> = {
  reuniao: "🤝",
  videochamada: "📹",
  fechamento: "✍️",
  consulta: "👥",
  outro: "📌",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const showArchived = searchParams.get("showArchived") === "1";

  if (!start || !end) return NextResponse.json([]);

  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);

  // ── Todas as queries em paralelo ─────────────────────────────────────────
  const [
    controleRows,
    eventoRows,
    lancRows,
    birthdayRows,
    compRows,
    googleToken,
  ] = await Promise.all([
    // Controles
    hasPermission(session, "controles", "ver")
      ? sql`
            SELECT
              c.id::text,
              c.tipo,
              c.data_evento::text,
              c.descricao,
              c.status::text,
              cl.id::text   AS cliente_id,
              cl.name       AS cliente_nome,
              p.id::text    AS processo_id,
              p.numero      AS processo_numero
            FROM controles c
            LEFT JOIN clients   cl ON cl.id = c.cliente_id
            LEFT JOIN processos p  ON p.id  = c.processo_id
            WHERE c.data_evento >= ${startDate}::date
              AND c.data_evento <  ${endDate}::date
              ${showArchived ? sql`` : sql`AND (c.status IS NULL OR c.status = 'pendente')`}
            ORDER BY c.data_evento
          `
      : Promise.resolve([]),

    // Eventos de processos
    hasPermission(session, "processos", "ver")
      ? sql`
            SELECT
              ec.id::text,
              ec.titulo,
              ec.tipo,
              ec.data::text       AS data_evento,
              ec.hora::text       AS hora,
              p.id::text          AS processo_id,
              p.numero            AS processo_numero,
              cl.id::text         AS cliente_id,
              cl.name             AS cliente_nome
            FROM eventos_controles ec
            JOIN processos p   ON p.id  = ec.processo_id
            LEFT JOIN clients cl ON cl.id = p.client_id
            WHERE ec.data >= ${startDate}::date
              AND ec.data <  ${endDate}::date
            ORDER BY ec.data
          `
      : Promise.resolve([]),

    // Lançamentos financeiros
    hasPermission(session, "financeiro", "ver")
      ? sql`
            SELECT
              l.id::text,
              l.tipo,
              l.descricao,
              l.valor,
              l.status,
              TO_CHAR(l.data_vencimento, 'YYYY-MM-DD') AS data_vencimento,
              c.name       AS client_name,
              c.id::text   AS client_id
            FROM lancamentos l
            LEFT JOIN clients c ON c.id = l.client_id
            WHERE l.data_vencimento >= ${startDate}::date
              AND l.data_vencimento <  ${endDate}::date
              AND l.status = 'pendente'
            ORDER BY l.data_vencimento
          `
      : Promise.resolve([]),

    // Aniversários
    hasPermission(session, "clientes", "ver")
      ? sql`
            SELECT
              id::text,
              name,
              TO_CHAR(birth_date, 'MM-DD') AS birth_mmdd
            FROM clients
            WHERE type = 'PF'
              AND birth_date IS NOT NULL
          `
      : Promise.resolve([]),

    // Compromissos pessoais
    sql`
        SELECT
          comp.*,
          cl.name  AS cliente_nome_join,
          cl.id::text AS cliente_id_join
        FROM compromissos comp
        LEFT JOIN clients cl ON cl.id = comp.cliente_id
        WHERE comp.criado_por  = ${session.login}
          AND comp.data_inicio >= ${startDate}::date
          AND comp.data_inicio <  ${endDate}::date
          ${showArchived ? sql`` : sql`AND comp.status = 'pendente'`}
        ORDER BY comp.data_inicio, comp.hora_inicio NULLS LAST
      `,

    // Token Google Calendar
    getStoredToken(session.id),
  ]);

  const events: Record<string, unknown>[] = [];

  // ── Controles ──────────────────────────────────────────────────────────────
  for (const c of controleRows) {
    const tipo = String(c.tipo);
    const color = TIPO_COLORS[tipo] ?? "#6b7280";
    const tipoLabel = TIPO_LABELS[tipo] ?? tipo;
    const isConcluido = c.status === "concluido";

    let title = String(c.descricao);
    if (c.cliente_nome) title += ` · ${String(c.cliente_nome).split(" ")[0]}`;

    events.push({
      id: `ctrl-${c.id}`,
      title,
      start: String(c.data_evento).slice(0, 10),
      allDay: true,
      backgroundColor: isConcluido ? "#94a3b8" : color,
      borderColor: "transparent",
      textColor: "#ffffff",
      extendedProps: {
        source: "controle",
        tipo,
        tipoLabel,
        clienteNome: c.cliente_nome ?? null,
        clienteId: c.cliente_id ?? null,
        processoId: c.processo_id ?? null,
        processoNumero: c.processo_numero ?? null,
        status: c.status ?? null,
        href: `/dashboard/controles/${c.id}`,
      },
    });
  }

  // ── Eventos de processos ────────────────────────────────────────────────────
  for (const ev of eventoRows) {
    const tipo = ev.tipo ? String(ev.tipo) : "outro";
    const color = EVENTO_COLORS[tipo] ?? "#6b7280";
    const tipoLabel = EVENTO_LABELS[tipo] ?? "Evento";

    let title = String(ev.titulo);
    if (ev.cliente_nome) title += ` · ${String(ev.cliente_nome).split(" ")[0]}`;

    events.push({
      id: `ev-${ev.id}`,
      title,
      start: String(ev.data_evento).slice(0, 10),
      allDay: true,
      backgroundColor: color,
      borderColor: "transparent",
      textColor: "#ffffff",
      extendedProps: {
        source: "evento_processo",
        tipo,
        tipoLabel,
        clienteNome: ev.cliente_nome ?? null,
        clienteId: ev.cliente_id ?? null,
        processoId: ev.processo_id ?? null,
        processoNumero: ev.processo_numero ?? null,
        href: `/dashboard/processos/${ev.processo_id}`,
      },
    });
  }

  // ── Lançamentos financeiros ─────────────────────────────────────────────────
  for (const l of lancRows) {
    const isEntrada = l.tipo === "entrada";
    const dvStr = String(l.data_vencimento);
    const isVencido = dvStr < new Date().toISOString().slice(0, 10);
    const color = isVencido ? "#dc2626" : isEntrada ? "#059669" : "#ea580c";
    const valor = Number(l.valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const seta = isEntrada ? "↑" : "↓";

    let title = `${seta} ${String(l.descricao)}`;
    if (l.client_name) title += ` · ${String(l.client_name).split(" ")[0]}`;

    events.push({
      id: `lanc-${l.id}`,
      title,
      start: dvStr,
      allDay: true,
      backgroundColor: color,
      borderColor: "transparent",
      textColor: "#ffffff",
      extendedProps: {
        source: "lancamento",
        tipo: l.tipo,
        valor: Number(l.valor),
        valorFmt: valor,
        clientNome: l.client_name ?? null,
        clientId: l.client_id ?? null,
        status: l.status,
        isVencido,
        href: `/dashboard/financeiro`,
      },
    });
  }

  // ── Aniversários ────────────────────────────────────────────────────────────
  const sYear = new Date(startDate).getFullYear();
  const eYear = new Date(endDate).getFullYear();

  for (const b of birthdayRows) {
    const [mm, dd] = String(b.birth_mmdd).split("-").map(Number);
    for (let y = sYear; y <= eYear; y++) {
      const iso = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (iso >= startDate && iso < endDate) {
        events.push({
          id: `bday-${b.id}-${y}`,
          title: `🎂 ${String(b.name).split(" ")[0]}`,
          start: iso,
          allDay: true,
          backgroundColor: "#db2777",
          borderColor: "transparent",
          textColor: "#ffffff",
          extendedProps: {
            source: "birthday",
            clienteNome: b.name,
            clienteId: b.id,
            href: `/dashboard/clientes/${b.id}`,
          },
        });
      }
    }
  }

  // ── Compromissos pessoais ────────────────────────────────────────────────────
  for (const c of compRows) {
    const tipo = String(c.tipo);
    const icon = TIPO_ICONS_COMP[tipo] ?? "📌";
    const di = c.data_inicio;
    const dateStr =
      di instanceof Date
        ? di.toISOString().slice(0, 10)
        : String(di).slice(0, 10);
    const hasTime = c.hora_inicio != null;
    const startStr = hasTime
      ? `${dateStr}T${String(c.hora_inicio).slice(0, 5)}`
      : dateStr;
    const endStr =
      hasTime && c.hora_fim
        ? `${dateStr}T${String(c.hora_fim).slice(0, 5)}`
        : undefined;

    const isConcluido = String(c.status) === "concluido";
    const clienteNomeJoin = c.cliente_nome_join
      ? String(c.cliente_nome_join)
      : null;
    const clientePrimeiro = clienteNomeJoin
      ? ` · ${clienteNomeJoin.split(" ")[0]}`
      : "";

    events.push({
      id: `comp-${String(c.id)}`,
      title: `${icon} ${String(c.titulo)}${clientePrimeiro}`,
      start: startStr,
      ...(endStr ? { end: endStr } : {}),
      allDay: !hasTime,
      backgroundColor: isConcluido ? "#94a3b8" : String(c.cor),
      borderColor: "transparent",
      textColor: "#ffffff",
      extendedProps: {
        source: "compromisso",
        compromissoStatus: isConcluido ? "concluido" : "pendente",
        compromissoId: String(c.id),
        compromissoTitulo: String(c.titulo),
        compromissoTipo: tipo,
        clienteNome: clienteNomeJoin ?? null,
        clienteId: c.cliente_id_join ?? null,
        compromissoHoraInicio: c.hora_inicio
          ? String(c.hora_inicio).slice(0, 5)
          : null,
        compromissoHoraFim: c.hora_fim ? String(c.hora_fim).slice(0, 5) : null,
        compromissoLocalLink: c.local_link ? String(c.local_link) : null,
        compromissoDescricao: c.descricao ? String(c.descricao) : null,
      },
    });
  }

  // ── Google Calendar ──────────────────────────────────────────────────────────
  if (googleToken) {
    const gcalEvents = await fetchGoogleEvents(session.id, startDate, endDate);
    for (const g of gcalEvents) {
      events.push({
        id: g.id,
        title: g.title,
        start: g.start,
        end: g.end,
        allDay: g.allDay,
        backgroundColor: "#4285F4",
        borderColor: "transparent",
        textColor: "#ffffff",
        extendedProps: {
          source: "google",
          description: g.description,
          href: g.htmlLink,
        },
      });
    }
  }

  return NextResponse.json(events);
}
