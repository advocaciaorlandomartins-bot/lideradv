import sql from "./db";
import {
  INSS_MENSAGENS,
  HONORARIO_MENSAGENS,
  renderMensagem,
} from "@/config/mensagens";
import { getMensagensConfig } from "@/lib/mensagens-config-db";

// ── Tipos ─────────────────────────────────────────────────────

export type TipoLembrete =
  | "inss_15d"
  | "inss_5d"
  | "inss_2d"
  | "inss_1d_manha"
  | "inss_1d_tarde"
  | "honorario_10d"
  | "honorario_5d"
  | "honorario_1d"
  | "honorario_vence_hoje"
  | "honorario_pago_confirmacao"
  | "compromisso_convite"
  | "compromisso_1d"
  | "compromisso_dia"
  | "conta_1d"
  | "conta_vence_hoje";

// ── Helpers de data ───────────────────────────────────────────

function diasAntes(
  dataEvento: Date,
  dias: number,
  hora: number,
  minuto = 0
): Date {
  const d = new Date(dataEvento);
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function mesmoDia(dataEvento: Date, hora: number, minuto = 0): Date {
  const d = new Date(dataEvento);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

// ── Formatadores ──────────────────────────────────────────────

function primeiroNome(nome: string): string {
  return nome.split(" ")[0];
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatarDiaSemana(data: Date): string {
  const dias = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];
  return dias[data.getDay()];
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Templates de mensagem humanizados ────────────────────────

export function mensagemInss(opts: {
  tipo: "inss_15d" | "inss_5d" | "inss_2d" | "inss_1d_manha" | "inss_1d_tarde";
  nomeDestinatario: string;
  tipoServico: string;
  dataEvento: Date;
  hora: string;
  local: string;
  protocolo?: string;
  escritorio?: string;
}): string {
  const nome = primeiroNome(opts.nomeDestinatario);
  const data = formatarData(opts.dataEvento);
  const diaSemana = formatarDiaSemana(opts.dataEvento);
  const servico = opts.tipoServico || "atendimento no INSS";
  const escritorio = opts.escritorio || "nosso escritório";

  const mapas: Record<string, string> = {
    inss_15d: INSS_MENSAGENS.lembrete1(
      nome,
      escritorio,
      servico,
      diaSemana,
      data,
      opts.hora,
      opts.local
    ),
    inss_5d: INSS_MENSAGENS.lembrete2(
      nome,
      escritorio,
      servico,
      diaSemana,
      data,
      opts.hora,
      opts.local
    ),
    inss_2d: INSS_MENSAGENS.lembrete3(
      nome,
      escritorio,
      servico,
      diaSemana,
      data,
      opts.hora,
      opts.local
    ),
    inss_1d_manha: INSS_MENSAGENS.vespera_manha(
      nome,
      escritorio,
      servico,
      diaSemana,
      data,
      opts.hora,
      opts.local
    ),
    inss_1d_tarde: INSS_MENSAGENS.vespera_tarde(
      nome,
      escritorio,
      servico,
      diaSemana,
      data,
      opts.hora,
      opts.local
    ),
  };

  return mapas[opts.tipo] ?? "";
}

export function mensagemHonorario(opts: {
  tipo:
    | "honorario_10d"
    | "honorario_5d"
    | "honorario_1d"
    | "honorario_vence_hoje";
  nomeDestinatario: string;
  valor: number;
  dataVencimento: Date;
  descricao?: string;
  escritorio?: string;
}): string {
  const nome = primeiroNome(opts.nomeDestinatario);
  const data = formatarData(opts.dataVencimento);
  const valor = formatarMoeda(opts.valor);
  const escritorio = opts.escritorio || "nosso escritório";

  const mapas: Record<string, string> = {
    honorario_10d: HONORARIO_MENSAGENS.lembrete1(nome, escritorio, valor, data),
    honorario_5d: HONORARIO_MENSAGENS.lembrete2(nome, escritorio, valor, data),
    honorario_1d: HONORARIO_MENSAGENS.lembrete3(nome, escritorio, valor, data),
    honorario_vence_hoje: HONORARIO_MENSAGENS.vence_hoje(
      nome,
      escritorio,
      valor,
      data
    ),
  };

  return mapas[opts.tipo] ?? "";
}

export function mensagemPagamentoConfirmado(opts: {
  nomeDestinatario: string;
  valorPago: number;
  dataPagamento: Date;
  saldoRestante: number;
  escritorio?: string;
}): string {
  const nome = primeiroNome(opts.nomeDestinatario);
  const valorPago = formatarMoeda(opts.valorPago);
  const data = formatarData(opts.dataPagamento);

  if (opts.saldoRestante <= 0) {
    return HONORARIO_MENSAGENS.pagamento_quitado(nome, valorPago, data);
  }

  const saldo = formatarMoeda(opts.saldoRestante);
  return HONORARIO_MENSAGENS.pagamento_parcial(nome, valorPago, data, saldo);
}

// ── Agendamento de lembretes INSS ─────────────────────────────

export async function agendarLembretesInss(opts: {
  compromissoId: string;
  clienteId: string;
  clienteNome: string;
  telefoneCliente: string | null;
  telefoneResponsavel: string | null;
  nomeResponsavel: string | null;
  dataEvento: Date;
  horaEvento: string;
  tipoServico: string;
  local: string;
  protocolo?: string;
  escritorio?: string;
}): Promise<void> {
  const cfg = await getMensagensConfig();

  const destinos: Array<{ tipo: string; telefone: string; nome: string }> = [];

  if (opts.telefoneCliente) {
    destinos.push({
      tipo: "cliente",
      telefone: opts.telefoneCliente,
      nome: opts.clienteNome,
    });
  }
  if (opts.telefoneResponsavel && opts.nomeResponsavel) {
    destinos.push({
      tipo: "responsavel",
      telefone: opts.telefoneResponsavel,
      nome: opts.nomeResponsavel,
    });
  }

  const tiposLembrete: Array<{
    tipo:
      | "inss_15d"
      | "inss_5d"
      | "inss_2d"
      | "inss_1d_manha"
      | "inss_1d_tarde";
    template: string;
    enviarEm: Date;
  }> = [
    {
      tipo: "inss_15d",
      template: cfg.inss_lembrete1,
      enviarEm: diasAntes(opts.dataEvento, cfg.inss_lembrete1_dias, 8),
    },
    {
      tipo: "inss_5d",
      template: cfg.inss_lembrete2,
      enviarEm: diasAntes(opts.dataEvento, cfg.inss_lembrete2_dias, 8),
    },
    {
      tipo: "inss_2d",
      template: cfg.inss_lembrete3,
      enviarEm: diasAntes(opts.dataEvento, cfg.inss_lembrete3_dias, 8),
    },
    {
      tipo: "inss_1d_manha",
      template: cfg.inss_vespera_manha,
      enviarEm: diasAntes(opts.dataEvento, 1, cfg.inss_vespera_manha_hora),
    },
    {
      tipo: "inss_1d_tarde",
      template: cfg.inss_vespera_tarde,
      enviarEm: diasAntes(opts.dataEvento, 1, cfg.inss_vespera_tarde_hora),
    },
  ];

  for (const dest of destinos) {
    for (const lembrete of tiposLembrete) {
      if (lembrete.enviarEm <= new Date()) continue;

      const vars = {
        nome: primeiroNome(dest.nome),
        escritorio: opts.escritorio ?? "nosso escritório",
        servico: opts.tipoServico || "atendimento no INSS",
        diaSemana: formatarDiaSemana(opts.dataEvento),
        data: formatarData(opts.dataEvento),
        hora: opts.horaEvento,
        local: opts.local,
      };

      const mensagem = renderMensagem(lembrete.template, vars);

      await sql`
        INSERT INTO lembretes_agendados
          (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
           destinatario_tipo, destinatario_telefone, destinatario_nome,
           mensagem, enviar_em)
        VALUES
          (${lembrete.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
           ${opts.clienteId}::uuid, ${opts.clienteNome},
           ${dest.tipo}, ${dest.telefone}, ${dest.nome},
           ${mensagem}, ${lembrete.enviarEm.toISOString()})
      `;
    }
  }
}

// ── Agendamento de lembretes de honorário ─────────────────────

export async function agendarLembretesHonorario(opts: {
  lancamentoId: string;
  clienteId: string;
  clienteNome: string;
  telefone: string | null;
  valor: number;
  dataVencimento: Date;
  descricao?: string;
  escritorio?: string;
}): Promise<void> {
  if (!opts.telefone) return;

  const cfg = await getMensagensConfig();

  const tiposLembrete: Array<{
    tipo:
      | "honorario_10d"
      | "honorario_5d"
      | "honorario_1d"
      | "honorario_vence_hoje";
    template: string;
    enviarEm: Date;
  }> = [
    {
      tipo: "honorario_10d",
      template: cfg.honorario_lembrete1,
      enviarEm: diasAntes(opts.dataVencimento, cfg.honorario_lembrete1_dias, 8),
    },
    {
      tipo: "honorario_5d",
      template: cfg.honorario_lembrete2,
      enviarEm: diasAntes(opts.dataVencimento, cfg.honorario_lembrete2_dias, 8),
    },
    {
      tipo: "honorario_1d",
      template: cfg.honorario_lembrete3,
      enviarEm: diasAntes(opts.dataVencimento, cfg.honorario_lembrete3_dias, 8),
    },
    {
      tipo: "honorario_vence_hoje",
      template: cfg.honorario_vence_hoje,
      enviarEm: mesmoDia(
        opts.dataVencimento,
        cfg.honorario_vencimento_hoje_hora
      ),
    },
  ];

  const nome = primeiroNome(opts.clienteNome);
  const escritorio = opts.escritorio ?? "nosso escritório";
  const valor = formatarMoeda(opts.valor);

  for (const lembrete of tiposLembrete) {
    if (lembrete.enviarEm <= new Date()) continue;

    const mensagem = renderMensagem(lembrete.template, {
      nome,
      escritorio,
      valor,
      data: formatarData(opts.dataVencimento),
    });

    await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        (${lembrete.tipo}, 'lancamento', ${opts.lancamentoId}::uuid,
         ${opts.clienteId}::uuid, ${opts.clienteNome},
         'cliente', ${opts.telefone}, ${opts.clienteNome},
         ${mensagem}, ${lembrete.enviarEm.toISOString()})
    `;
  }
}

// ── Videochamada — convite imediato + lembretes ───────────────────────────────

export async function agendarVideochamadaWhatsApp(opts: {
  compromissoId: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  dataEvento: Date;
  horaEvento: string;
  link?: string;
  tipoReuniao?: "meet" | "whatsapp";
  escritorio?: string;
  responsavel?: { telefone: string; nome: string };
}): Promise<void> {
  const cfg = await getMensagensConfig();
  const isMeet = (opts.tipoReuniao ?? "meet") === "meet";

  const agora = new Date();

  const lembretes: Array<{ tipo: string; template: string; enviarEm: Date }> = [
    {
      tipo: isMeet ? "videochamada_convite" : "wpp_call_convite",
      template: isMeet ? cfg.videochamada_convite : cfg.wpp_call_convite,
      enviarEm: new Date(agora.getTime() + 60_000),
    },
    {
      tipo: isMeet ? "videochamada_vespera" : "wpp_call_vespera",
      template: isMeet ? cfg.videochamada_vespera : cfg.wpp_call_vespera,
      enviarEm: diasAntes(opts.dataEvento, 1, cfg.videochamada_vespera_hora),
    },
    {
      tipo: isMeet ? "videochamada_dia" : "wpp_call_dia",
      template: isMeet ? cfg.videochamada_dia : cfg.wpp_call_dia,
      enviarEm: mesmoDia(opts.dataEvento, cfg.videochamada_dia_hora),
    },
  ];

  // Notifica o cliente
  const varsCliente = {
    nome: primeiroNome(opts.clienteNome),
    escritorio: opts.escritorio ?? "nosso escritório",
    diaSemana: formatarDiaSemana(opts.dataEvento),
    data: formatarData(opts.dataEvento),
    hora: opts.horaEvento,
    link: opts.link ?? "",
  };

  for (const lembrete of lembretes) {
    if (lembrete.enviarEm <= agora) continue;
    const mensagem = renderMensagem(lembrete.template, varsCliente);
    await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        (${lembrete.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
         ${opts.clienteId}::uuid, ${opts.clienteNome},
         'cliente', ${opts.telefone}, ${opts.clienteNome},
         ${mensagem}, ${lembrete.enviarEm.toISOString()})
    `;
  }

  // Notifica o responsável (colaborador) com lembretes D-1 e no dia
  if (opts.responsavel?.telefone) {
    const diaSemana = formatarDiaSemana(opts.dataEvento);
    const data = formatarData(opts.dataEvento);
    const tipoLabel = isMeet ? "Videochamada" : "Ligação WhatsApp";
    const linkStr = opts.link ? `\n🔗 ${opts.link}` : "";

    const lembretesResp: Array<{
      tipo: string;
      enviarEm: Date;
      mensagem: string;
    }> = [
      {
        tipo: "compromisso_1d",
        enviarEm: diasAntes(opts.dataEvento, 1, 8),
        mensagem:
          `📅 *Lembrete para amanhã!*\n\n` +
          `*${tipoLabel} com ${opts.clienteNome}*\n` +
          `🗓️ ${diaSemana}, ${data} às ${opts.horaEvento}${linkStr}\n\n` +
          `_Acesse a Agenda no LiderAdv para mais detalhes._`,
      },
      {
        tipo: "compromisso_dia",
        enviarEm: mesmoDia(opts.dataEvento, 7),
        mensagem:
          `⏰ *${tipoLabel} hoje!*\n\n` +
          `*Com ${opts.clienteNome}*\n` +
          `🗓️ ${diaSemana}, ${data} às ${opts.horaEvento}${linkStr}\n\n` +
          `_Boa reunião! 💼_`,
      },
    ];

    for (const lembrete of lembretesResp) {
      if (lembrete.enviarEm <= agora) continue;
      await sql`
        INSERT INTO lembretes_agendados
          (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
           destinatario_tipo, destinatario_telefone, destinatario_nome,
           mensagem, enviar_em)
        VALUES
          (${lembrete.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
           ${opts.clienteId}::uuid, ${opts.clienteNome},
           'responsavel', ${opts.responsavel.telefone}, ${opts.responsavel.nome},
           ${lembrete.mensagem}, ${lembrete.enviarEm.toISOString()})
      `;
    }
  }
}

export async function cancelarLembretesLancamento(
  lancamentoId: string
): Promise<void> {
  await sql`
    UPDATE lembretes_agendados
    SET enviado = TRUE, enviado_em = NOW(), erro = 'cancelado_pagamento'
    WHERE referencia_tipo = 'lancamento'
      AND referencia_id = ${lancamentoId}::uuid
      AND NOT enviado
      AND tipo LIKE 'honorario_%'
      AND tipo != 'honorario_pago_confirmacao'
  `;
}

// ── Lembretes de compromisso para colaborador (criado via PrevBot) ────────────

export async function agendarLembretesCompromissoPrevBot(opts: {
  compromissoId: string;
  titulo: string;
  dataEvento: Date;
  hora: string | null;
  local: string | null;
  colaboradorTelefone: string;
  colaboradorNome: string;
}): Promise<void> {
  const diaSemana = formatarDiaSemana(opts.dataEvento);
  const data = formatarData(opts.dataEvento);
  const horaStr = opts.hora ? ` às ${opts.hora}` : "";
  const localStr = opts.local ? `\n📍 ${opts.local}` : "";

  const lembretes: Array<{ tipo: string; enviarEm: Date; mensagem: string }> = [
    {
      tipo: "compromisso_1d",
      enviarEm: diasAntes(opts.dataEvento, 1, 8),
      mensagem:
        `📅 *Lembrete para amanhã!*\n\n` +
        `*${opts.titulo}*\n` +
        `🗓️ ${diaSemana}, ${data}${horaStr}${localStr}\n\n` +
        `_Acesse a Agenda no LiderAdv para mais detalhes._`,
    },
    {
      tipo: "compromisso_dia",
      enviarEm: mesmoDia(opts.dataEvento, 7),
      mensagem:
        `⏰ *Compromisso hoje!*\n\n` +
        `*${opts.titulo}*\n` +
        `🗓️ ${diaSemana}, ${data}${horaStr}${localStr}\n\n` +
        `_Boa sorte! 💼_`,
    },
  ];

  const agora = new Date();
  for (const lembrete of lembretes) {
    if (lembrete.enviarEm <= agora) continue;
    await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        (${lembrete.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
         NULL, ${opts.colaboradorNome},
         'colaborador', ${opts.colaboradorTelefone}, ${opts.colaboradorNome},
         ${lembrete.mensagem}, ${lembrete.enviarEm.toISOString()})
    `;
  }
}

// ── Notificações automáticas para compromissos criados no sistema ──────────────

const TIPO_LABEL_COMP: Record<string, string> = {
  videochamada: "Videochamada",
  reuniao: "Reunião",
  fechamento: "Fechamento de Contrato",
  consulta: "Consulta",
  outro: "Compromisso",
};
const TIPO_ICON_COMP: Record<string, string> = {
  videochamada: "📹",
  reuniao: "🤝",
  fechamento: "✍️",
  consulta: "👥",
  outro: "📅",
};

export async function agendarNotificacoesCompromisso(opts: {
  compromissoId: string;
  titulo: string;
  tipo: string;
  dataEvento: Date;
  hora: string | null;
  local: string | null;
  link: string | null;
  colaborador: { telefone: string; nome: string } | null;
  cliente: { id: string; telefone: string; nome: string } | null;
}): Promise<void> {
  const agora = new Date();
  const diaSemana = formatarDiaSemana(opts.dataEvento);
  const data = formatarData(opts.dataEvento);
  const horaStr = opts.hora ? ` às ${opts.hora}` : "";
  const localStr = opts.local ? `\n📍 ${opts.local}` : "";
  const linkStr = opts.link ? `\n🔗 ${opts.link}` : "";
  const label = TIPO_LABEL_COMP[opts.tipo] ?? "Compromisso";
  const icon = TIPO_ICON_COMP[opts.tipo] ?? "📅";

  // Helper para inserir lembrete com ou sem clienteId
  const inserirLembrete = async (row: {
    tipo: string;
    enviarEm: Date;
    mensagem: string;
    destinatarioTipo: string;
    destinatarioTelefone: string;
    destinatarioNome: string;
    clienteId: string | null;
    clienteNome: string;
  }) => {
    if (row.enviarEm <= agora) return;
    if (row.clienteId) {
      await sql`
        INSERT INTO lembretes_agendados
          (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
           destinatario_tipo, destinatario_telefone, destinatario_nome,
           mensagem, enviar_em)
        VALUES
          (${row.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
           ${row.clienteId}::uuid, ${row.clienteNome},
           ${row.destinatarioTipo}, ${row.destinatarioTelefone}, ${row.destinatarioNome},
           ${row.mensagem}, ${row.enviarEm.toISOString()})
      `.catch(() => null);
    } else {
      await sql`
        INSERT INTO lembretes_agendados
          (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
           destinatario_tipo, destinatario_telefone, destinatario_nome,
           mensagem, enviar_em)
        VALUES
          (${row.tipo}, 'compromisso', ${opts.compromissoId}::uuid,
           NULL, ${row.clienteNome},
           ${row.destinatarioTipo}, ${row.destinatarioTelefone}, ${row.destinatarioNome},
           ${row.mensagem}, ${row.enviarEm.toISOString()})
      `.catch(() => null);
    }
  };

  // ── Notificações para o COLABORADOR ──
  if (opts.colaborador?.telefone) {
    const clienteNomeStr = opts.cliente?.nome
      ? `👤 ${opts.cliente.nome}\n`
      : "";

    // Confirmação imediata para o colaborador — todos os tipos
    {
      const localOuLink = opts.link
        ? `\n🔗 ${opts.link}`
        : opts.local
          ? `\n📍 ${opts.local}`
          : "";
      await inserirLembrete({
        tipo: "compromisso_convite",
        enviarEm: new Date(agora.getTime() + 60_000),
        mensagem:
          `${icon} *${label} agendado!*\n\n` +
          `📌 *${opts.titulo}*\n` +
          `${clienteNomeStr}` +
          `🗓️ ${diaSemana}, ${data}${horaStr}${localOuLink}\n\n` +
          `_Registrado na sua Agenda — LiderAdv._`,
        destinatarioTipo: "colaborador",
        destinatarioTelefone: opts.colaborador.telefone,
        destinatarioNome: opts.colaborador.nome,
        clienteId: null,
        clienteNome: opts.colaborador.nome,
      });
    }

    // D-1 às 8h
    await inserirLembrete({
      tipo: "compromisso_1d",
      enviarEm: diasAntes(opts.dataEvento, 1, 8),
      mensagem:
        `📅 *Lembrete para amanhã!*\n\n` +
        `${icon} *${opts.titulo}*\n` +
        `${clienteNomeStr}` +
        `🗓️ ${diaSemana}, ${data}${horaStr}${localStr}${linkStr}\n\n` +
        `_Acesse a Agenda no LiderAdv._`,
      destinatarioTipo: "colaborador",
      destinatarioTelefone: opts.colaborador.telefone,
      destinatarioNome: opts.colaborador.nome,
      clienteId: null,
      clienteNome: opts.colaborador.nome,
    });

    // No dia às 7h
    await inserirLembrete({
      tipo: "compromisso_dia",
      enviarEm: mesmoDia(opts.dataEvento, 7),
      mensagem:
        `⏰ *${label} hoje!*\n\n` +
        `${icon} *${opts.titulo}*\n` +
        `${clienteNomeStr}` +
        `🗓️ ${data}${horaStr}${localStr}${linkStr}\n\n` +
        `_Boa reunião! 💼_`,
      destinatarioTipo: "colaborador",
      destinatarioTelefone: opts.colaborador.telefone,
      destinatarioNome: opts.colaborador.nome,
      clienteId: null,
      clienteNome: opts.colaborador.nome,
    });
  }

  // ── Notificações para o CLIENTE ──
  if (opts.cliente?.telefone) {
    const primeiroNomeCliente = primeiroNome(opts.cliente.nome);

    // Confirmação imediata para o cliente — todos os tipos, com pedido de confirmação
    {
      const localOuLink = opts.link
        ? `\n🔗 ${opts.link}`
        : opts.local
          ? `\n📍 ${opts.local}`
          : "";
      await inserirLembrete({
        tipo: "compromisso_convite",
        enviarEm: new Date(agora.getTime() + 60_000),
        mensagem:
          `${icon} Olá, ${primeiroNomeCliente}! Gostaríamos de confirmar o seu *${label}* com o *Orlando Martins Advocacia*:\n\n` +
          `📌 *${opts.titulo}*\n` +
          `🗓️ ${diaSemana}, ${data}${horaStr}${localOuLink}\n\n` +
          `Por favor, *confirme respondendo SIM* se esse horário está bom para você. Se precisar remarcar, é só nos chamar! 😊`,
        destinatarioTipo: "cliente",
        destinatarioTelefone: opts.cliente.telefone,
        destinatarioNome: opts.cliente.nome,
        clienteId: opts.cliente.id,
        clienteNome: opts.cliente.nome,
      });
    }

    // D-1 às 8h
    await inserirLembrete({
      tipo: "compromisso_1d",
      enviarEm: diasAntes(opts.dataEvento, 1, 8),
      mensagem:
        `📅 *Lembrete para amanhã!*\n\n` +
        `${icon} Olá, ${primeiroNomeCliente}! Você tem um *${label}* com nosso escritório amanhã:\n\n` +
        `🗓️ ${diaSemana}, ${data}${horaStr}${localStr}${linkStr}\n\n` +
        `_Qualquer imprevisto, nos avise com antecedência._`,
      destinatarioTipo: "cliente",
      destinatarioTelefone: opts.cliente.telefone,
      destinatarioNome: opts.cliente.nome,
      clienteId: opts.cliente.id,
      clienteNome: opts.cliente.nome,
    });

    // No dia às 7h
    await inserirLembrete({
      tipo: "compromisso_dia",
      enviarEm: mesmoDia(opts.dataEvento, 7),
      mensagem:
        `⏰ *${label} hoje!*\n\n` +
        `${icon} Olá, ${primeiroNomeCliente}! Lembrando que você tem um *${label}* com nosso escritório *hoje*:\n\n` +
        `🗓️ ${data}${horaStr}${localStr}${linkStr}\n\n` +
        `_Até logo! 😊_`,
      destinatarioTipo: "cliente",
      destinatarioTelefone: opts.cliente.telefone,
      destinatarioNome: opts.cliente.nome,
      clienteId: opts.cliente.id,
      clienteNome: opts.cliente.nome,
    });
  }
}

// ── Lembretes de conta pendente para colaborador (criado via PrevBot) ─────────

export async function agendarLembretesContaPendente(opts: {
  lancamentoId: string;
  descricao: string;
  valor: number;
  dataVencimento: Date;
  colaboradorTelefone: string;
  colaboradorNome: string;
}): Promise<void> {
  const data = formatarData(opts.dataVencimento);
  const valor = formatarMoeda(opts.valor);

  const lembretes: Array<{ tipo: string; enviarEm: Date; mensagem: string }> = [
    {
      tipo: "conta_1d",
      enviarEm: diasAntes(opts.dataVencimento, 1, 8),
      mensagem:
        `💸 *Lembrete de vencimento*\n\n` +
        `*${opts.descricao}*\n` +
        `💵 ${valor}\n` +
        `📅 Vence amanhã (${data})\n\n` +
        `_Lembre de pagar e registrar no Meu Financeiro._`,
    },
    {
      tipo: "conta_vence_hoje",
      enviarEm: mesmoDia(opts.dataVencimento, 8),
      mensagem:
        `🔔 *Conta vence hoje!*\n\n` +
        `*${opts.descricao}*\n` +
        `💵 ${valor}\n` +
        `📅 Vencimento: ${data}\n\n` +
        `_Após pagar, registre no Meu Financeiro do LiderAdv._`,
    },
  ];

  const agora = new Date();
  for (const lembrete of lembretes) {
    if (lembrete.enviarEm <= agora) continue;
    await sql`
      INSERT INTO lembretes_agendados
        (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
         destinatario_tipo, destinatario_telefone, destinatario_nome,
         mensagem, enviar_em)
      VALUES
        (${lembrete.tipo}, 'lancamento', ${opts.lancamentoId}::uuid,
         NULL, ${opts.colaboradorNome},
         'colaborador', ${opts.colaboradorTelefone}, ${opts.colaboradorNome},
         ${lembrete.mensagem}, ${lembrete.enviarEm.toISOString()})
    `;
  }
}

export async function agendarConfirmacaoPagamento(opts: {
  lancamentoId: string;
  clienteId: string;
  clienteNome: string;
  telefone: string | null;
  valorPago: number;
  dataPagamento: Date;
  saldoRestante: number;
}): Promise<void> {
  if (!opts.telefone) return;

  const cfg = await getMensagensConfig();
  const nome = primeiroNome(opts.clienteNome);
  const valor = formatarMoeda(opts.valorPago);
  const data = formatarData(opts.dataPagamento);

  const mensagem =
    opts.saldoRestante <= 0
      ? renderMensagem(cfg.honorario_pagamento_quitado, { nome, valor, data })
      : renderMensagem(cfg.honorario_pagamento_parcial, {
          nome,
          valor,
          data,
          saldo: formatarMoeda(opts.saldoRestante),
        });

  // Envia imediatamente (1 minuto no futuro para dar tempo ao DB commit)
  const enviarEm = new Date(Date.now() + 60_000);

  await sql`
    INSERT INTO lembretes_agendados
      (tipo, referencia_tipo, referencia_id, cliente_id, cliente_nome,
       destinatario_tipo, destinatario_telefone, destinatario_nome,
       mensagem, enviar_em)
    VALUES
      ('honorario_pago_confirmacao', 'lancamento', ${opts.lancamentoId}::uuid,
       ${opts.clienteId}::uuid, ${opts.clienteNome},
       'cliente', ${opts.telefone}, ${opts.clienteNome},
       ${mensagem}, ${enviarEm.toISOString()})
  `;
}
