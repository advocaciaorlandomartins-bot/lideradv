import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import { criarCompromisso } from "@/lib/compromissos-db";
import { agendarVideochamadaWhatsApp } from "@/lib/lembretes";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { clienteId, titulo, data, hora, link, tipoReuniao } =
    (await req.json()) as {
      clienteId: string;
      titulo?: string;
      data: string;
      hora: string;
      link?: string;
      tipoReuniao?: "meet" | "whatsapp";
    };

  const isMeet = (tipoReuniao ?? "meet") === "meet";

  if (!clienteId || !data || !hora) {
    return NextResponse.json(
      { error: "clienteId, data e hora são obrigatórios." },
      { status: 400 }
    );
  }
  if (isMeet && !link) {
    return NextResponse.json(
      { error: "Informe o link do Google Meet." },
      { status: 400 }
    );
  }

  // Read client info
  const clientRows = await sql`
    SELECT name, phone FROM clients WHERE id = ${clienteId}::uuid LIMIT 1
  `;
  if (!clientRows.length) {
    return NextResponse.json(
      { error: "Cliente não encontrado." },
      { status: 404 }
    );
  }
  const { name: clienteNome, phone: telefone } = clientRows[0] as {
    name: string;
    phone: string;
  };

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
    localLink: isMeet ? (link ?? null) : "WhatsApp",
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

  // Schedule WhatsApp messages
  if (telefone) {
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
    });
  }

  return NextResponse.json({ ok: true, compromissoId });
}
