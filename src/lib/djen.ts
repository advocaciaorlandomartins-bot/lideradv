/**
 * Integração com o DJEN — Diário de Justiça Eletrônico Nacional
 * API pública: comunicaapi.pje.jus.br
 *
 * Busca por número de processo (garantido funcionar para TRF5).
 * Para cada processo do sistema com formato TRF5 (*.4.05.8000),
 * o cron verifica se há novas comunicações e insere no banco.
 */

import sql from "./db";
import Anthropic from "@anthropic-ai/sdk";

const DJEN_BASE = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

interface DjenItem {
  id: number;
  data_disponibilizacao: string; // YYYY-MM-DD
  siglaTribunal: string;
  tipoComunicacao: string;
  nomeOrgao: string;
  texto: string;
  numero_processo: string; // 20 dígitos sem máscara
  numeroprocessocommascara: string;
  link: string | null;
  destinatarios: { nome: string; polo: string }[];
  destinatarioadvogados: {
    advogado: { nome: string; numero_oab: string; uf_oab: string } | null;
  }[];
}

function numeroSemMascara(numero: string): string {
  return numero.replace(/\D/g, "").padStart(20, "0");
}

function isTrf5(numero: string): boolean {
  // 4.05.8000 ou 4.05.8100 etc → TRF5
  return /\.4\.05\.\d{4}/.test(numero);
}

async function buscarPorProcesso(numeroProcesso: string): Promise<DjenItem[]> {
  const num = numeroSemMascara(numeroProcesso);
  try {
    const res = await fetch(
      `${DJEN_BASE}?numeroProcesso=${num}&tamanhoPagina=50`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: DjenItem[]; count?: number };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function gerarResumoIA(
  texto: string,
  tipo: string
): Promise<{
  texto: string;
  prazo_dias: number | null;
  acao_necessaria: string | null;
  audiencia: string | null;
} | null> {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Analise esta ${tipo} judicial e responda em JSON:
{"texto":"resumo em 1-2 frases","prazo_dias":N_ou_null,"acao_necessaria":"ação ou null","audiencia":"DD/MM/YYYY ou null"}

TEXTO:
${texto.slice(0, 1500)}`,
        },
      ],
    });
    const raw = (msg.content[0] as { text: string }).text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function sincronizarDJEN(diasAtras = 7): Promise<number> {
  // Busca todos os processos TRF5 do banco
  const processos = await sql`
    SELECT id::text, numero
    FROM processos
    WHERE numero IS NOT NULL
      AND numero != ''
      AND deleted_at IS NULL
      AND LENGTH(REGEXP_REPLACE(numero, '[^0-9]', '', 'g')) = 20
  `;

  const trf5 = processos.filter((p) => isTrf5(String(p.numero)));
  if (trf5.length === 0) return 0;

  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - diasAtras);

  let inseridos = 0;

  for (const proc of trf5) {
    const numero = String(proc.numero);
    const processoId = String(proc.id);
    const itens = await buscarPorProcesso(numero);

    for (const item of itens) {
      // Só processar comunicações dentro do período
      const dataItem = new Date(item.data_disponibilizacao);
      if (dataItem < dataCorte) continue;

      // Deduplicação pelo ID externo do DJEN
      const djenIdStr = String(item.id);
      const existe = await sql`
        SELECT id FROM publicacoes
        WHERE djen_id = ${djenIdStr}
        LIMIT 1
      `;
      if (existe.length > 0) continue;

      const destinatario = item.destinatarios?.[0]?.nome ?? "—";
      const advogados = (item.destinatarioadvogados ?? [])
        .map((d) => d.advogado?.nome)
        .filter(Boolean) as string[];

      const conteudo = item.texto ?? null;
      const resumo = conteudo
        ? await gerarResumoIA(conteudo, item.tipoComunicacao)
        : null;

      await sql`
        INSERT INTO publicacoes
          (processo, tipo, destinatario, advogados, orgao, tribunal,
           disponibilizacao, status, origem, conteudo, conteudo_completo,
           resumo_ia, djen_id, processo_id)
        VALUES (
          ${item.numeroprocessocommascara || numero},
          ${item.tipoComunicacao || "Comunicação"},
          ${destinatario},
          ${JSON.stringify(advogados)},
          ${item.nomeOrgao || "TRF5"},
          ${"TRF5"},
          ${item.data_disponibilizacao}::date,
          ${"nao_lida"},
          ${"automatica"},
          ${conteudo},
          ${conteudo},
          ${resumo ? JSON.stringify(resumo) : null},
          ${djenIdStr},
          ${processoId}::uuid
        )
        ON CONFLICT DO NOTHING
      `;
      inseridos++;
    }
  }

  return inseridos;
}
