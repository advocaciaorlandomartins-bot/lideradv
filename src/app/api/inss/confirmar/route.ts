import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { podeAcessarCliente } from "@/lib/acesso";
import sql from "@/lib/db";
import { agendarLembretesInss } from "@/lib/lembretes";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";

const TIPOS_AGENDAMENTO = new Set([
  "agendamento_avaliacao_social",
  "agendamento_pericia_medica",
  "agendamento_generico",
]);

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function texto(v: unknown, max: number): string | null {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  // Esta rota EXECUTA ações reais: cria compromisso/perícia/controle e
  // dispara WhatsApp em nome do escritório — exige permissão de escrita.
  if (!session || !hasPermission(session, "controles", "criar")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: {
    clienteId: string;
    // clienteNome é usado só como fallback se o cliente não for encontrado
    // no banco (não deveria acontecer); telefone e nome de contato SEMPRE
    // vêm do banco — ver comentário mais abaixo.
    clienteNome: string;
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
  if (!(await podeAcessarCliente(session, clienteId))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (processoId) {
    const [proc] = await sql`
      SELECT 1 FROM processos
      WHERE id = ${processoId}::uuid AND client_id = ${clienteId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!proc)
      return NextResponse.json(
        { error: "processoId não pertence a este cliente." },
        { status: 400 }
      );
  }

  const ehAgendamento = TIPOS_AGENDAMENTO.has(tipoDocumento ?? "");
  const dataRefRaw =
    dataAgendamento ?? dataEventoRaw ?? new Date().toISOString().split("T")[0];
  const dataRef = DATA_RE.test(dataRefRaw)
    ? dataRefRaw
    : new Date().toISOString().split("T")[0];
  const horaRaw = horaAgendamento ?? "09:00";
  const hora = HORA_RE.test(horaRaw) ? horaRaw : "09:00";
  const tipoServicoSeguro = texto(tipoServico, 200) ?? "Serviço INSS";
  const localCompleto =
    [texto(localNome, 150) ?? "INSS", texto(localEndereco, 300)]
      .filter(Boolean)
      .join(" — ") || "INSS";
  const protocoloSeguro = texto(protocolo, 100);

  try {
    const escritorio = await getEscritorioConfig().catch(() => null);
    const nomeEscritorio = escritorio?.nome ?? "nosso escritório";

    // Telefones e nome do cliente vêm SEMPRE do banco, nunca do corpo da
    // requisição: qualquer usuário logado podia informar telefoneCliente/
    // clienteNome arbitrários e usar esta rota como primitivo de phishing/
    // spam via WhatsApp em nome do escritório.
    let telefoneClienteEfetivo: string | null = null;
    let telefoneResponsavelEfetivo: string | null = null;
    let nomeResponsavelEfetivo: string | null = null;
    let clienteNomeDb: string | null = null;
    // Responsável legal do cliente (menor/incapaz) — substitui contato do cliente
    let guardianTelefone: string | null = null;
    let guardianNome: string | null = null;

    {
      const dbRows = await sql`
        SELECT
          cl.name                 AS cliente_nome,
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
      if (!row) {
        return NextResponse.json(
          { error: "Cliente não encontrado." },
          { status: 404 }
        );
      }
      clienteNomeDb = String(row.cliente_nome ?? "Cliente");
      if (row.cliente_telefone)
        telefoneClienteEfetivo = String(row.cliente_telefone);
      if (row.resp_telefone)
        telefoneResponsavelEfetivo = String(row.resp_telefone);
      if (row.resp_nome) nomeResponsavelEfetivo = String(row.resp_nome);
      // Guardião legal: substitui o telefone do cliente nos lembretes
      if (row.guardian_telefone) {
        guardianTelefone = String(row.guardian_telefone);
        guardianNome = row.guardian_nome ? String(row.guardian_nome) : null;
        // Não enviar para o menor — usar o guardião como destinatário do cliente
        telefoneClienteEfetivo = null;
      }
    }
    const clienteNomeSeguro =
      clienteNomeDb ?? texto(clienteNome, 150) ?? "Cliente";

    let compromissoId: string | null = null;

    // Agendamentos: cria compromisso na agenda
    if (ehAgendamento) {
      const [compromisso] = await sql`
        INSERT INTO compromissos
          (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, criado_por, cliente_id)
        VALUES
          (${tipoServicoSeguro},
           'consulta',
           ${dataRef}::date,
           ${hora},
           ${localCompleto},
           ${protocoloSeguro ? `Protocolo: ${protocoloSeguro}` : null},
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
           ${protocoloSeguro ? `Protocolo INSS: ${protocoloSeguro}` : null})
      `.catch((e) => {
        console.error("[inss/confirmar] falha ao inserir pericia:", e);
        return null;
      });

      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, prioridade)
        VALUES
          ('pericias',
           ${dataRef}::date,
           ${tipoServicoSeguro},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${session.id}::uuid,
           ${tipoServicoSeguro},
           'alta')
      `.catch((e) => {
        console.error(
          "[inss/confirmar] falha ao inserir controle de pericia:",
          e
        );
        return null;
      });
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
          (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, prioridade, dados)
        VALUES
          ('alvaras',
           ${dataRef}::date,
           ${descricao},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${session.id}::uuid,
           ${tipoServicoSeguro},
           'alta',
           ${valor ? JSON.stringify({ valor }) : null}::jsonb)
      `.catch((e) => {
        console.error("[inss/confirmar] falha ao inserir controle de RPV:", e);
        return null;
      });
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
          (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, prioridade, dados)
        VALUES
          ('implantados',
           ${dataRef}::date,
           ${descricao},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${session.id}::uuid,
           ${tipoServicoSeguro},
           'alta',
           ${valor ? JSON.stringify({ valor }) : null}::jsonb)
      `.catch((e) => {
        console.error(
          "[inss/confirmar] falha ao inserir controle de implantado:",
          e
        );
        return null;
      });
    }

    // Resultado de perícia → controles pericias
    if (tipoDocumento === "resultado_pericia") {
      await sql`
        INSERT INTO controles
          (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, prioridade)
        VALUES
          ('pericias',
           ${dataRef}::date,
           ${tipoServicoSeguro},
           ${clienteId}::uuid,
           ${processoId ?? null}::uuid,
           ${session.id}::uuid,
           ${tipoServicoSeguro},
           'alta')
      `.catch((e) => {
        console.error(
          "[inss/confirmar] falha ao inserir controle de resultado de pericia:",
          e
        );
        return null;
      });
    }

    // Salva protocolo no processo se informado
    if (processoId && protocoloSeguro) {
      await sql`
        UPDATE processos
        SET protocolo_inss = ${protocoloSeguro}, updated_at = NOW()
        WHERE id = ${processoId}::uuid AND deleted_at IS NULL
      `.catch((e) => {
        console.error(
          "[inss/confirmar] falha ao atualizar protocolo_inss do processo:",
          e
        );
        return null;
      });
    }

    // Agenda lembretes (apenas para agendamentos)
    if (ehAgendamento && compromissoId) {
      const dataEventoDate = new Date(dataRef + "T12:00:00");
      await agendarLembretesInss({
        compromissoId,
        clienteId,
        clienteNome: clienteNomeSeguro,
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
        tipoServico: tipoServicoSeguro,
        local: localCompleto,
        protocolo: protocoloSeguro ?? undefined,
        escritorio: nomeEscritorio,
      });

      // Mensagem de confirmação imediata (enviada no ato do cadastro)
      const [dRef, mRef, yRef] = (() => {
        const parts = dataRef.split("-");
        return [parts[2] ?? "", parts[1] ?? "", parts[0] ?? ""];
      })();
      const dataFormatada = `${dRef}/${mRef}/${yRef}`;

      // Determina o destinatário: guardião (menor/incapaz) ou cliente
      const destTelefone = guardianTelefone ?? telefoneClienteEfetivo;
      const destPrimeiroNome =
        (guardianNome ?? clienteNomeSeguro).split(" ")[0] ?? "";

      if (destTelefone) {
        const prefixo = guardianTelefone
          ? `*Agendamento de: ${clienteNomeSeguro}*\n\n`
          : "";
        const linhaProtocolo = protocoloSeguro
          ? `\n🔢 Protocolo: ${protocoloSeguro}`
          : "";
        const mensagem =
          `${prefixo}Olá ${destPrimeiroNome}! 👋 O ${nomeEscritorio} acabou de registrar um agendamento no INSS.\n\n` +
          `*${tipoServicoSeguro}*\n\n` +
          `📅 Data: ${dataFormatada}\n` +
          `🕐 Hora: ${hora}\n` +
          `📍 Local: ${localCompleto}` +
          `${linhaProtocolo}\n\n` +
          `Você receberá lembretes conforme a data se aproximar. Qualquer dúvida, entre em contato conosco! 😊`;

        enviarMensagemDireta({ telefone: destTelefone, mensagem }).catch((e) =>
          console.error("[inss/confirmar] confirmação imediata:", e)
        );
      }
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
