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

/** Normaliza "art. 20, §4º" / "artigo 20, parágrafo 4º" / "art. 20 § 4o" pro
 * mesmo formato usado em dispositivos.caminho ("art. 20, § 4º"). Retorna
 * null se não achar um padrão de artigo reconhecível. */
function normalizarCaminho(trecho: string): string | null {
  const artMatch = trecho.match(/art(?:igo)?\.?\s*(\d+)(-[A-Z])?/i);
  if (!artMatch) return null;
  const artigoNum = artMatch[1];
  const sufixoArtigo = artMatch[2] ? artMatch[2].toUpperCase() : "";

  // § com ou sem número de sub-letra (ex.: "§ 2º-A")
  const paragMatch = trecho.match(
    /§\s*(\d+)\s*[ºo°]?\s*(-[A-Z])?|par[áa]grafo\s*(\d+)\s*[ºo°]?/i
  );
  const incisoMatch = trecho.match(/inciso\s+([IVX]+)\b/i);
  const caputMatch = /\bcaput\b/i.test(trecho);

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
      const caminho = normalizarCaminho(janela);
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

      const dispositivo = await getDispositivo(norma, caminho);
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
