import sql from "./db";

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
  | "honorario_pago_confirmacao";

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
    inss_15d: `Oi ${nome}! 👋 Aqui é do ${escritorio}. Passando pra avisar que seu ${servico} está marcado para ${diaSemana}, dia ${data} às ${opts.hora}, em ${opts.local}.\n\nFaltam 15 dias — já é uma boa hora pra ir se organizando com documentos e transporte. Se precisar de ajuda ou tiver dúvidas, é só chamar. Estamos contigo! 😊`,

    inss_5d: `Olá ${nome}! Lembrando que seu ${servico} no INSS está chegando — ${diaSemana}, ${data} às ${opts.hora}, em ${opts.local}.\n\nFaltam só 5 dias! Aproveite pra separar documentos: RG, CPF, Certidão de Nascimento e qualquer documentação médica ou social que tiver. Qualquer dúvida, o ${escritorio} está à disposição! 💪`,

    inss_2d: `Oi ${nome}! Seu ${servico} é daqui a 2 dias — ${diaSemana}, ${data} às ${opts.hora}.\n\n📍 Local: ${opts.local}\n\nAproveite para confirmar como vai chegar lá e já deixar os documentos separadinhos. Se precisar de algo, é só falar com a gente!`,

    inss_1d_manha: `Bom dia, ${nome}! 🌅 Amanhã é o grande dia! Seu ${servico} está marcado para:\n\n📅 ${data} (${diaSemana})\n⏰ ${opts.hora}\n📍 ${opts.local}\n\nLembre de chegar 15 minutos antes e trazer RG, CPF e qualquer documentação médica ou social. Boa sorte — estamos torcendo por você! 🍀`,

    inss_1d_tarde: `Boa tarde, ${nome}! Só passando pra reforçar: amanhã cedo é seu ${servico} no INSS às ${opts.hora}.\n\n📍 ${opts.local}\n\nJá separou os documentos? Qualquer dúvida de última hora, pode chamar o ${escritorio} que a gente te ajuda! 😊`,
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
    honorario_10d: `Olá ${nome}! Passando pra lembrar que seu honorário no valor de *${valor}* vence em *${data}* (faltam 10 dias).\n\nSe já realizou o pagamento, pode desconsiderar esta mensagem. Qualquer dúvida, pode falar com o ${escritorio}! 😊`,

    honorario_5d: `Oi ${nome}! Sua cobrança de honorários de *${valor}* vence em *${data}* — faltam apenas 5 dias.\n\nSe ainda não realizou o pagamento, é uma boa hora pra se organizar. Caso já tenha pago, desconsidere esta mensagem. Obrigado! 🙏`,

    honorario_1d: `Olá ${nome}! Amanhã, dia *${data}*, vence seu honorário de *${valor}*.\n\nPedimos que regularize até amanhã para evitar atrasos. Se já pagou, pode desconsiderar esta mensagem. Qualquer dúvida estamos disponíveis! 😊`,

    honorario_vence_hoje: `Oi ${nome}! Hoje é o dia do vencimento do seu honorário de *${valor}*.\n\nPor favor, realize o pagamento para evitar pendências. Se já pagou, desconsidere esta mensagem — e muito obrigado pela pontualidade! 🙏`,
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
    return `✅ ${nome}, confirmamos o recebimento do seu pagamento de *${valorPago}* em ${data}.\n\nSua conta está totalmente quitada! Muito obrigado pela confiança e pontualidade! 🎉`;
  }

  const saldo = formatarMoeda(opts.saldoRestante);
  return `✅ ${nome}, confirmamos o recebimento do seu pagamento de *${valorPago}* em ${data}.\n\nSeu saldo restante é de *${saldo}*. Em breve você receberá os próximos lembretes de vencimento. Qualquer dúvida, estamos à disposição! 😊`;
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
    enviarEm: Date;
  }> = [
    { tipo: "inss_15d", enviarEm: diasAntes(opts.dataEvento, 15, 8) },
    { tipo: "inss_5d", enviarEm: diasAntes(opts.dataEvento, 5, 8) },
    { tipo: "inss_2d", enviarEm: diasAntes(opts.dataEvento, 2, 8) },
    { tipo: "inss_1d_manha", enviarEm: diasAntes(opts.dataEvento, 1, 8) },
    { tipo: "inss_1d_tarde", enviarEm: diasAntes(opts.dataEvento, 1, 18) },
  ];

  for (const dest of destinos) {
    for (const lembrete of tiposLembrete) {
      if (lembrete.enviarEm <= new Date()) continue; // não agenda passado

      const mensagem = mensagemInss({
        tipo: lembrete.tipo,
        nomeDestinatario: dest.nome,
        tipoServico: opts.tipoServico,
        dataEvento: opts.dataEvento,
        hora: opts.horaEvento,
        local: opts.local,
        protocolo: opts.protocolo,
        escritorio: opts.escritorio,
      });

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

  const tiposLembrete: Array<{
    tipo:
      | "honorario_10d"
      | "honorario_5d"
      | "honorario_1d"
      | "honorario_vence_hoje";
    enviarEm: Date;
  }> = [
    { tipo: "honorario_10d", enviarEm: diasAntes(opts.dataVencimento, 10, 8) },
    { tipo: "honorario_5d", enviarEm: diasAntes(opts.dataVencimento, 5, 8) },
    { tipo: "honorario_1d", enviarEm: diasAntes(opts.dataVencimento, 1, 8) },
    {
      tipo: "honorario_vence_hoje",
      enviarEm: mesmoDia(opts.dataVencimento, 8),
    },
  ];

  for (const lembrete of tiposLembrete) {
    if (lembrete.enviarEm <= new Date()) continue;

    const mensagem = mensagemHonorario({
      tipo: lembrete.tipo,
      nomeDestinatario: opts.clienteNome,
      valor: opts.valor,
      dataVencimento: opts.dataVencimento,
      descricao: opts.descricao,
      escritorio: opts.escritorio,
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

  const mensagem = mensagemPagamentoConfirmado({
    nomeDestinatario: opts.clienteNome,
    valorPago: opts.valorPago,
    dataPagamento: opts.dataPagamento,
    saldoRestante: opts.saldoRestante,
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
