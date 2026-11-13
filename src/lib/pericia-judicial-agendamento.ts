import "server-only";
import sql from "./db";
import { agendarLembretesPericiaJudicial } from "./lembretes";
import { getEscritorioConfig } from "./escritorio-db";
import { enviarMensagemDireta } from "./prevbot-outbound";

/**
 * Cria uma perícia médica ou avaliação social JUDICIAL nova (vinda de um
 * despacho dentro de um processo — diferente de criarNovoAgendamentoPericia,
 * que é só pro agendamento administrativo do INSS): compromisso na Agenda,
 * registro em Perícias (vinculado ao processo quando encontrado), prazo em
 * Controles e lembretes automáticos (30/15/10/5/2 dias, cadência de prazo
 * processual) pro cliente/responsável legal e pro responsável do processo.
 *
 * Achado real (2026-11-12): antes, perícia/avaliação judicial só virava um
 * registro manual em Controles, sem compromisso na Agenda nem lembrete —
 * criar_controle_pericia tratava JUDICIAL e ADMINISTRATIVO da mesma forma
 * só pra registro. Essa função fecha essa lacuna especificamente pro caso
 * judicial, com texto que nunca menciona "INSS"/"APS".
 */

export interface NovoAgendamentoJudicialInput {
  clienteId: string;
  tipo: "pericia_judicial" | "avaliacao_social_judicial";
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  local: string;
  perito?: string | null;
  especialidade?: string | null;
  processoNumero?: string | null;
  observacoes?: string | null;
  criadoPorLogin: string;
  criadoPorUserId: string;
}

export interface NovoAgendamentoJudicialResultado {
  ok: boolean;
  erro?: string;
  compromissoId?: string;
  periciaId?: string;
  clienteNome?: string;
  processoNumero?: string | null;
  avisoEnviadoCliente?: boolean;
  avisoEnviadoResponsavel?: boolean;
  duplicataDetectada?: boolean;
}

const ROTULOS: Record<string, string> = {
  pericia_judicial: "Perícia Médica (Judicial)",
  avaliacao_social_judicial: "Perícia Social (Judicial)",
};

export async function criarNovoAgendamentoPericiaJudicial(
  opts: NovoAgendamentoJudicialInput
): Promise<NovoAgendamentoJudicialResultado> {
  const clienteRows = await sql`
    SELECT
      cl.name                 AS cliente_nome,
      cl.phone                AS cliente_telefone,
      cl.responsavel_telefone AS guardian_telefone,
      cl.responsavel_nome     AS guardian_nome
    FROM clients cl
    WHERE cl.id = ${opts.clienteId}::uuid AND cl.deleted_at IS NULL
    LIMIT 1
  `.catch(() => [] as Record<string, unknown>[]);
  const clienteRow = clienteRows[0];
  if (!clienteRow) return { ok: false, erro: "Cliente não encontrado." };

  const clienteNome = String(clienteRow.cliente_nome ?? "Cliente");
  let telefoneCliente = clienteRow.cliente_telefone
    ? String(clienteRow.cliente_telefone)
    : null;
  let guardianTelefone: string | null = null;
  let guardianNome: string | null = null;
  if (clienteRow.guardian_telefone) {
    guardianTelefone = String(clienteRow.guardian_telefone);
    guardianNome = clienteRow.guardian_nome
      ? String(clienteRow.guardian_nome)
      : null;
    telefoneCliente = null; // nunca avisa o menor diretamente
  }

  const processoRows = opts.processoNumero
    ? await sql`
        SELECT id::text, numero, responsavel_id::text
        FROM processos
        WHERE client_id = ${opts.clienteId}::uuid
          AND numero = ${opts.processoNumero}
          AND deleted_at IS NULL
        LIMIT 1
      `
    : await sql`
        SELECT id::text, numero, responsavel_id::text
        FROM processos
        WHERE client_id = ${opts.clienteId}::uuid AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `;
  const processo = processoRows[0] ?? null;
  const processoId = processo?.id ? String(processo.id) : null;
  const processoNumero = processo?.numero
    ? String(processo.numero)
    : (opts.processoNumero ?? null);

  let telefoneResponsavel: string | null = null;
  let nomeResponsavel: string | null = null;
  if (processo?.responsavel_id) {
    const [resp] = await sql`
      SELECT telefone, nome FROM colaboradores
      WHERE id = ${processo.responsavel_id}::uuid AND status = 'ativo'
      LIMIT 1
    `;
    if (resp) {
      telefoneResponsavel = resp.telefone ? String(resp.telefone) : null;
      nomeResponsavel = resp.nome ? String(resp.nome) : null;
    }
  }

  // Evita duplicar — mesmo cliente, mesma data, mesmo tipo, ainda agendado.
  const existente = await sql`
    SELECT id::text FROM pericias
    WHERE client_id = ${opts.clienteId}::uuid
      AND tipo = ${opts.tipo}
      AND data_pericia = ${opts.data}::date
      AND status = 'agendado'
    LIMIT 1
  `;
  if (existente.length > 0) {
    return {
      ok: false,
      erro: `Já existe uma perícia/avaliação judicial desse tipo agendada pra ${clienteNome} em ${opts.data}. Não crie duplicado — se for pra mudar data/hora, use remarcar_pericia.`,
      duplicataDetectada: true,
    };
  }

  const escritorio = await getEscritorioConfig().catch(() => null);
  const nomeEscritorio = escritorio?.nome ?? "nosso escritório";
  const rotulo = ROTULOS[opts.tipo] ?? "Perícia Judicial";
  const titulo = processoNumero
    ? `${rotulo} — processo ${processoNumero}`
    : rotulo;
  const descricaoPartes = [
    opts.perito ? `Perito(a): ${opts.perito}` : null,
    opts.especialidade ? `Especialidade: ${opts.especialidade}` : null,
    opts.observacoes || null,
  ].filter((v): v is string => Boolean(v));

  const [compromisso] = await sql`
    INSERT INTO compromissos
      (titulo, tipo, data_inicio, hora_inicio, local_link, descricao, criado_por, cliente_id)
    VALUES
      (${titulo}, 'consulta', ${opts.data}::date, ${opts.hora},
       ${opts.local}, ${descricaoPartes.length ? descricaoPartes.join(" | ") : null},
       ${opts.criadoPorLogin}, ${opts.clienteId}::uuid)
    RETURNING id::text
  `;
  const compromissoId = String(compromisso.id);

  const periciaRows = await sql`
    INSERT INTO pericias
      (tipo, client_id, processo_id, data_pericia, hora_pericia,
       local_pericia, perito, especialidade, status, observacoes, compromisso_id)
    VALUES
      (${opts.tipo}, ${opts.clienteId}::uuid, ${processoId}::uuid,
       ${opts.data}::date, ${opts.hora}::time, ${opts.local},
       ${opts.perito ?? null}, ${opts.especialidade ?? null}, 'agendado',
       ${opts.observacoes ?? null}, ${compromissoId}::uuid)
    RETURNING id::text
  `.catch((e) => {
    console.error(
      "[pericia-judicial-agendamento] falha ao inserir pericia:",
      e
    );
    return [] as { id: string }[];
  });

  await sql`
    INSERT INTO controles
      (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, prioridade)
    VALUES
      ('pericias', ${opts.data}::date, ${titulo}, ${opts.clienteId}::uuid,
       ${processoId}::uuid, ${opts.criadoPorUserId}::uuid, 'alta')
  `.catch((e) => {
    console.error(
      "[pericia-judicial-agendamento] falha ao inserir controle:",
      e
    );
    return null;
  });

  const dataEventoDate = new Date(opts.data + "T12:00:00");
  await agendarLembretesPericiaJudicial({
    compromissoId,
    clienteId: opts.clienteId,
    clienteNome,
    telefoneCliente,
    telefoneResponsavel,
    nomeResponsavel,
    guardian:
      guardianTelefone && guardianNome
        ? { nome: guardianNome, telefone: guardianTelefone }
        : null,
    dataEvento: dataEventoDate,
    horaEvento: opts.hora,
    tipoServico: titulo,
    local: opts.local,
    perito: opts.perito ?? null,
    processoNumero,
    escritorio: nomeEscritorio,
  }).catch((e) => {
    console.error(
      "[pericia-judicial-agendamento] falha ao agendar lembretes:",
      e
    );
    return null;
  });

  const [dRef, mRef, yRef] = opts.data.split("-");
  const dataFormatada = `${dRef}/${mRef}/${yRef}`;
  const linhaProcesso = processoNumero
    ? `\n⚖️ Processo: ${processoNumero}`
    : "";
  const linhaPerito = opts.perito ? `\n👤 Perito(a): ${opts.perito}` : "";

  let avisoEnviadoCliente = false;
  const destCliente = guardianTelefone ?? telefoneCliente;
  const destClienteNome = (guardianNome ?? clienteNome).split(" ")[0] ?? "";
  if (destCliente) {
    const prefixo = guardianTelefone
      ? `*Agendamento de: ${clienteNome}*\n\n`
      : "";
    const mensagem =
      `${prefixo}Olá ${destClienteNome}! 👋 O ${nomeEscritorio} acabou de registrar uma ${rotulo.toLowerCase()} no seu processo.\n\n` +
      `*${titulo}*\n\n📅 Data: ${dataFormatada}\n🕐 Hora: ${opts.hora}\n📍 Local: ${opts.local}` +
      `${linhaProcesso}${linhaPerito}\n\nVocê receberá lembretes conforme a data se aproximar. Qualquer dúvida, entre em contato conosco! 😊`;
    const res = await enviarMensagemDireta({
      telefone: destCliente,
      mensagem,
    }).catch(() => ({ ok: false }));
    avisoEnviadoCliente = res.ok;
  }

  let avisoEnviadoResponsavel = false;
  if (telefoneResponsavel && nomeResponsavel) {
    const mensagemResp =
      `*Agendamento de: ${clienteNome}*\n\n📌 Nova ${rotulo.toLowerCase()} registrada.\n\n` +
      `📅 Data: ${dataFormatada}\n🕐 Hora: ${opts.hora}\n📍 Local: ${opts.local}` +
      `${linhaProcesso}${linhaPerito}\n\nVocê é o responsável por esse processo no LiderAdv.`;
    const res = await enviarMensagemDireta({
      telefone: telefoneResponsavel,
      mensagem: mensagemResp,
    }).catch(() => ({ ok: false }));
    avisoEnviadoResponsavel = res.ok;
  }

  return {
    ok: true,
    compromissoId,
    periciaId: periciaRows[0]?.id ? String(periciaRows[0].id) : undefined,
    clienteNome,
    processoNumero,
    avisoEnviadoCliente,
    avisoEnviadoResponsavel,
  };
}
