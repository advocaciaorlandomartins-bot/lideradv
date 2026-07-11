/**
 * CONFIGURAÇÃO DE MENSAGENS AUTOMÁTICAS — LIDERADV
 *
 * Os textos e intervalos agora são editáveis diretamente no painel em
 * Configurações → Mensagens Automáticas.
 *
 * Este arquivo exporta os valores PADRÃO usados como fallback.
 * Tokens disponíveis nos templates:
 *   {{nome}}       — Primeiro nome do destinatário
 *   {{escritorio}} — Nome do escritório
 *   {{servico}}    — Tipo do serviço
 *   {{diaSemana}}  — Dia da semana (segunda-feira...)
 *   {{data}}       — Data (dd/mm/aaaa)
 *   {{hora}}       — Horário (09:00)
 *   {{local}}      — Local do atendimento
 *   {{valor}}      — Valor em R$
 *   {{saldo}}      — Saldo restante em R$
 */

export function renderMensagem(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// ── Tipo completo da config (usada no DB e no formulário) ─────────────────────

export interface MensagensConfig {
  // INSS — intervalos
  inss_lembrete1_dias: number;
  inss_lembrete2_dias: number;
  inss_lembrete3_dias: number;
  inss_vespera_manha_hora: number;
  inss_vespera_tarde_hora: number;
  // INSS — templates
  inss_lembrete1: string;
  inss_lembrete2: string;
  inss_lembrete3: string;
  inss_vespera_manha: string;
  inss_vespera_tarde: string;
  // Honorário — intervalos
  honorario_lembrete1_dias: number;
  honorario_lembrete2_dias: number;
  honorario_lembrete3_dias: number;
  honorario_vencimento_hoje_hora: number;
  // Honorário — templates
  honorario_lembrete1: string;
  honorario_lembrete2: string;
  honorario_lembrete3: string;
  honorario_vence_hoje: string;
  honorario_pagamento_quitado: string;
  honorario_pagamento_parcial: string;
  // Videochamada — horários dos lembretes
  videochamada_vespera_hora: number;
  videochamada_dia_hora: number;
  // Videochamada Google Meet — templates (usa {{link}})
  videochamada_convite: string;
  videochamada_vespera: string;
  videochamada_dia: string;
  // Ligação WhatsApp — templates (sem {{link}})
  wpp_call_convite: string;
  wpp_call_vespera: string;
  wpp_call_dia: string;
}

// ── Valores padrão (usados se o DB ainda não tiver customizações) ─────────────

export const MENSAGENS_PADROES: MensagensConfig = {
  inss_lembrete1_dias: 15,
  inss_lembrete2_dias: 5,
  inss_lembrete3_dias: 2,
  inss_vespera_manha_hora: 8,
  inss_vespera_tarde_hora: 18,

  inss_lembrete1: `Oi {{nome}}! 👋 Aqui é do {{escritorio}}. Passando pra avisar que seu {{servico}} está marcado para {{diaSemana}}, dia {{data}} às {{hora}}, em {{local}}.\n\nFaltam 15 dias — já é uma boa hora pra ir se organizando com documentos e transporte. Se precisar de ajuda ou tiver dúvidas, é só chamar. Estamos contigo! 😊`,

  inss_lembrete2: `Olá {{nome}}! Lembrando que seu {{servico}} no INSS está chegando — {{diaSemana}}, {{data}} às {{hora}}, em {{local}}.\n\nFaltam só 5 dias! Aproveite pra separar documentos: RG, CPF, Certidão de Nascimento e qualquer documentação médica ou social que tiver. Qualquer dúvida, o {{escritorio}} está à disposição! 💪`,

  inss_lembrete3: `Oi {{nome}}! Seu {{servico}} é daqui a 2 dias — {{diaSemana}}, {{data}} às {{hora}}.\n\n📍 Local: {{local}}\n\nAproveite para confirmar como vai chegar lá e já deixar os documentos separadinhos. Se precisar de algo, é só falar com a gente!`,

  inss_vespera_manha: `Bom dia, {{nome}}! 🌅 Amanhã é o grande dia! Seu {{servico}} está marcado para:\n\n📅 {{data}} ({{diaSemana}})\n⏰ {{hora}}\n📍 {{local}}\n\nLembre de chegar 15 minutos antes e trazer RG, CPF e qualquer documentação médica ou social. Boa sorte — estamos torcendo por você! 🍀`,

  inss_vespera_tarde: `Boa tarde, {{nome}}! Só passando pra reforçar: amanhã cedo é seu {{servico}} no INSS às {{hora}}.\n\n📍 {{local}}\n\nJá separou os documentos? Qualquer dúvida de última hora, pode chamar o {{escritorio}} que a gente te ajuda! 😊`,

  honorario_lembrete1_dias: 10,
  honorario_lembrete2_dias: 5,
  honorario_lembrete3_dias: 1,
  honorario_vencimento_hoje_hora: 8,

  honorario_lembrete1: `Olá {{nome}}! Passando pra lembrar que seu honorário no valor de *{{valor}}* vence em *{{data}}* (faltam 10 dias).\n\nSe já realizou o pagamento, pode desconsiderar esta mensagem. Qualquer dúvida, pode falar com o {{escritorio}}! 😊`,

  honorario_lembrete2: `Oi {{nome}}! Sua cobrança de honorários de *{{valor}}* vence em *{{data}}* — faltam apenas 5 dias.\n\nSe ainda não realizou o pagamento, é uma boa hora pra se organizar. Caso já tenha pago, desconsidere esta mensagem. Obrigado! 🙏`,

  honorario_lembrete3: `Olá {{nome}}! Amanhã, dia *{{data}}*, vence seu honorário de *{{valor}}*.\n\nPedimos que regularize até amanhã para evitar atrasos. Se já pagou, pode desconsiderar esta mensagem. Qualquer dúvida estamos disponíveis! 😊`,

  honorario_vence_hoje: `Oi {{nome}}! Hoje é o dia do vencimento do seu honorário de *{{valor}}*.\n\nPor favor, realize o pagamento para evitar pendências. Se já pagou, desconsidere esta mensagem — e muito obrigado pela pontualidade! 🙏`,

  honorario_pagamento_quitado: `✅ {{nome}}, confirmamos o recebimento do seu pagamento de *{{valor}}* em {{data}}.\n\nSua conta está totalmente quitada! Muito obrigado pela confiança e pontualidade! 🎉`,

  honorario_pagamento_parcial: `✅ {{nome}}, confirmamos o recebimento do seu pagamento de *{{valor}}* em {{data}}.\n\nSeu saldo restante é de *{{saldo}}*. Em breve você receberá os próximos lembretes de vencimento. Qualquer dúvida, estamos à disposição! 😊`,

  // ── Videochamada ─────────────────────────────────────────────────────────────

  videochamada_vespera_hora: 18,
  videochamada_dia_hora: 8,

  videochamada_convite: `Olá {{nome}}! 👋 Aqui é do {{escritorio}}.\n\nGostaríamos de confirmar nossa *reunião por videochamada*:\n\n📅 {{diaSemana}}, {{data}}\n⏰ {{hora}}\n🔗 {{link}}\n\nPor favor, *confirme respondendo SIM* se esse horário está bom para você. Se precisar remarcar, é só falar com a gente! 😊`,

  videochamada_vespera: `Olá {{nome}}! Lembrando que amanhã temos nossa *reunião por videochamada* às *{{hora}}*.\n\n🔗 Link de acesso: {{link}}\n\nNos vemos amanhã! 😊`,

  videochamada_dia: `Bom dia, {{nome}}! 🌅 Hoje é o dia da nossa reunião — às *{{hora}}* estamos te esperando!\n\n🔗 Acesse pelo link: {{link}}\n\nAté já! 👋`,

  // ── Ligação WhatsApp (para clientes sem acesso a Meet) ────────────────────────

  wpp_call_convite: `Olá {{nome}}! 👋 Aqui é do {{escritorio}}.\n\nAgendamos uma *ligação pelo WhatsApp* com você:\n\n📅 {{diaSemana}}, {{data}}\n⏰ {{hora}}\n\nFique disponível no WhatsApp nesse horário — *vamos te ligar!* 📱\n\nPor favor, *confirme respondendo SIM* se esse horário está bom pra você. Se precisar remarcar, é só falar! 😊`,

  wpp_call_vespera: `Olá {{nome}}! Lembrando que amanhã às *{{hora}}* ligaremos para você pelo WhatsApp. 📱\n\nCertifique-se de estar com o WhatsApp aberto e disponível nesse horário. Nos vemos amanhã! 😊`,

  wpp_call_dia: `Bom dia, {{nome}}! 🌅 Hoje é o dia da nossa conversa. Ligaremos para você pelo WhatsApp às *{{hora}}*.\n\nFique disponível com o WhatsApp aberto! Até já! 👋`,
};

// ── Atalhos para intervalos (compatibilidade com código legado) ───────────────

export const INSS_INTERVALOS = {
  lembrete1_dias: MENSAGENS_PADROES.inss_lembrete1_dias,
  lembrete2_dias: MENSAGENS_PADROES.inss_lembrete2_dias,
  lembrete3_dias: MENSAGENS_PADROES.inss_lembrete3_dias,
  vespera_manha_hora: MENSAGENS_PADROES.inss_vespera_manha_hora,
  vespera_tarde_hora: MENSAGENS_PADROES.inss_vespera_tarde_hora,
};

export const HONORARIO_INTERVALOS = {
  lembrete1_dias: MENSAGENS_PADROES.honorario_lembrete1_dias,
  lembrete2_dias: MENSAGENS_PADROES.honorario_lembrete2_dias,
  lembrete3_dias: MENSAGENS_PADROES.honorario_lembrete3_dias,
  vencimento_hoje_hora: MENSAGENS_PADROES.honorario_vencimento_hoje_hora,
};

// ── Funções de template baseadas nos padrões (compatibilidade com código legado) ──

type InssVars = [string, string, string, string, string, string, string];
type HonVars = [string, string, string, string];

function inssRender(
  template: string,
  ...[nome, escritorio, servico, diaSemana, data, hora, local]: InssVars
) {
  return renderMensagem(template, {
    nome,
    escritorio,
    servico,
    diaSemana,
    data,
    hora,
    local,
  });
}
function honRender(
  template: string,
  ...[nome, escritorio, valor, data]: HonVars
) {
  return renderMensagem(template, { nome, escritorio, valor, data });
}

export const INSS_MENSAGENS = {
  lembrete1: (...a: InssVars) =>
    inssRender(MENSAGENS_PADROES.inss_lembrete1, ...a),
  lembrete2: (...a: InssVars) =>
    inssRender(MENSAGENS_PADROES.inss_lembrete2, ...a),
  lembrete3: (...a: InssVars) =>
    inssRender(MENSAGENS_PADROES.inss_lembrete3, ...a),
  vespera_manha: (...a: InssVars) =>
    inssRender(MENSAGENS_PADROES.inss_vespera_manha, ...a),
  vespera_tarde: (...a: InssVars) =>
    inssRender(MENSAGENS_PADROES.inss_vespera_tarde, ...a),
};

export const HONORARIO_MENSAGENS = {
  lembrete1: (...a: HonVars) =>
    honRender(MENSAGENS_PADROES.honorario_lembrete1, ...a),
  lembrete2: (...a: HonVars) =>
    honRender(MENSAGENS_PADROES.honorario_lembrete2, ...a),
  lembrete3: (...a: HonVars) =>
    honRender(MENSAGENS_PADROES.honorario_lembrete3, ...a),
  vence_hoje: (...a: HonVars) =>
    honRender(MENSAGENS_PADROES.honorario_vence_hoje, ...a),
  pagamento_quitado: (nome: string, valor: string, data: string) =>
    renderMensagem(MENSAGENS_PADROES.honorario_pagamento_quitado, {
      nome,
      valor,
      data,
    }),
  pagamento_parcial: (
    nome: string,
    valor: string,
    data: string,
    saldo: string
  ) =>
    renderMensagem(MENSAGENS_PADROES.honorario_pagamento_parcial, {
      nome,
      valor,
      data,
      saldo,
    }),
};
