import { getDispositivo, listarNormasCadastradas } from "./base-legal-db";

export interface CitacaoDetectada {
  normaDetectada: string; // como apareceu no texto (ex.: "Lei 8.742/93")
  norma: string; // normalizado pra bater com fontes_legais.norma
  caminho: string; // normalizado pra bater com dispositivos.caminho
  trechoOriginal: string;
}

export interface RelatorioCitacoes {
  verificadas: (CitacaoDetectada & { textoDispositivo: string })[];
  // citou um artigo/parágrafo que NÃO existe na Base Legal Viva pra essa
  // norma, apesar de termos a norma cadastrada — sinal forte de erro real.
  naoEncontradas: CitacaoDetectada[];
  // citou uma norma que ainda não está na Base Legal Viva — não é
  // necessariamente erro, só não dá pra confirmar ainda.
  naoCobertas: CitacaoDetectada[];
}

// Apelidos/variações de grafia pra cada norma que já temos na Base Legal
// Viva. Mantido manual (não é um parser de referência jurídica genérico) —
// cobre as formas mais comuns que o modelo usa em petições.
const VARIACOES_NORMA: Record<string, string[]> = {
  "Lei 8.742/1993": [
    "lei 8.742/1993",
    "lei 8.742/93",
    "lei n[ºo°]?\\s*8\\.742,?\\s*de\\s*1993",
    "lei n[ºo°]?\\s*8\\.742/93",
    "loas",
  ],
  // Normas abaixo ainda NÃO têm dispositivos cadastrados — mantidas aqui só
  // pra reconhecer a citação e reportar em `naoCobertas` (sinaliza que a
  // Base Legal Viva ainda não cobre, em vez de ficar invisível ao gate).
  // Quando forem seedadas (próximo passo), passam a ser verificadas também.
  "Lei 8.213/1991": [
    "lei 8.213/1991",
    "lei 8.213/91",
    "lei n[ºo°]?\\s*8\\.213,?\\s*de\\s*1991",
    "lei n[ºo°]?\\s*8\\.213/91",
  ],
  "Decreto 3.048/1999": [
    "decreto 3.048/1999",
    "decreto 3.048/99",
    "decreto n[ºo°]?\\s*3\\.048,?\\s*de\\s*1999",
  ],
  "EC 103/2019": [
    "emenda constitucional\\s*n[ºo°]?\\s*103",
    "ec\\s*103/2019",
    "ec\\s*n[ºo°]?\\s*103",
  ],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normaliza "art. 20, §4º" / "artigo 20, parágrafo 4º" / "art. 15, II" /
 * "art. 20 § 4o" pro mesmo formato usado em dispositivos.caminho. Recebe a
 * posição da menção da norma dentro da janela e escolhe a ocorrência de
 * "art." MAIS PRÓXIMA dela (podendo vir antes ou depois no texto) — uma
 * janela com duas leis diferentes perto uma da outra (ex.: "art. 20 da
 * LOAS... art. 15 da Lei 8.213") não pode pegar o artigo errado só porque
 * apareceu primeiro na string. Retorna null se não achar nenhum artigo. */
function normalizarCaminho(
  trecho: string,
  posicaoNorma: number
): string | null {
  const todosArtMatches = [
    ...trecho.matchAll(/art(?:igo)?\.?\s*(\d+)(-[A-Z])?/gi),
  ];
  if (todosArtMatches.length === 0) return null;

  const artMatch = todosArtMatches.reduce((maisPerto, atual) => {
    const distAtual = Math.abs((atual.index ?? 0) - posicaoNorma);
    const distMaisPerto = Math.abs((maisPerto.index ?? 0) - posicaoNorma);
    return distAtual < distMaisPerto ? atual : maisPerto;
  });

  const artigoNum = artMatch[1];
  const sufixoArtigo = artMatch[2] ? artMatch[2].toUpperCase() : "";

  const depoisDoArtigo = trecho.slice(
    (artMatch.index ?? 0) + artMatch[0].length,
    (artMatch.index ?? 0) + artMatch[0].length + 40
  );

  // § com ou sem número de sub-letra (ex.: "§ 2º-A")
  const paragMatch = depoisDoArtigo.match(
    /^[,\s]*(?:§\s*(\d+)\s*[ºo°]?\s*(-[A-Z])?|par[áa]grafo\s*(\d+)\s*[ºo°]?)/i
  );
  // "art. 15, inciso II" OU a forma mais comum na prática, "art. 15, II"
  // (vírgula + numeral romano, sem a palavra "inciso")
  const incisoMatch = depoisDoArtigo.match(
    /^[,\s]*(?:inciso\s+)?([IVX]{1,4})\b/i
  );
  const caputMatch = /^[,\s]*caput\b/i.test(depoisDoArtigo);

  let caminho = `art. ${artigoNum}${sufixoArtigo}`;
  if (paragMatch) {
    const num = paragMatch[1] ?? paragMatch[3];
    const sufixoParag = paragMatch[2] ? paragMatch[2].toUpperCase() : "";
    caminho += `, § ${num}º${sufixoParag}`;
  } else if (incisoMatch) {
    caminho += `, ${incisoMatch[1].toUpperCase()}`;
  } else if (caputMatch) {
    caminho += ", caput";
  }
  return caminho;
}

/** Varre o texto gerado procurando citações de artigo/parágrafo associadas a
 * uma norma que já está (ou não) na Base Legal Viva, e verifica cada uma
 * contra `dispositivos`. Best-effort: cobre só as normas com variações
 * cadastradas em VARIACOES_NORMA — citação de lei sem forma reconhecida
 * aqui simplesmente não aparece no relatório (não gera falso alarme, mas
 * também não dá cobertura total — ver docs/auditoria-tecnica.md). */
export async function verificarCitacoesLegais(
  texto: string
): Promise<RelatorioCitacoes> {
  const relatorio: RelatorioCitacoes = {
    verificadas: [],
    naoEncontradas: [],
    naoCobertas: [],
  };

  const normasCadastradas = new Set(
    (await listarNormasCadastradas()).map((n) => n.norma)
  );

  for (const [norma, variacoes] of Object.entries(VARIACOES_NORMA)) {
    const regexNorma = new RegExp(
      variacoes.map((v) => (v.includes("\\") ? v : escapeRegex(v))).join("|"),
      "gi"
    );
    let match: RegExpExecArray | null;
    while ((match = regexNorma.exec(texto)) !== null) {
      // Janela de ~250 caracteres ao redor da menção da norma — onde o
      // artigo/parágrafo citado normalmente aparece na mesma frase.
      const inicio = Math.max(0, match.index - 150);
      const fim = Math.min(texto.length, match.index + match[0].length + 150);
      const janela = texto.slice(inicio, fim);
      const posicaoNormaNaJanela = match.index - inicio;
      const caminho = normalizarCaminho(janela, posicaoNormaNaJanela);
      if (!caminho) continue; // menciona a norma mas sem artigo específico — nada a verificar

      const citacao: CitacaoDetectada = {
        normaDetectada: match[0],
        norma,
        caminho,
        trechoOriginal: janela.trim(),
      };

      if (!normasCadastradas.has(norma)) {
        relatorio.naoCobertas.push(citacao);
        continue;
      }

      // "art. N" sem sub-parte normalmente se refere ao caput, mas um
      // artigo sem parágrafo nenhum às vezes é seedado sem o sufixo
      // ", caput" (ver seed-base-legal*.ts) — tenta as duas formas nos dois
      // sentidos antes de marcar como não encontrada.
      const ehArtigoSemSubparte = /^art\. \d+[A-Z]?$/.test(caminho);
      const dispositivo =
        (await getDispositivo(norma, caminho)) ??
        (ehArtigoSemSubparte
          ? await getDispositivo(norma, `${caminho}, caput`)
          : caminho.endsWith(", caput")
            ? await getDispositivo(norma, caminho.replace(", caput", ""))
            : null);
      if (dispositivo) {
        // Evita duplicar a mesma citação já verificada nesta mesma passada
        if (
          !relatorio.verificadas.some(
            (c) => c.norma === norma && c.caminho === caminho
          )
        ) {
          relatorio.verificadas.push({
            ...citacao,
            textoDispositivo: dispositivo.texto,
          });
        }
      } else {
        relatorio.naoEncontradas.push(citacao);
      }
    }
  }

  return relatorio;
}
