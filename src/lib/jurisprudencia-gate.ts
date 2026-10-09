import { listarPrecedentes, type Precedente } from "./jurisprudencia-db";

export interface PrecedenteDetectado {
  trechoDetectado: string; // como apareceu no texto, ex.: "Tema 995"
  trechoOriginal: string; // janela de contexto ao redor
}

export interface RelatorioJurisprudencia {
  verificados: (PrecedenteDetectado & {
    tribunal: string;
    identificacao: string;
    status: Precedente["status"];
  })[];
  // menciona um Tema/Súmula/RE/RCL/ADI/ADPF/Enunciado que não bate com
  // NENHUM precedente da Jurisprudência Viva — cobertura ainda é parcial
  // (só B87/B88/B80), então isso NÃO prova que está errado, só que não dá
  // pra confirmar com o que já foi verificado.
  naoEncontrados: PrecedenteDetectado[];
}

// Padrões de citação de jurisprudência mais comuns em petição previdenciária
// — cada um captura só o tipo+número, sem tribunal (o tribunal nem sempre
// aparece junto no texto; o match contra `identificacao` é por substring,
// não por tribunal exato).
const PADROES_JURISPRUDENCIA: RegExp[] = [
  /Tema\s+\d+/gi,
  /S[úu]mula\s+\d+/gi,
  /Enunciado\s+\d+/gi,
  /RE\s+[\d.]+(?:\/[A-Z]{2})?/gi,
  /RCL\s+[\d.]+(?:\/[A-Z]{2})?/gi,
  /ADI\s+[\d.]+/gi,
  /ADPF\s+[\d.]+/gi,
  /ARE\s+[\d.]+/gi,
];

function normalizarIdentificacao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesmo espírito do Citation Gate, mas pra jurisprudência: confere se um
 * Tema/Súmula/RE/RCL/ADI/ADPF citado no texto bate com algum precedente
 * verificado na Jurisprudência Viva. Cobertura deliberadamente parcial (só
 * B87/B88/B80, ver seed-jurisprudencia-viva.ts) — "não encontrado" aqui
 * significa "não confirmado ainda", não "está errado". */
export async function verificarJurisprudencia(
  texto: string
): Promise<RelatorioJurisprudencia> {
  const precedentes = await listarPrecedentes();
  const relatorio: RelatorioJurisprudencia = {
    verificados: [],
    naoEncontrados: [],
  };

  const jaProcessados = new Set<string>();

  for (const padrao of PADROES_JURISPRUDENCIA) {
    let match: RegExpExecArray | null;
    while ((match = padrao.exec(texto)) !== null) {
      const trechoDetectado = match[0].trim();
      const chave = normalizarIdentificacao(trechoDetectado);
      if (jaProcessados.has(chave)) continue;
      jaProcessados.add(chave);

      const inicio = Math.max(0, match.index - 80);
      const fim = Math.min(
        texto.length,
        match.index + trechoDetectado.length + 80
      );
      const trechoOriginal = texto.slice(inicio, fim);

      const encontrado = precedentes.find((p) =>
        normalizarIdentificacao(p.identificacao).includes(chave)
      );

      if (encontrado) {
        relatorio.verificados.push({
          trechoDetectado,
          trechoOriginal,
          tribunal: encontrado.tribunal,
          identificacao: encontrado.identificacao,
          status: encontrado.status,
        });
      } else {
        relatorio.naoEncontrados.push({ trechoDetectado, trechoOriginal });
      }
    }
  }

  return relatorio;
}
