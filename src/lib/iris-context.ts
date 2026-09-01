import sql from "./db";
import { getRanking } from "./pontuacao";
import {
  getCargaColaboradores,
  getCapacidadeProdutiva,
} from "./controladoria-db";
import { getAllColaboradores } from "./colaboradores-db";
import { hasPermission } from "./permissoes";
import { TIPOS_CONTROLE } from "./controles-types";
import type { SessionUser } from "./session";

const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_CONTROLE.map((t) => [t.key, t.label])
);

interface AgendaItem {
  origem: string;
  descricao: string;
  data: string;
  hora: string | null;
  clienteNome: string | null;
  prioridade: string | null;
}

/**
 * Agenda real do escritório nos próximos N dias — combina as DUAS fontes que
 * alimentam o calendário/Dashboard: "controles" (audiências, prazos,
 * perícias, DCB, benefícios, alvarás) e "compromissos" (reuniões, consultas,
 * videochamadas, fechamentos, criados em "Agendar Reunião" ou ao processar
 * documentos do INSS). Um bug real: a Íris só olhava "controles" e dizia
 * "nada agendado" quando na verdade havia uma consulta marcada — corrigido
 * aqui juntando as duas tabelas.
 */
async function getAgendaProxima(dias: number): Promise<AgendaItem[]> {
  const [controles, compromissos] = await Promise.all([
    sql`
      SELECT c.tipo, c.descricao, c.data_evento::text AS data, c.prioridade,
             cl.name AS cliente_nome
      FROM controles c
      LEFT JOIN clients cl ON cl.id = c.cliente_id
      WHERE c.status IS NULL
        AND c.data_evento IS NOT NULL
        AND c.data_evento BETWEEN CURRENT_DATE AND CURRENT_DATE + (${dias} || ' days')::interval
      ORDER BY c.data_evento ASC
      LIMIT 80
    `,
    sql`
      SELECT comp.titulo, comp.tipo, comp.data_inicio::text AS data,
             comp.hora_inicio::text AS hora, cl.name AS cliente_nome
      FROM compromissos comp
      LEFT JOIN clients cl ON cl.id = comp.cliente_id
      WHERE comp.status = 'pendente'
        AND comp.data_inicio BETWEEN CURRENT_DATE AND CURRENT_DATE + (${dias} || ' days')::interval
      ORDER BY comp.data_inicio ASC, comp.hora_inicio ASC NULLS LAST
      LIMIT 80
    `,
  ]);

  const COMPROMISSO_LABEL: Record<string, string> = {
    reuniao: "Reunião",
    videochamada: "Videochamada",
    fechamento: "Fechamento",
    consulta: "Consulta",
    outro: "Compromisso",
  };

  const itensControle: AgendaItem[] = controles.map((r) => ({
    origem: TIPO_LABEL[String(r.tipo)] ?? String(r.tipo),
    descricao: String(r.descricao),
    data: String(r.data),
    hora: null,
    clienteNome: r.cliente_nome ? String(r.cliente_nome) : null,
    prioridade: r.prioridade ? String(r.prioridade) : null,
  }));

  const itensCompromisso: AgendaItem[] = compromissos.map((r) => ({
    origem: COMPROMISSO_LABEL[String(r.tipo)] ?? "Compromisso",
    descricao: String(r.titulo),
    data: String(r.data),
    hora: r.hora ? String(r.hora).slice(0, 5) : null,
    clienteNome: r.cliente_nome ? String(r.cliente_nome) : null,
    prioridade: null,
  }));

  return [...itensControle, ...itensCompromisso].sort((a, b) =>
    a.data === b.data ? 0 : a.data < b.data ? -1 : 1
  );
}

/**
 * Snapshot textual dos dados reais do escritório, embutido no prompt da
 * Íris — mesma informação que já aparece nas telas do sistema (mesmos gates
 * de permissão: agenda exige "controles:ver", equipe exige
 * "colaboradores:ver" — sem isso, a seção some do contexto, pra Íris nunca
 * vazar dado que o usuário não teria acesso navegando pela tela normal), só
 * que em formato pra IA responder perguntas em linguagem natural sobre ela.
 * Sem tool-calling pra dados de leitura (mais barato, resposta mais rápida
 * pras perguntas mais comuns): busca tudo de uma vez antes da chamada,
 * suficiente pro volume de dados de um escritório.
 */
export async function buildIrisContextText(
  session: SessionUser
): Promise<string> {
  const podeVerControles = hasPermission(session, "controles", "ver");
  const podeVerColaboradores = hasPermission(session, "colaboradores", "ver");

  const [ranking30, carga, capacidade, agenda, colaboradores] =
    await Promise.all([
      getRanking(30),
      getCargaColaboradores(),
      getCapacidadeProdutiva(4),
      podeVerControles ? getAgendaProxima(30) : Promise.resolve(null),
      podeVerColaboradores ? getAllColaboradores() : Promise.resolve(null),
    ]);

  const rankingTxt =
    ranking30.length === 0
      ? "Sem dados de pontuação ainda."
      : ranking30
          .map(
            (r, i) =>
              `${i + 1}. ${r.nome} (${r.cargo}) — ${r.totalPontos} pontos, ${r.entregas} entregas`
          )
          .join("\n");

  const cargaTxt =
    carga.length === 0
      ? "Sem colaboradores ativos com itens abertos."
      : carga
          .map(
            (c) =>
              `${c.nome} (${c.cargo}): ${c.totalAbertas} abertas${c.totalVencidas > 0 ? `, ${c.totalVencidas} VENCIDAS` : ""}${c.proximoPrazo ? `, próximo prazo ${c.proximoPrazo}` : ""}`
          )
          .join("\n");

  const capacidadeTxt =
    capacidade.length === 0
      ? "Sem dados de capacidade produtiva ainda."
      : capacidade
          .map(
            (c) =>
              `Semana ${c.semana}: ${c.entraram} entraram, ${c.saidas} concluídas`
          )
          .join("\n");

  const agendaTxt =
    agenda === null
      ? "(sem acesso a agenda/audiências/prazos/compromissos com o perfil deste usuário)"
      : agenda.length === 0
        ? "Nada agendado nos próximos 30 dias (nem em Controles, nem em Compromissos)."
        : agenda
            .map(
              (a) =>
                `${a.data}${a.hora ? ` ${a.hora}` : ""} — ${a.origem}: ${a.descricao}${a.clienteNome ? ` (cliente: ${a.clienteNome})` : ""}${a.prioridade ? ` [prioridade ${a.prioridade}]` : ""}`
            )
            .join("\n");

  const colaboradoresTxt =
    colaboradores === null
      ? "(sem acesso à lista de colaboradores com o perfil deste usuário)"
      : colaboradores.length === 0
        ? "Nenhum colaborador cadastrado."
        : colaboradores
            .map(
              (c) =>
                `${c.nome} — ${c.cargo}${c.status === "inativo" ? " (INATIVO)" : ""}`
            )
            .join("\n");

  return `━━━ AGENDA — próximos 30 dias (Controles: audiências/prazos/perícias/DCB/benefícios/alvarás + Compromissos: reuniões/consultas/videochamadas/fechamentos) ━━━
${agendaTxt}

━━━ EQUIPE — colaboradores cadastrados ━━━
${colaboradoresTxt}

━━━ RANKING — pontuação (últimos 30 dias) ━━━
${rankingTxt}

━━━ CARGA DA EQUIPE — itens abertos agora ━━━
${cargaTxt}

━━━ CAPACIDADE PRODUTIVA — últimas 4 semanas ━━━
${capacidadeTxt}`;
}
