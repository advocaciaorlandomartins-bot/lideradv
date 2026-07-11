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
  /** Link do Google Meet. Omitir para ligação direta pelo WhatsApp. */
  link?: string;
  tipoReuniao?: "meet" | "whatsapp";
  escritorio?: string;
}): Promise<void> {
  const cfg = await getMensagensConfig();
  const isMeet = (opts.tipoReuniao ?? "meet") === "meet";

  const vars = {
    nome: primeiroNome(opts.clienteNome),
    escritorio: opts.escritorio ?? "nosso escritório",
    diaSemana: formatarDiaSemana(opts.dataEvento),
    data: formatarData(opts.dataEvento),
    hora: opts.horaEvento,
    link: opts.link ?? "",
  };

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

  for (const lembrete of lembretes) {
    if (lembrete.enviarEm <= agora) continue;

    const mensagem = renderMensagem(lembrete.template, vars);

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
