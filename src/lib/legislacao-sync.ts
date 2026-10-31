import "server-only";
import sql from "./db";
import { listarDispositivosPorNorma } from "./base-legal-db";

/**
 * Escopo reduzido a pedido do Orlando (2026-10-08): só LOAS/BPC (idoso e
 * deficiência/autismo) e salário-maternidade — as demais aposentadorias e
 * benefícios da Base Legal Viva (EC 103/2019, período de graça/carência,
 * incapacidade, pensão por morte etc.) ficam de fora do sync automático
 * por ora. Lei 8.213/1991 cobre MUITOS benefícios diferentes — por isso
 * tem filtro de caminho (só arts. 71 a 73, a seção de salário-maternidade);
 * LOAS, a Lei do autismo e o art. 2º do Estatuto da PcD (definição de
 * deficiência, citada direto pela LOAS pro B87) são 100% sobre BPC/
 * deficiência, sem filtro — Lei 13.146/2015 adicionada em 2026-10-08
 * (testada contra o Planalto antes: 16/16 dispositivos bateram).
 */
const NORMAS_EM_ESCOPO: { norma: string; filtroCaminho?: RegExp }[] = [
  { norma: "Lei 8.742/1993" },
  { norma: "Lei 12.764/2012" },
  { norma: "Lei 13.146/2015" },
  { norma: "Lei 8.213/1991", filtroCaminho: /^art\. 7[1-3]/ },
];

/**
 * Dispositivos onde eu mesmo escrevi uma nota editorial (não é texto de
 * lei) em vez de transcrever — comparar contra o Planalto nunca vai bater
 * por definição, não é uma mudança de verdade.
 */
const TEXTO_PLACEHOLDER = "Sem redação própria vigente";

/**
 * Normalização tolerante a ruído de extração HTML do Planalto — depurada
 * contra os 71 dispositivos reais em escopo (2026-10-08), com 3 achados
 * que davam falso positivo de "mudou" sem ser mudança de verdade:
 *
 * 1. "º" vira " o " solto quando a tag <sup> ao redor é stripada (ex.:
 *    "§ 1º" vira "§ 1 o "), ou simplesmente some. Tratado com duas regras
 *    (uma pro "º" de verdade, outra pro resíduo "o").
 * 2. Itálico em palavras como "caput" deixa espaço solto antes de
 *    pontuação (ex.: "caput, a família" vira "caput , a família").
 * 3. MAIS SÉRIO: a regra do item 1 tinha que rodar ANTES do toLowerCase()
 *    e sem flag "i" — rodando depois e case-insensitive, ela comia o "O"
 *    maiúsculo de verdade que abre frase logo após um parágrafo numerado
 *    (ex.: "§ 4º O benefício..." virava "§4 benefício...", cortando a
 *    primeira palavra) porque não dava pra distinguir do resíduo
 *    minúsculo "o" do <sup>. Ordem/case importam aqui.
 */
function normalizar(texto: string): string {
  return texto
    .replace(
      /\((Inclu[ií]do|Acrescentado|Reda[çc][aã]o dada|Revogado|Vig[êe]ncia|Vide)[^)]*\)/gi,
      ""
    )
    .replace(/(\d)\s*º/g, "$1") // "º" real (ordinal indicator)
    .replace(/(\d)\s+o\b/g, "$1") // resíduo de <sup>o</sup> — sempre minúsculo na fonte, sem flag "i" de propósito
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+([,.;:)])/g, "$1") // espaço solto antes de pontuação
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, ""); // ponto final às vezes some quando a frase emenda direto numa anotação entre parênteses já removida acima
}

/**
 * Planalto costuma servir as páginas de lei em ISO-8859-1 sem declarar
 * charset no header — decodificar como UTF-8 vira "?" em todo acento
 * (confirmado buscando a Lei 12.764/2012 em 2026-10-08). Decodifica como
 * latin1 sempre, é o formato real dessas páginas.
 *
 * Abaixo de ~5.000 caracteres quase certamente não é o texto completo da
 * lei — a mais curta em escopo (Lei 12.764/2012, texto de autismo) já tem
 * ~9.500 caracteres de verdade (confirmado em 2026-10-31); uma resposta de
 * bloqueio/erro da fonte (rede, WAF, timeout no meio do download) costuma
 * vir bem menor que isso. Tentar de novo uma vez antes de desistir evita
 * que uma falha de rede passageira vire "todo mundo mudou" — achado real
 * em 2026-10-28→31: a comparação ficou 4 dias seguidos marcando ~84 de 86
 * dispositivos como alterados ao mesmo tempo em 4 leis sem relação,
 * enquanto o texto batia perfeito ao buscar a mesma URL de outra rede —
 * impossível ser mudança de lei de verdade, só podia ser a fonte vindo
 * incompleta pro ambiente de produção. Essa checagem de tamanho é só a
 * 1ª linha de defesa; a 2ª (mais confiável, não depende de adivinhar um
 * número) é o teste de plausibilidade logo abaixo em sincronizarNorma.
 */
const TAMANHO_MINIMO_PAGINA_VALIDA = 5_000;

async function buscarUmaVez(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  let html = buf.toString("latin1");
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function buscarTextoOficial(url: string): Promise<string | null> {
  try {
    const primeira = await buscarUmaVez(url);
    if (primeira && primeira.length >= TAMANHO_MINIMO_PAGINA_VALIDA)
      return primeira;
    // Resposta ausente ou suspeita de curta — espera um pouco e tenta de
    // novo antes de desistir (ver nota acima).
    await new Promise((r) => setTimeout(r, 3000));
    const segunda = await buscarUmaVez(url);
    if (segunda && segunda.length >= TAMANHO_MINIMO_PAGINA_VALIDA)
      return segunda;
    // As duas tentativas vieram curtas/vazias — não é confiável pra
    // comparar; melhor "não consegui verificar" do que um falso "mudou".
    return null;
  } catch {
    return null;
  }
}

export interface ResultadoSyncNorma {
  norma: string;
  checados: number;
  alterados: string[];
  erro?: string;
}

/**
 * NUNCA sobrescreve dispositivos.texto sozinho — só confirma (atualiza
 * verificado_em) ou alerta (legislacao_sync_alertas) pra revisão humana.
 * Igual ao resto da Base Legal Viva: texto oficial só entra verificado por
 * leitura pessoal, nunca por reescrita automática.
 */
export async function sincronizarNorma(
  norma: string,
  filtroCaminho?: RegExp
): Promise<ResultadoSyncNorma> {
  const dispositivos = await listarDispositivosPorNorma(norma);
  const emEscopo = filtroCaminho
    ? dispositivos.filter((d) => filtroCaminho.test(d.caminho))
    : dispositivos;
  if (emEscopo.length === 0) return { norma, checados: 0, alterados: [] };

  const textoOficial = await buscarTextoOficial(emEscopo[0].urlOficial);
  if (!textoOficial) {
    return {
      norma,
      checados: 0,
      alterados: [],
      erro: "não foi possível buscar a fonte oficial",
    };
  }

  const textoOficialNorm = normalizar(textoOficial);

  // Primeiro só calcula (sem gravar nada) — decide se o resultado é
  // plausível antes de mexer no banco ou avisar alguém.
  const candidatos = emEscopo
    .filter((d) => !d.texto.includes(TEXTO_PLACEHOLDER)) // nota editorial minha, não é texto de lei — nunca vai bater, e não é pra bater
    .map((d) => ({
      d,
      aindaBate: textoOficialNorm.includes(normalizar(d.texto)),
    }));
  const checados = candidatos.length;
  const alterados = candidatos
    .filter((c) => !c.aindaBate)
    .map((c) => c.d.caminho);

  // Mais da metade dos dispositivos da norma "mudando" ao mesmo tempo não é
  // plausível (leis não são reescritas inteiras do dia pra noite) — é sinal
  // de a página oficial ter vindo com conteúdo diferente do esperado por
  // algum outro motivo (reformatação da fonte, bloqueio parcial etc.), não
  // de mudança legislativa real. Nesse caso, não grava nada e não alerta —
  // melhor "não consegui confirmar hoje" do que uma lista enorme assustando
  // o Orlando com algo que não é de verdade (achado de 2026-10-31).
  if (checados > 1 && alterados.length / checados > 0.5) {
    return {
      norma,
      checados: 0,
      alterados: [],
      erro: `resultado implausível (${alterados.length}/${checados} dispositivos "alterados" de uma vez) — fonte oficial provavelmente veio incompleta/diferente do esperado, não confirmado`,
    };
  }

  for (const { d, aindaBate } of candidatos) {
    if (aindaBate) {
      await sql`UPDATE dispositivos SET verificado_em = NOW() WHERE id = ${d.id}::uuid`;
      await sql`
        UPDATE legislacao_sync_alertas SET resolvido = true, resolvido_em = NOW()
        WHERE norma = ${norma} AND caminho = ${d.caminho} AND resolvido = false
      `;
    } else {
      await sql`
        INSERT INTO legislacao_sync_alertas (norma, caminho)
        VALUES (${norma}, ${d.caminho})
        ON CONFLICT (norma, caminho, resolvido) DO UPDATE SET detectado_em = NOW()
      `;
    }
  }

  return { norma, checados, alterados };
}

export async function sincronizarNormasEmEscopo(): Promise<
  ResultadoSyncNorma[]
> {
  const resultados: ResultadoSyncNorma[] = [];
  for (const { norma, filtroCaminho } of NORMAS_EM_ESCOPO) {
    resultados.push(await sincronizarNorma(norma, filtroCaminho));
  }
  return resultados;
}

export async function getAlertasSyncAtivos(): Promise<
  { norma: string; caminho: string; detectadoEm: string }[]
> {
  const rows = await sql`
    SELECT norma, caminho, detectado_em::text
    FROM legislacao_sync_alertas
    WHERE resolvido = false
    ORDER BY detectado_em DESC
  `;
  return rows.map((r) => ({
    norma: r.norma,
    caminho: r.caminho,
    detectadoEm: r.detectado_em,
  }));
}
