import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";
import { agendarLembretesInss } from "@/lib/lembretes";
import { getEscritorioConfig } from "@/lib/escritorio-db";

export const dynamic = "force-dynamic";

const TIPOS_AGENDAMENTO = new Set([
  "agendamento_avaliacao_social",
  "agendamento_pericia_medica",
  "agendamento_generico",
]);

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
    tipoDocumento?: string | null;
    tipoServico: string;
    dataAgendamento?: string | null;
    dataEvento?: string | null;
    horaAgendamento?: string | null;
    localNome?: string | null;
    localEndereco?: string | null;
    protocolo?: string | null;
    processoId?: string | null;
    valor?: string | null;
    nomeRequerente?: string | null;
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
    tipoDocumento,
    tipoServico,
    dataAgendamento,
    dataEvento: dataEventoRaw,
    horaAgendamento,
    localNome,
    localEndereco,
    protocolo,
    processoId,
    valor,
    nomeRequerente,
  } = body;

  if (!clienteId || !tipoServico) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes." },
      { status: 400 }
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(clienteId)) {
    return NextResponse.json({ error: "clienteId inválido." }, { status: 400 });
  }
  if (processoId && !UUID_RE.test(processoId)) {
    return NextResponse.json(
      { error: "processoId inválido." },
      { status: 400 }
    );
  }

  const ehAgendamento = TIPOS_AGENDAMENTO.has(tipoDocumento ?? "");
  const dataRef =
    dataAgendamento ?? dataEventoRaw ?? new Date().toISOString().split("T")[0];
  const hora = horaAgendamento ?? "09:00";
  const localCompleto = [localNome ?? "INSS", localEndereco]
    .filter(Boolean)
    .join(" — ");

  try {
    const escritorio = await getEscritorioConfig().catch(() => null);
    const nomeEscritorio = escritorio?.nome ?? "nosso escritório";

    // Se o PrevBot não enviou o telefone do cliente, busca do banco de dados
    let telefoneClienteEfetivo = telefoneCliente ?? null;
    let telefoneResponsavelEfetivo = telefoneResponsavel ?? null;
    let nomeResponsavelEfetivo = nomeResponsavel ?? null;
    // Responsável legal do cliente (menor/incapaz) — substitui contato do cliente
    let guardianTelefone: string | null = null;
    let guardianNome: string | null = null;

    {
      const dbRows = await sql`
        SELECT
          cl.phone                AS cliente_telefone,
          cl.responsavel_telefone AS guardian_telefone,
          cl.responsavel_nome     AS guardian_nome,
          col.telefone            AS resp_telefone,
          col.nome                AS resp_nome
        FROM clients cl
        LEFT JOIN LATERAL (
          SELECT p.responsavel_id
          FROM processos p
          WHERE p.client_id = cl.id
            AND p.deleted_at IS NULL
            AND p.responsavel_id IS NOT NULL
          ORDER BY p.created_at DESC
          LIMIT 1
        ) lp ON true
        LEFT JOIN colaboradores col ON col.id = lp.responsavel_id AND col.status = 'ativo'
        WHERE cl.id = ${clienteId}::uuid
        LIMIT 1
      `.catch(() => [] as Record<string, unknown>[]);

      const row = dbRows[0];
      if (row) {
        if (!telefoneClienteEfetivo && row.cliente_telefone)
          telefoneClienteEfetivo = String(row.cliente_telefone);
        if (!telefoneResponsavelEfetivo && row.resp_telefone)
          telefoneResponsavelEfetivo = String(row.resp_telefone);
        if (!nomeResponsavelEfetivo && row.resp_nome)
          nomeResponsavelEfetivo = String(row.resp_nome);
        // Guardião legal: substitui o telefone do cliente nos lembretes
        if (row.guardian_telefone) {
          guardianTelefone = String(row.guardian_telefone);
          guardianNome = row.guardian_nome ? String(row.guardian_nome) : null;
          // Não enviar para o menor — usar o guardião como destinatário do cliente
          telefoneClienteEfetivo = null;
        }
      }
    }

    let compromissoId: string | null = null;

    // Agendamentos: cria compromisso na agenda
    if (ehAgendamento) {
      const [compromisso] = await sql`
        INSERT INTO compromissos
          (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, criado_por, cliente_id)
        VALUES
          (${tipoServico},
           'consulta',
           ${dataRef}::date,
           ${hora},
           ${localCompleto},
           ${protocolo ? `Protocolo: ${protocolo}` : null},
           ${session.login},
           ${clienteId}::uuid)
        RETURNING id::text
      `;
      compromissoId = String(compromisso.id);
    }

    // Agendamentos: cria registro em pericias + controles
    if (ehAgendamento) {
      const tipoPericia =
        tipoDocumento === "agendamento_avaliacao_social"
          ? "avaliacao_social_administrativa"
          : "pericia_administrativa";

      await sql`
        INSERT INTO pericias
          (tipo, client_id, processo_id, data_pericia, hora_pericia, local_pericia, status, observacoes)
        VALUES
          (${tipoPericia},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${dataRef}::date,
           ${hora}::time,
           ${localCompleto},
           'agendado',
           ${protocolo ? `Protocolo INSS: ${protocolo}` : null})
      `.catch(() => null);

      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda, prioridade)
        VALUES
          ('pericias',
           ${dataRef}::date,
           ${tipoServico},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${tipoServico},
           'alta')
      `.catch(() => null);
    }

    // RPV → controles como alvará
    if (tipoDocumento === "rpv") {
      const descricao = [
        "RPV",
        nomeRequerente ? `— ${nomeRequerente}` : null,
        valor ? `— R$ ${valor}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda, prioridade, dados)
        VALUES
          ('alvaras',
           ${dataRef}::date,
           ${descricao},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${tipoServico},
           'alta',
           ${valor ? JSON.stringify({ valor }) : null}::jsonb)
      `.catch(() => null);
    }

    // Comprovante de pagamento → implantados
    if (tipoDocumento === "comprovante_pagamento") {
      const descricao = [
        "Benefício implantado",
        nomeRequerente ? `— ${nomeRequerente}` : null,
        valor ? `— R$ ${valor}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda, prioridade, dados)
        VALUES
          ('implantados',
           ${dataRef}::date,
           ${descricao},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${tipoServico},
           'alta',
           ${valor ? JSON.stringify({ valor }) : null}::jsonb)
      `.catch(() => null);
    }

    // Resultado de perícia → controles pericias
    if (tipoDocumento === "resultado_pericia") {
      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda, prioridade)
        VALUES
          ('pericias',
           ${dataRef}::date,
           ${tipoServico},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${tipoServico},
           'alta')
      `.catch(() => null);
    }

    // Salva protocolo no processo se informado
    if (processoId && protocolo) {
      await sql`
        UPDATE processos
        SET protocolo_inss = ${protocolo}, updated_at = NOW()
        WHERE id = ${processoId}::uuid AND deleted_at IS NULL
      `.catch(() => null);
    }

    // Agenda lembretes (apenas para agendamentos)
    if (ehAgendamento && compromissoId) {
      const dataEventoDate = new Date(dataRef + "T12:00:00");
      await agendarLembretesInss({
        compromissoId,
        clienteId,
        clienteNome,
        telefoneCliente: telefoneClienteEfetivo,
        telefoneResponsavel: telefoneResponsavelEfetivo,
        nomeResponsavel: nomeResponsavelEfetivo,
        // Guardião legal substitui o contato do cliente (menor/incapaz)
        guardian:
          guardianTelefone && guardianNome
            ? { nome: guardianNome, telefone: guardianTelefone }
            : null,
        dataEvento: dataEventoDate,
        horaEvento: hora,
        tipoServico,
        local: localCompleto,
        protocolo: protocolo ?? undefined,
        escritorio: nomeEscritorio,
      });
    }

    return NextResponse.json({
      ok: true,
      compromissoId,
      mensagem: ehAgendamento
        ? "Agendamento criado e lembretes programados com sucesso."
        : "Documento registrado nos controles com sucesso.",
    });
  } catch (err) {
    console.error(
      "[inss/confirmar]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "Erro ao confirmar agendamento." },
      { status: 500 }
    );
  }
}
