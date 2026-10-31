import "server-only";
import sql from "./db";
import { enviarMensagemDireta } from "./prevbot-outbound";

/**
 * Aviso ativo (WhatsApp) quando algo é atribuído a um colaborador — hoje
 * criar uma tarefa só a coloca em "Minhas Tarefas" de forma passiva, sem
 * avisar ninguém; pedido do Orlando (2026-10-31) pra poder, como admin,
 * escolher entre deixar só no sistema ou mandar avisar na hora. Reusado
 * também pelo cron de atraso e pela criação automática de tarefa urgente
 * do Cérebro Jurídico, pra não duplicar a lógica de "achar o telefone e
 * mandar" em cada lugar que precisa avisar um colaborador.
 */
export async function avisarResponsavelTarefa(opts: {
  responsavelNome: string;
  titulo: string;
  prazoFormatado?: string | null;
  prioridade?: string | null;
  clienteNome?: string | null;
  processoNumero?: string | null;
  origem?: string;
}): Promise<boolean> {
  const [col] = await sql`
    SELECT telefone FROM colaboradores
    WHERE nome = ${opts.responsavelNome} AND status = 'ativo'
    LIMIT 1
  `.catch(() => [] as { telefone: string | null }[]);
  const telefone = col?.telefone ? String(col.telefone) : null;
  if (!telefone) return false;

  const prioridadeIcone =
    opts.prioridade === "Alta"
      ? "🔴"
      : opts.prioridade === "Baixa"
        ? "⚪"
        : "🟡";
  const linhaCliente = opts.clienteNome ? `\n👤 ${opts.clienteNome}` : "";
  const linhaProcesso = opts.processoNumero
    ? `\n📁 ${opts.processoNumero}`
    : "";
  const linhaPrazo = opts.prazoFormatado
    ? `\n📅 Prazo: ${opts.prazoFormatado}`
    : "";
  const linhaOrigem = opts.origem ? `\n_${opts.origem}_` : "";

  const mensagem =
    `${prioridadeIcone} *Nova tarefa atribuída a você*\n\n` +
    `*${opts.titulo}*${linhaCliente}${linhaProcesso}${linhaPrazo}\n\n` +
    `_Acesse Minhas Tarefas no LiderAdv para ver os detalhes._${linhaOrigem}`;

  const res = await enviarMensagemDireta({ telefone, mensagem }).catch(() => ({
    ok: false,
  }));
  return res.ok;
}

/**
 * Mesmo aviso, mas pra "ficou atrasada" (prazo passou) em vez de "criada
 * agora" — texto e ícone diferentes pra não confundir os dois motivos.
 */
export async function avisarResponsavelTarefaAtrasada(opts: {
  responsavelNome: string;
  titulo: string;
  prazoFormatado: string;
  clienteNome?: string | null;
  processoNumero?: string | null;
}): Promise<boolean> {
  const [col] = await sql`
    SELECT telefone FROM colaboradores
    WHERE nome = ${opts.responsavelNome} AND status = 'ativo'
    LIMIT 1
  `.catch(() => [] as { telefone: string | null }[]);
  const telefone = col?.telefone ? String(col.telefone) : null;
  if (!telefone) return false;

  const linhaCliente = opts.clienteNome ? `\n👤 ${opts.clienteNome}` : "";
  const linhaProcesso = opts.processoNumero
    ? `\n📁 ${opts.processoNumero}`
    : "";

  const mensagem =
    `⏰ *Tarefa atrasada*\n\n` +
    `*${opts.titulo}*${linhaCliente}${linhaProcesso}\n` +
    `📅 Prazo era ${opts.prazoFormatado}\n\n` +
    `_Acesse Minhas Tarefas no LiderAdv pra resolver ou ajustar o prazo._`;

  const res = await enviarMensagemDireta({ telefone, mensagem }).catch(() => ({
    ok: false,
  }));
  return res.ok;
}
