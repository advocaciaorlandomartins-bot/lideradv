/**
 * Deriva a "próxima ação" de um processo a partir do estágio e resultados já
 * existentes (estagio_producao, resultado_administrativo, resultado_judicial,
 * protocolo_inss) — sem exigir que alguém crie uma tarefa manual para isso.
 * Usado em Minhas Tarefas e no detalhe do processo para deixar claro, sempre,
 * em que pé o caso está e o que falta fazer: cliente → documentos →
 * direcionado ao responsável → deu entrada/pendente → resultado → justiça.
 */

export interface ProximaAcaoProcesso {
  label: string;
  urgente: boolean;
}

export interface ProcessoFaseInput {
  estagio_producao: string | null;
  resultado_administrativo: string | null;
  resultado_judicial: string | null;
  protocolo_inss?: string | null;
  data_distribuicao?: string | null;
}

export function getProximaAcaoProcesso(
  p: ProcessoFaseInput
): ProximaAcaoProcesso | null {
  const estagio = p.estagio_producao;
  if (!estagio || estagio === "arquivado") return null;

  // INSS indeferiu e o caso ainda não foi direcionado à justiça — ação urgente.
  if (p.resultado_administrativo === "negado" && estagio !== "judicial") {
    return {
      label: "INSS indeferiu — ingressar com ação judicial",
      urgente: true,
    };
  }

  if (estagio === "analise") {
    return {
      label: "Reunir e conferir documentos do cliente",
      urgente: false,
    };
  }

  if (estagio === "producao") {
    return { label: "Preparar requerimento/petição inicial", urgente: false };
  }

  if (estagio === "administrativo") {
    if (!p.protocolo_inss) {
      return {
        label: "Dar entrada no requerimento administrativo (INSS)",
        urgente: true,
      };
    }
    if (!p.resultado_administrativo) {
      return { label: "Aguardando resultado do INSS", urgente: false };
    }
    // Só chega aqui com "concedido" — "negado" já foi tratado acima.
    return {
      label: "Benefício concedido — providenciar encerramento",
      urgente: false,
    };
  }

  if (estagio === "judicial") {
    if (!p.data_distribuicao) {
      return {
        label: "Ingressar com a ação judicial (registrar distribuição)",
        urgente: true,
      };
    }
    if (!p.resultado_judicial) {
      return { label: "Aguardando resultado da ação judicial", urgente: false };
    }
    return {
      label: "Processo julgado — providenciar encerramento",
      urgente: false,
    };
  }

  return null;
}
