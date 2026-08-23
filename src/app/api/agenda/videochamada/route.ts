import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";
import { criarCompromisso } from "@/lib/compromissos-db";
import { agendarVideochamadaWhatsApp } from "@/lib/lembretes";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// O link vira parte de uma mensagem de WhatsApp enviada ao cliente em nome
// do escritório — sem allowlist, qualquer usuário com "controles:criar"
// tinha um primitivo de phishing (link arbitrário assinado pelo escritório).
const DOMINIOS_LINK_PERMITIDOS = [
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  "zoom.us",
  "whereby.com",
  "wa.me",
];

function linkPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return DOMINIOS_LINK_PERMITIDOS.some(
      (d) => u.hostname === d || u.hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "criar"))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    clienteId?: string;
    titulo?: string;
    data?: string;
    hora?: string;
    link?: string;
    tipoReuniao?: "meet" | "whatsapp";
  };

  const clienteId = body.clienteId;
  const data = body.data;
  const hora = body.hora;
  const titulo = body.titulo ? String(body.titulo).trim().slice(0, 150) : "";
  const link = body.link ? String(body.link).trim().slice(0, 500) : "";
  const isMeet = (body.tipoReuniao ?? "meet") === "meet";

  if (
    !clienteId ||
    !UUID_RE.test(clienteId) ||
    !data ||
    !DATA_RE.test(data) ||
    !hora ||
    !HORA_RE.test(hora)
  ) {
    return NextResponse.json(
      {
        error: "clienteId, data (YYYY-MM-DD) e hora (HH:MM) são obrigatórios.",
      },
      { status: 400 }
    );
  }
  if (isMeet && !linkPermitido(link)) {
    return NextResponse.json(
      {
        error: "Link inválido. Use Google Meet, Teams, Zoom, Whereby ou wa.me.",
      },
      { status: 400 }
    );
  }

  // Read client info
  const clientRows = await sql`
    SELECT name, phone, responsavel_nome, responsavel_telefone
    FROM clients WHERE id = ${clienteId}::uuid LIMIT 1
  `;
  if (!clientRows.length) {
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );
  }
  const cr = clientRows[0] as {
    name: string;
    phone: string | null;
    responsavel_nome: string | null;
    responsavel_telefone: string | null;
  };
  const clienteNome = cr.name;
  const telefone = cr.phone ?? null;
  // Responsável legal (menor/incapaz) — mensagens vão a ele
  const clienteResponsavelLegal =
    cr.responsavel_nome && cr.responsavel_telefone
      ? { nome: cr.responsavel_nome, telefone: cr.responsavel_telefone }
      : null;

  const escritorioConfig = await getEscritorioConfig();

  // Create compromisso
  const compromissoId = await criarCompromisso({
    titulo:
      titulo ||
      (isMeet
        ? `Reunião com ${clienteNome}`
        : `Ligação WhatsApp com ${clienteNome}`),
    tipo: "videochamada",
    dataInicio: data,
    horaInicio: hora,
    horaFim: null,
    localLink: isMeet ? link || null : "WhatsApp",
    descricao: null,
    cor: isMeet ? "#7c3aed" : "#25d366",
    criadoPor: session.login,
    clienteId,
  });

  // Busca telefone do responsável (colaborador vinculado ao usuário da sessão)
  let responsavel: { telefone: string; nome: string } | undefined;
  const respRows = await sql`
    SELECT col.telefone, COALESCE(col.nome, u.login) AS nome
    FROM usuarios u
    LEFT JOIN colaboradores col ON col.id = u.colaborador_id AND col.status = 'ativo'
    WHERE u.login = ${session.login} AND u.ativo = true
    LIMIT 1
  `;
  if (respRows.length > 0 && respRows[0].telefone) {
    responsavel = {
      telefone: String(respRows[0].telefone),
      nome: String(respRows[0].nome),
    };
  }

  // Schedule WhatsApp messages (para cliente, responsável legal ou staff)
  if (telefone || clienteResponsavelLegal) {
    const [year, month, day] = data.split("-").map(Number);
    const dataEvento = new Date(year, month - 1, day);

    await agendarVideochamadaWhatsApp({
      compromissoId,
      clienteId,
      clienteNome,
      telefone,
      dataEvento,
      horaEvento: hora,
      link: link ?? "",
      tipoReuniao: isMeet ? "meet" : "whatsapp",
      escritorio: escritorioConfig.nome,
      responsavel,
      clienteResponsavel: clienteResponsavelLegal,
    });
  }

  return NextResponse.json({ ok: true, compromissoId });
}
