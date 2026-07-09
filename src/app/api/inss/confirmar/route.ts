import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import { agendarLembretesInss } from "@/lib/lembretes";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    clienteId: string;
    clienteNome: string;
    telefoneCliente?: string | null;
    telefoneResponsavel?: string | null;
    nomeResponsavel?: string | null;
    tipoServico: string;
    dataAgendamento: string; // YYYY-MM-DD
    horaAgendamento: string; // HH:MM
    localNome: string;
    localEndereco?: string | null;
    protocolo?: string | null;
    processoId?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const {
    clienteId,
    clienteNome,
    telefoneCliente,
    telefoneResponsavel,
    nomeResponsavel,
    tipoServico,
    dataAgendamento,
    horaAgendamento,
    localNome,
    localEndereco,
    protocolo,
    processoId,
  } = body;

  if (!clienteId || !dataAgendamento || !horaAgendamento || !tipoServico) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes." },
      { status: 400 }
    );
  }

  try {
    const escritorio = await getEscritorioConfig().catch(() => null);
    const nomeEscritorio = escritorio?.nome ?? "nosso escritório";

    const localCompleto = [localNome, localEndereco]
      .filter(Boolean)
      .join(" — ");

    // Cria compromisso na agenda
    const [compromisso] = await sql`
      INSERT INTO compromissos
        (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, criado_por, status)
      VALUES
        (${tipoServico},
         'audiencia',
         ${dataAgendamento}::date,
         ${horaAgendamento},
         ${localCompleto},
         ${protocolo ? `Protocolo: ${protocolo}` : null},
         ${session.login},
         'agendado')
      RETURNING id::text
    `;

    const compromissoId = String(compromisso.id);

    // Salva protocolo no processo se informado
    if (processoId && protocolo) {
      await sql`
        UPDATE processos
        SET protocolo_inss = ${protocolo}, updated_at = NOW()
        WHERE id = ${processoId}::uuid AND deleted_at IS NULL
      `.catch(() => null);
    }

    // Agenda lembretes
    const dataEvento = new Date(dataAgendamento + "T12:00:00");
    await agendarLembretesInss({
      compromissoId,
      clienteId,
      clienteNome,
      telefoneCliente: telefoneCliente ?? null,
      telefoneResponsavel: telefoneResponsavel ?? null,
      nomeResponsavel: nomeResponsavel ?? null,
      dataEvento,
      horaEvento: horaAgendamento,
      tipoServico,
      local: localCompleto,
      protocolo: protocolo ?? undefined,
      escritorio: nomeEscritorio,
    });

    return NextResponse.json({
      ok: true,
      compromissoId,
      mensagem: "Agendamento criado e lembretes programados com sucesso.",
    });
  } catch (err) {
    console.error("[inss/confirmar]", err);
    return NextResponse.json(
      { error: "Erro ao confirmar agendamento." },
      { status: 500 }
    );
  }
}
