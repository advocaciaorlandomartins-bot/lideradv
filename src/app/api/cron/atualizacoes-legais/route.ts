/**
 * GET /api/cron/atualizacoes-legais
 * Executa diariamente às 08:30 (horário de Brasília).
 * Busca no DOU publicações do INSS/Previdência Social e analisa impacto com IA.
 *
 * Requer env: DOU_INLABS_KEY (chave InLabs — inlabs.in.gov.br, cadastro gratuito)
 * Opcional:   CRON_SECRET (valida chamadas do Vercel)
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Termos de busca no DOU — executados em sequência para cobrir variações
const TERMOS_DOU = [
  "INSS benefício",
  "instrução normativa INSS",
  "portaria previdência social",
  "salário mínimo decreto",
  "auxílio-doença aposentadoria",
  "BPC LOAS deficiência",
];

interface DouArticle {
  id_materia?: string;
  titulo?: string;
  subtitulo?: string;
  txt?: string;
  identifica?: string;
  fullUrl?: string;
  urlTitle?: string;
  pubDate?: string;
  pubName?: string;
  nome_orgao?: string;
}

async function buscarDOU(termo: string, data: string): Promise<DouArticle[]> {
  const key = process.env.DOU_INLABS_KEY;
  if (!key) return [];

  const url = new URL("https://inlabs.in.gov.br/openapi.php");
  url.searchParams.set("chave", key);
  url.searchParams.set("edicao", data); // YYYY-MM-DD
  url.searchParams.set("campo", "texto");
  url.searchParams.set("q", termo);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data_resp = await res.json();
    return Array.isArray(data_resp) ? data_resp : [];
  } catch {
    return [];
  }
}

function classificarTipo(identifica: string = "", orgao: string = ""): string {
  const txt = (identifica + " " + orgao).toUpperCase();
  if (txt.includes("INSTRUÇÃO NORMATIVA")) return "instrucao_normativa";
  if (txt.includes("PORTARIA")) return "portaria";
  if (txt.includes("RESOLUÇÃO")) return "resolucao";
  if (txt.includes("DECRETO")) return "decreto";
  if (txt.includes("CIRCULAR")) return "circular";
  if (txt.includes("NOTA TÉCNICA")) return "nota_tecnica";
  if (txt.includes("AVISO")) return "aviso";
  return "diario_oficial";
}

async function analisarComIA(article: DouArticle): Promise<{
  impacto: "alto" | "medio" | "baixo";
  analise: string;
  o_que_muda: string;
  acao_recomendada: string;
  tipos_afetados: string[];
} | null> {
  const texto = [
    article.identifica ?? "",
    article.titulo ?? "",
    article.subtitulo ?? "",
    (article.txt ?? "").slice(0, 2000),
  ]
    .filter(Boolean)
    .join("\n");

  if (!texto.trim()) return null;

  try {
    const msg = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Você é um especialista em direito previdenciário brasileiro. Analise esta publicação do Diário Oficial:

---
${texto}
---

Responda EXCLUSIVAMENTE neste JSON (sem markdown, sem explicação extra):
{
  "impacto": "alto" | "medio" | "baixo",
  "analise": "resumo técnico em 2 frases do que foi publicado",
  "o_que_muda": "o que muda na prática para o advogado previdenciário (1-2 frases diretas)",
  "acao_recomendada": "ação concreta que o advogado deve tomar (1 frase imperativa)",
  "tipos_afetados": ["lista", "de", "tipos"]
}

Para tipos_afetados use apenas valores do conjunto:
aposentadoria_invalidez | auxilio_doenca | bpc_loas | rural | revisao_beneficio | salario_minimo | pensao_morte | acidente_trabalho | aposentadoria_tempo | aposentadoria_especial | calculo_beneficio | prazo_processo | outros

Critérios de impacto:
- alto: altera cálculo de benefício, carência, datas ou procedimentos que afetam processos em andamento
- medio: nova instrução administrativa, mudança de formulário, novo prazo burocrático
- baixo: informativo, portaria interna sem efeito prático imediato`,
        },
      ],
    });

    const raw =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const jsonStr = raw.startsWith("{")
      ? raw
      : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    return {
      impacto: parsed.impacto ?? "baixo",
      analise: parsed.analise ?? "",
      o_que_muda: parsed.o_que_muda ?? "",
      acao_recomendada: parsed.acao_recomendada ?? "",
      tipos_afetados: Array.isArray(parsed.tipos_afetados)
        ? parsed.tipos_afetados
        : [],
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Valida CRON_SECRET se configurado
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  if (!process.env.DOU_INLABS_KEY) {
    return NextResponse.json({
      ok: false,
      msg: "DOU_INLABS_KEY não configurada. Cadastre-se em inlabs.in.gov.br para ativar o monitoramento automático.",
    });
  }

  // Data de hoje no fuso de Brasília
  const hoje = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const dataStr = hoje.toISOString().split("T")[0]; // YYYY-MM-DD

  const resultados = { buscados: 0, novos: 0, erros: 0 };
  const vistos = new Set<string>(); // evita duplicatas entre termos

  for (const termo of TERMOS_DOU) {
    const artigos = await buscarDOU(termo, dataStr);

    for (const art of artigos) {
      const uid = art.id_materia ?? art.urlTitle ?? art.titulo ?? "";
      if (!uid || vistos.has(uid)) continue;
      vistos.add(uid);
      resultados.buscados++;

      // Verifica se já existe no banco
      const [existe] = await sql`
        SELECT id FROM atualizacoes_legais
        WHERE url = ${art.fullUrl ?? ""} OR titulo = ${art.titulo ?? ""}
        LIMIT 1
      `;
      if (existe) continue;

      const analise = await analisarComIA(art);
      if (!analise) {
        resultados.erros++;
        continue;
      }

      try {
        await sql`
          INSERT INTO atualizacoes_legais (
            titulo, resumo, url, data_publicacao, secao_dou, orgao,
            tipo, impacto, analise_ia, o_que_muda, acao_recomendada,
            tipos_afetados, fonte
          ) VALUES (
            ${(art.titulo ?? art.identifica ?? "Sem título").slice(0, 500)},
            ${(art.subtitulo ?? "").slice(0, 1000)},
            ${art.fullUrl ?? null},
            ${dataStr},
            ${art.pubName ?? null},
            ${(art.nome_orgao ?? "").slice(0, 200)},
            ${classificarTipo(art.identifica, art.nome_orgao)},
            ${analise.impacto},
            ${analise.analise},
            ${analise.o_que_muda},
            ${analise.acao_recomendada},
            ${analise.tipos_afetados},
            'dou'
          )
        `;
        resultados.novos++;
      } catch {
        resultados.erros++;
      }
    }
  }

  return NextResponse.json({ ok: true, data: dataStr, ...resultados });
}
