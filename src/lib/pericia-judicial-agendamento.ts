import "server-only";
import sql from "./db";
import {
  agendarLembretesPericiaJudicial,
  nomeEscritorioFallback,
  dentroHorarioComercial,
  proximoHorarioComercial,
  diasAntes,
  formatarProximosAvisos,
} from "./lembretes";
import { getEscritorioConfig } from "./escritorio-db";

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
  // Quando o chamador já sabe o UUID exato do processo (ex.: select da tela
  // "Nova Perícia"), use processoId — é preciso, sem ambiguidade de número
  // mal formatado. processoNumero é o fallback pra quando só se tem o texto
  // (ex.: lido pela Íris de um documento), tentando casar por número exato
  // e, sem isso, caindo no processo ativo mais recente do cliente.
  processoId?: string | null;
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

  const processoRows = opts.processoId
    ? await sql`
        SELECT id::text, numero, responsavel_id::text
        FROM processos
        WHERE id = ${opts.processoId}::uuid AND deleted_at IS NULL
        LIMIT 1
      `
    : opts.processoNumero
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

  // getEscritorioConfig() usa unstable_cache (só funciona dentro do runtime
  // do Next) — se falhar por qualquer motivo, cai no fallback via SQL direto
  // em vez do literal "nosso escritório", que duplicava a palavra
  // "escritório" nos templates que dizem "do escritório {{escritorio}}".
  const escritorio = await getEscritorioConfig().catch(() => null);
  const nomeEscritorio = escritorio?.nome || (await nomeEscritorioFallback());
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

  // Avisos imediatos vão pra lembretes_agendados em vez de enviarMensagemDireta
  // direto — dois motivos: (1) fica com rastro durável (tentativas/erro),
  // diferente de antes, onde uma falha no fetch pro PrevBot desaparecia sem
  // deixar vestígio em lugar nenhum (achado real: aviso da perícia judicial do
  // Wilson/Karine em 2026-11-16 não chegou e não tinha como provar o motivo);
  // (2) dá pra diferenciar o horário de cada destinatário — pedido do Orlando
  // (2026-11-17): o cliente só recebe em horário comercial (mensagem fora de
  // hora passa impressão de urgência que não existe), mas o responsável do
  // processo recebe imediatamente mesmo fora do horário/fim de semana, porque
  // perícia/avaliação judicial é prazo processual e não pode esperar até
  // segunda pra ele ficar sabendo.
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
    const enviarEmCliente = dentroHorarioComercial()
      ? new Date()
      : proximoHorarioComercial();
    const inseriu = await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        ('pericia_judicial_imediato_cliente', 'compromisso', ${compromissoId}::uuid,
         ${opts.clienteId}::uuid, ${clienteNome},
         ${guardianTelefone ? "guardian" : "cliente"}, ${destCliente}, ${destClienteNome},
         ${mensagem}, ${enviarEmCliente.toISOString()})
    `.catch((e) => {
      console.error(
        "[pericia-judicial-agendamento] falha ao agendar aviso cliente:",
        e
      );
      return null;
    });
    avisoEnviadoCliente = inseriu !== null;
  }

  let avisoEnviadoResponsavel = false;
  if (telefoneResponsavel && nomeResponsavel) {
    const proximosAvisosResp = [30, 15, 10, 5, 2].filter(
      (d) => diasAntes(dataEventoDate, d, 8) > new Date()
    );
    const linhaProximosResp =
      proximosAvisosResp.length > 0
        ? ` Você também vai receber avisos automáticos com ${formatarProximosAvisos(proximosAvisosResp)} de antecedência.`
        : "";
    const mensagemResp =
      `*Agendamento de: ${clienteNome}*\n\n📌 Nova ${rotulo.toLowerCase()} registrada.\n\n` +
      `📅 Data: ${dataFormatada}\n🕐 Hora: ${opts.hora}\n📍 Local: ${opts.local}` +
      `${linhaProcesso}${linhaPerito}\n\nVocê é o responsável por esse processo no LiderAdv.${linhaProximosResp}`;
    const inseriu = await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        ('pericia_judicial_imediato_responsavel', 'compromisso', ${compromissoId}::uuid,
         ${opts.clienteId}::uuid, ${clienteNome},
         'responsavel', ${telefoneResponsavel}, ${nomeResponsavel},
         ${mensagemResp}, ${new Date().toISOString()})
    `.catch((e) => {
      console.error(
        "[pericia-judicial-agendamento] falha ao agendar aviso responsável:",
        e
      );
      return null;
    });
    avisoEnviadoResponsavel = inseriu !== null;
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
