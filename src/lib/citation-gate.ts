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
  "Lei 13.146/2015": [
    "lei 13.146/2015",
    "lei 13.146/15",
    "lei n[ºo°]?\\s*13\\.146,?\\s*de\\s*2015",
    "estatuto da pessoa com defici[êe]ncia",
  ],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normaliza "art. 20, §4º" / "artigo 20, parágrafo 4º" / "art. 15, II" /
 * "art. 20 § 4o" / "art. 2º, §1º, I" pro(s) mesmo(s) formato(s) usado(s) em
 * dispositivos.caminho. Recebe a posição da menção da norma dentro da
 * janela e escolhe a ocorrência de "art." MAIS PRÓXIMA dela (podendo vir
 * antes ou depois no texto) — uma janela com duas leis diferentes perto uma
 * da outra (ex.: "art. 20 da LOAS... art. 15 da Lei 8.213") não pode pegar
 * o artigo errado só porque apareceu primeiro na string.
 *
 * Retorna uma lista de candidatos do MAIS pro MENOS específico (ex.:
 * ["art. 2, § 1º, I", "art. 2, § 1º", "art. 2"]) — alguns dispositivos
 * foram seedados no nível de inciso dentro do parágrafo, outros só no
 * nível do parágrafo inteiro; sem isso, citar "art. 2º, §1º, I" nunca bate
 * com um dispositivo seedado como "art. 2, § 1º, I" OU como "art. 2, § 1º"
 * dependendo de como a base foi montada. Retorna [] se não achar artigo. */
function candidatosCaminho(trecho: string, posicaoNorma: number): string[] {
  // [ºo°]? depois do número consome o ordinal de "art. 2º" — sem isso, o
  // "º" sobra no início de depoisDoArtigo (abaixo) e quebra o paragMatch/
  // incisoMatch/caputMatch, que esperam começar com vírgula/espaço. "s?"
  // depois de "art"/"artigo" cobre o plural ("arts. 57 e 58 da Lei
  // 8.213/91") — sem isso o "s" antes do "." quebrava o match inteiro e a
  // citação não aparecia no relatório (nem verificada nem não encontrada,
  // simplesmente ignorada).
  const todosArtMatches = [
    ...trecho.matchAll(/art(?:igo)?s?\.?\s*(\d+)\s*[ºo°]?(-[A-Z])?/gi),
  ];
  if (todosArtMatches.length === 0) return [];

  const artMatch = todosArtMatches.reduce((maisPerto, atual) => {
    const distAtual = Math.abs((atual.index ?? 0) - posicaoNorma);
    const distMaisPerto = Math.abs((maisPerto.index ?? 0) - posicaoNorma);
    return distAtual < distMaisPerto ? atual : maisPerto;
  });

  const artigoNum = artMatch[1];
  const sufixoArtigo = artMatch[2] ? artMatch[2].toUpperCase() : "";
  const base = `art. ${artigoNum}${sufixoArtigo}`;

  const depoisDoArtigo = trecho.slice(
    (artMatch.index ?? 0) + artMatch[0].length,
    (artMatch.index ?? 0) + artMatch[0].length + 40
  );

  // "parágrafo único" / "§ único" — forma sem número, usada quando o
  // artigo só tem um parágrafo. Checado ANTES do § numerado porque
  // "parágrafo" sem dígito nenhum não bate com a captura \d+ abaixo e
  // ficava invisível (caminho nunca incluía ", parágrafo único").
  const paragUnicoMatch = /^[,\s]*(?:§\s*|par[áa]grafo\s*)[úu]nico\b/i.test(
    depoisDoArtigo
  );
  // § com ou sem número de sub-letra (ex.: "§ 2º-A")
  const paragMatch = depoisDoArtigo.match(
    /^[,\s]*(?:§\s*(\d+)\s*[ºo°]?\s*(-[A-Z])?|par[áa]grafo\s*(\d+)\s*[ºo°]?)/i
  );
  // "art. 15, inciso II" OU a forma mais comum na prática, "art. 15, II"
  // (vírgula + numeral romano, sem a palavra "inciso")
  const incisoRe = /^[,\s]*(?:inciso\s+)?([IVX]{1,4})\b/i;
  const incisoMatch = depoisDoArtigo.match(incisoRe);
  const caputMatch = /^[,\s]*caput\b/i.test(depoisDoArtigo);

  const candidatos: string[] = [];
  if (paragUnicoMatch) {
    candidatos.push(`${base}, parágrafo único`);
  } else if (paragMatch) {
    const num = paragMatch[1] ?? paragMatch[3];
    const sufixoParag = paragMatch[2] ? paragMatch[2].toUpperCase() : "";
    const paragStr = `, § ${num}º${sufixoParag}`;
    // Inciso DENTRO do parágrafo citado (ex.: "art. 2º, §1º, I") — tenta o
    // caminho de 3 níveis primeiro, antes de cair pro parágrafo inteiro.
    const incisoDoParag = depoisDoArtigo
      .slice(paragMatch[0].length)
      .match(incisoRe);
    if (incisoDoParag) {
      candidatos.push(`${base}${paragStr}, ${incisoDoParag[1].toUpperCase()}`);
    }
    candidatos.push(`${base}${paragStr}`);
    // Alguns parágrafos têm caput próprio seguido de incisos (ex.: "art. 2,
    // § 1º, caput" + "art. 2, § 1º, I"..) — citar só "art. 2º, §1º" sem
    // apontar inciso deve também achar o caput do parágrafo.
    candidatos.push(`${base}${paragStr}, caput`);
  } else if (incisoMatch) {
    candidatos.push(`${base}, ${incisoMatch[1].toUpperCase()}`);
  } else if (caputMatch) {
    candidatos.push(`${base}, caput`);
  }
  candidatos.push(base);
  return candidatos;
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
      const candidatos = candidatosCaminho(janela, posicaoNormaNaJanela);
      if (candidatos.length === 0) continue; // menciona a norma mas sem artigo específico — nada a verificar

      // Caminho mais específico é o que entra no relatório (é o que o
      // texto realmente parece citar); os outros candidatos são só
      // tentativas de achar o dispositivo com granularidade diferente da
      // que foi seedada (ex.: citou o inciso, mas só o parágrafo inteiro
      // está salvo, ou vice-versa).
      const caminho = candidatos[0];
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
      // ", caput" (ver seed-base-legal*.ts) — inclui as duas formas como
      // candidato extra antes de marcar como não encontrada.
      const candidatosComFallback = [...candidatos];
      if (/^art\. \d+(-[A-Z])?$/.test(caminho)) {
        candidatosComFallback.push(`${caminho}, caput`);
      }
      if (caminho.endsWith(", caput")) {
        candidatosComFallback.push(caminho.replace(", caput", ""));
      }

      let dispositivo = null;
      for (const c of candidatosComFallback) {
        dispositivo = await getDispositivo(norma, c);
        if (dispositivo) break;
      }

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
