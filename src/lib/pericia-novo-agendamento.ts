import "server-only";
import sql from "./db";
import { agendarLembretesInss } from "./lembretes";
import { getEscritorioConfig } from "./escritorio-db";
import { enviarMensagemDireta } from "./prevbot-outbound";

/**
 * Cria uma perícia/avaliação NOVA do zero — compromisso na Agenda, registro
 * em Perícias, prazo em Controles e lembretes automáticos — mesma lógica já
 * usada em api/inss/confirmar/route.ts (fluxo de "Processar INSS" a partir
 * de um documento), só que chamável diretamente pela ferramenta da Íris.
 * Não reaproveita a rota em si pra não arriscar mexer num fluxo que já
 * funciona — duplica a lógica com cuidado, mesma regra de segurança:
 * telefone SEMPRE vem do banco, nunca de texto informado na conversa.
 */

export interface NovoAgendamentoInput {
  clienteId: string;
  tipoPericia: "avaliacao_social_administrativa" | "pericia_administrativa";
  tipoServico: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  local: string;
  protocolo?: string | null;
  processoId?: string | null;
  criadoPorLogin: string;
  criadoPorUserId: string;
}

export interface NovoAgendamentoResultado {
  ok: boolean;
  erro?: string;
  compromissoId?: string;
  periciaId?: string;
  clienteNome?: string;
  avisoEnviado?: boolean;
  duplicataDetectada?: boolean;
}

export async function criarNovoAgendamentoPericia(
  opts: NovoAgendamentoInput
): Promise<NovoAgendamentoResultado> {
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
    WHERE cl.id = ${opts.clienteId}::uuid AND cl.deleted_at IS NULL
    LIMIT 1
  `.catch(() => [] as Record<string, unknown>[]);

  const row = dbRows[0];
  if (!row) return { ok: false, erro: "Cliente não encontrado." };

  const clienteNome = String(row.cliente_nome ?? "Cliente");
  let telefoneCliente = row.cliente_telefone
    ? String(row.cliente_telefone)
    : null;
  const telefoneResponsavelStaff = row.resp_telefone
    ? String(row.resp_telefone)
    : null;
  const nomeResponsavelStaff = row.resp_nome ? String(row.resp_nome) : null;
  let guardianTelefone: string | null = null;
  let guardianNome: string | null = null;
  if (row.guardian_telefone) {
    guardianTelefone = String(row.guardian_telefone);
    guardianNome = row.guardian_nome ? String(row.guardian_nome) : null;
    telefoneCliente = null; // nunca avisa o menor diretamente
  }

  // Evita duplicar — mesmo cliente, mesma data, mesmo tipo, ainda agendado.
  // Achado real nesta sessão: reprocessar o mesmo documento/pedido criava
  // perícia+compromisso+lembretes duplicados sem esse tipo de checagem.
  const existente = await sql`
    SELECT id::text FROM pericias
    WHERE client_id = ${opts.clienteId}::uuid
      AND tipo = ${opts.tipoPericia}
      AND data_pericia = ${opts.data}::date
      AND status = 'agendado'
    LIMIT 1
  `;
  if (existente.length > 0) {
    return {
      ok: false,
      erro: `Já existe uma perícia/avaliação desse tipo agendada pra ${clienteNome} em ${opts.data}. Não crie duplicado — se for pra mudar data/hora, use remarcar_pericia.`,
      duplicataDetectada: true,
    };
  }

  const escritorio = await getEscritorioConfig().catch(() => null);
  const nomeEscritorio = escritorio?.nome ?? "nosso escritório";

  const [compromisso] = await sql`
    INSERT INTO compromissos
      (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, criado_por, cliente_id)
    VALUES
      (${opts.tipoServico}, 'consulta', ${opts.data}::date, ${opts.hora},
       ${opts.local}, ${opts.protocolo ? `Protocolo: ${opts.protocolo}` : null},
       ${opts.criadoPorLogin}, ${opts.clienteId}::uuid)
    RETURNING id::text
  `;
  const compromissoId = String(compromisso.id);

  const [pericia] = await sql`
    INSERT INTO pericias
      (tipo, client_id, processo_id, data_pericia, hora_pericia, local_pericia, status, observacoes, compromisso_id)
    VALUES
      (${opts.tipoPericia}, ${opts.clienteId}::uuid, ${opts.processoId ?? null}::uuid,
       ${opts.data}::date, ${opts.hora}::time, ${opts.local}, 'agendado',
       ${opts.protocolo ? `Protocolo INSS: ${opts.protocolo}` : null}, ${compromissoId}::uuid)
    RETURNING id::text
  `.catch((e) => {
    console.error("[pericia-novo-agendamento] falha ao inserir pericia:", e);
    return [null];
  });

  await sql`
    INSERT INTO controles
      (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, prioridade)
    VALUES
      ('pericias', ${opts.data}::date, ${opts.tipoServico}, ${opts.clienteId}::uuid,
       ${opts.processoId ?? null}::uuid, ${opts.criadoPorUserId}::uuid, 'alta')
  `.catch((e) => {
    console.error("[pericia-novo-agendamento] falha ao inserir controle:", e);
    return null;
  });

  const dataEventoDate = new Date(opts.data + "T12:00:00");
  await agendarLembretesInss({
    compromissoId,
    clienteId: opts.clienteId,
    clienteNome,
    telefoneCliente,
    telefoneResponsavel: telefoneResponsavelStaff,
    nomeResponsavel: nomeResponsavelStaff,
    guardian:
      guardianTelefone && guardianNome
        ? { nome: guardianNome, telefone: guardianTelefone }
        : null,
    dataEvento: dataEventoDate,
    horaEvento: opts.hora,
    tipoServico: opts.tipoServico,
    local: opts.local,
    protocolo: opts.protocolo ?? undefined,
    escritorio: nomeEscritorio,
  }).catch((e) => {
    console.error("[pericia-novo-agendamento] falha ao agendar lembretes:", e);
    return null;
  });

  // Aviso imediato — mesmo texto/padrão já usado em api/inss/confirmar.
  const [dRef, mRef, yRef] = opts.data.split("-");
  const dataFormatada = `${dRef}/${mRef}/${yRef}`;
  const destTelefone = guardianTelefone ?? telefoneCliente;
  const destPrimeiroNome = (guardianNome ?? clienteNome).split(" ")[0] ?? "";
  let avisoEnviado = false;
  if (destTelefone) {
    const prefixo = guardianTelefone
      ? `*Agendamento de: ${clienteNome}*\n\n`
      : "";
    const linhaProtocolo = opts.protocolo
      ? `\n🔢 Protocolo: ${opts.protocolo}`
      : "";
    const mensagem =
      `${prefixo}Olá ${destPrimeiroNome}! 👋 O ${nomeEscritorio} acabou de registrar um agendamento no INSS.\n\n` +
      `*${opts.tipoServico}*\n\n` +
      `📅 Data: ${dataFormatada}\n` +
      `🕐 Hora: ${opts.hora}\n` +
      `📍 Local: ${opts.local}` +
      `${linhaProtocolo}\n\n` +
      `Você receberá lembretes conforme a data se aproximar. Qualquer dúvida, entre em contato conosco! 😊`;
    const res = await enviarMensagemDireta({
      telefone: destTelefone,
      mensagem,
    }).catch(() => ({ ok: false }));
    avisoEnviado = res.ok;
  }

  return {
    ok: true,
    compromissoId,
    periciaId: pericia?.id ? String(pericia.id) : undefined,
    clienteNome,
    avisoEnviado,
  };
}
