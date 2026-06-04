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

  const events: Record<string, unknown>[] = [];

  // ── Controles (prazos, audiências, perícias…) ─────────────────────────────
  if (hasPermission(session, "controles", "ver")) {
    const rows = await sql`
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
    `;

    for (const c of rows) {
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
  }

  // ── Lançamentos financeiros vencimentos pendentes ─────────────────────────
  if (hasPermission(session, "financeiro", "ver")) {
    const rows = await sql`
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
    `;

    for (const l of rows) {
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
  }

  // ── Aniversários de clientes PF ───────────────────────────────────────────
  if (hasPermission(session, "clientes", "ver")) {
    const rows = await sql`
      SELECT
        id::text,
        name,
        TO_CHAR(birth_date, 'MM-DD') AS birth_mmdd
      FROM clients
      WHERE type = 'PF'
        AND birth_date IS NOT NULL
    `;

    const sYear = new Date(startDate).getFullYear();
    const eYear = new Date(endDate).getFullYear();

    for (const b of rows) {
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
  }

  // ── Google Calendar events ────────────────────────────────────────────────
  const googleToken = await getStoredToken(session.id);
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
