/**
 * Motor de IA jurídica do LiderAdv — SERVER ONLY.
 * Funções de geração, análise e revisão com Claude.
 * Importar skills e tipos de @/lib/ai-juridico-skills (safe para client).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ClientFull } from "./clients-db";
import type { ProcessoFull } from "./processos-db";
import type { EscritorioConfig } from "./escritorio-db";
import type { SkillId } from "./ai-juridico-skills";
import { SKILLS } from "./ai-juridico-skills";

export type { SkillId, Skill, EstrategiaResult } from "./ai-juridico-skills";
export { SKILLS } from "./ai-juridico-skills";

// ─── Client ────────────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Context Builder ────────────────────────────────────────────────────────────

export interface ContextoJuridico {
  escritorio: Pick<
    EscritorioConfig,
    "nome" | "oab" | "endereco" | "cidade" | "estado" | "email" | "telefone"
  >;
  cliente?: Partial<ClientFull>;
  processo?: Partial<ProcessoFull>;
  instrucaoExtra?: string;
}

export function buildContextoTexto(ctx: ContextoJuridico): string {
  const parts: string[] = [];

  parts.push(`=== ESCRITÓRIO ===
Nome: ${ctx.escritorio.nome}
OAB: ${ctx.escritorio.oab ?? "não informado"}
Endereço: ${[ctx.escritorio.endereco, ctx.escritorio.cidade, ctx.escritorio.estado].filter(Boolean).join(", ")}
E-mail: ${ctx.escritorio.email ?? "—"}
Telefone: ${ctx.escritorio.telefone ?? "—"}`);

  if (ctx.cliente) {
    const c = ctx.cliente;
    const dataNasc = c.birth_date
      ? new Date(c.birth_date).toLocaleDateString("pt-BR")
      : null;
    parts.push(`
=== CLIENTE ===
Nome completo: ${c.name ?? "—"}
CPF/CNPJ: ${c.doc ?? "—"}
Tipo: ${c.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
RG: ${c.rg ?? "—"} ${c.rg_orgao ? `(${c.rg_orgao})` : ""}
Data de nascimento: ${dataNasc ?? "—"}
Estado civil: ${c.estado_civil ?? "—"}
Gênero: ${c.genero ?? "—"}
Profissão: ${c.profissao ?? "—"}
Telefone: ${c.phone ?? "—"}
E-mail: ${c.email ?? "—"}
Endereço: ${[c.street, c.addr_number, c.complement, c.neighborhood, c.city, c.state, c.cep].filter(Boolean).join(", ")}
NIS/PIS: ${c.nis ?? "—"}
Número do benefício: ${c.num_beneficio ?? "—"}
Status do benefício: ${c.status_beneficio ?? "—"}
Tipo de benefício: ${c.tipo_beneficio ?? "—"}
CID principal: ${c.cid_principal ?? "—"}
Tipo de incapacidade: ${c.tipo_incapacidade ?? "—"}
Data do diagnóstico: ${c.data_diagnostico ? new Date(c.data_diagnostico).toLocaleDateString("pt-BR") : "—"}
Data de afastamento: ${c.data_afastamento ? new Date(c.data_afastamento).toLocaleDateString("pt-BR") : "—"}
Filiação mãe: ${c.filiacao_mae ?? "—"}
Filiação pai: ${c.filiacao_pai ?? "—"}
Naturalidade: ${[c.naturalidade_cidade, c.naturalidade_estado].filter(Boolean).join("/")}
Observações: ${c.notes ?? "—"}`);
  }

  if (ctx.processo) {
    const p = ctx.processo;
    parts.push(`
=== PROCESSO ===
Número: ${p.numero ?? "sem número (pré-distribuição)"}
Tipo de ação: ${p.tipo_acao ?? "—"}
Área: ${p.area ?? "—"}
Fase: ${p.fase ?? "—"}
Vara: ${p.vara ?? "—"}
Comarca: ${p.comarca ?? "—"}
Parte contrária: ${p.parte_contraria ?? "—"} ${p.parte_contraria_doc ? `(${p.parte_contraria_doc})` : ""}
Valor da causa: ${p.valor_causa ? `R$ ${p.valor_causa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
Data de distribuição: ${p.data_distribuicao ?? "—"}
Status: ${p.status ?? "—"}
Resultado administrativo: ${p.resultado_admin ?? "—"}
Motivo indeferimento: ${p.motivo_indeferimento ?? "—"}
Data resultado admin: ${p.data_resultado_admin ?? "—"}
Protocolo INSS: ${p.protocolo_inss ?? "—"}
Agência INSS: ${p.agencia_inss ?? "—"}
DER: ${p.der ?? "—"}
DIB: ${p.dib ?? "—"}
DCB: ${p.dcb ?? "—"}
Número benefício concedido: ${p.num_beneficio_concedido ?? "—"}
Modelo de honorário: ${p.modelo_honorario ?? "—"}
Notas: ${(p as ProcessoFull).notas ?? "—"}`);
  }

  if (ctx.instrucaoExtra) {
    parts.push(
      `\n=== INSTRUÇÕES ESPECÍFICAS DO ADVOGADO ===\n${ctx.instrucaoExtra}`
    );
  }

  return parts.join("\n");
}

// ─── Geração de petição (streaming) ────────────────────────────────────────────

export interface GerarPeticaoParams {
  skill: SkillId;
  tipoPeticao: string;
  contexto: ContextoJuridico;
}

export async function gerarPeticaoStream(
  params: GerarPeticaoParams
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();
  const skill = SKILLS[params.skill];
  const ctxTexto = buildContextoTexto(params.contexto);
  const encoder = new TextEncoder();

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: skill.systemPrompt,
    messages: [
      {
        role: "user",
        content: `${ctxTexto}

=== TAREFA ===
Redija uma ${params.tipoPeticao} completa e de excelência.

IMPORTANTE:
- Use TODOS os dados específicos do cliente e processo acima
- Cada parágrafo deve conter dados concretos do caso, não frases genéricas
- Cite jurisprudência atual e local (${params.skill === "previdenciario" ? "TRF5, TNU, STJ" : "tribunal competente, STJ, STF"})
- Varie o comprimento das frases e parágrafos
- A peça deve soar como escrita por um advogado experiente de Maceió/AL, não por IA
- Inclua o cabeçalho completo (endereçamento ao juízo), qualificação das partes, fatos, direito, pedidos e encerramento com local, data e assinatura
- Para campos desconhecidos use [COMPLETAR], mas NUNCA deixe em branco dados disponíveis acima`,
      },
    ],
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });
}

// ─── Análise de documento ───────────────────────────────────────────────────────

export interface AnalisarDocumentoParams {
  nomeArquivo: string;
  conteudoBase64: string;
  mimeType: string;
  contexto: ContextoJuridico;
  tipoAnalise?: "completa" | "resumo" | "riscos";
}

export async function analisarDocumento(
  params: AnalisarDocumentoParams
): Promise<string> {
  const client = getClient();

  const promptAnalise = {
    completa: `Faça uma análise jurídica completa deste documento. Inclua:
1. **RESUMO EXECUTIVO** (3-5 linhas)
2. **LINHA DO TEMPO** (datas relevantes em ordem cronológica)
3. **PONTOS DE ATENÇÃO** (prazos, obrigações, riscos)
4. **FUNDAMENTO LEGAL** (leis e artigos aplicáveis ao documento)
5. **PRÓXIMAS AÇÕES RECOMENDADAS** (o que o advogado deve fazer)`,
    resumo: `Faça um resumo jurídico objetivo deste documento em no máximo 5 parágrafos, destacando o essencial para o advogado.`,
    riscos: `Analise este documento identificando:
1. **RISCOS JURÍDICOS** (cláusulas abusivas, irregularidades, prazos vencidos)
2. **CLÁUSULAS PROBLEMÁTICAS** (cada uma com o motivo e artigo violado)
3. **RECOMENDAÇÕES** (o que negociar, questionar ou contestar)`,
  };

  const isImage = params.mimeType.startsWith("image/");
  const isPdf = params.mimeType === "application/pdf";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contentBlock: any;

  if (isImage) {
    contentBlock = {
      type: "image",
      source: {
        type: "base64",
        media_type: params.mimeType,
        data: params.conteudoBase64,
      },
    };
  } else if (isPdf) {
    contentBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: params.conteudoBase64,
      },
    };
  } else {
    throw new Error("Tipo de arquivo não suportado para análise.");
  }

  const ctxTexto = buildContextoTexto(params.contexto);

  const res = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `Você é o Dr. Lex, especialista jurídico brasileiro. Analise documentos com precisão técnica, usando terminologia jurídica brasileira, referenciando legislação nacional e identificando aspectos práticos relevantes para o advogado.`,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: `Arquivo: ${params.nomeArquivo}

CONTEXTO DO CASO:
${ctxTexto}

${promptAnalise[params.tipoAnalise ?? "completa"]}

Responda em português, com formatação markdown clara.`,
            },
          ],
        },
      ],
    },
    isPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : undefined
  );

  const block = res.content[0];
  return block?.type === "text"
    ? block.text
    : "Não foi possível analisar o documento.";
}

// ─── Revisão de petição ─────────────────────────────────────────────────────────

export interface RevisarPeticaoParams {
  textoPeticao: string;
  tipoPeticao: string;
  skill: SkillId;
  contexto: ContextoJuridico;
}

export async function revisarPeticao(
  params: RevisarPeticaoParams
): Promise<string> {
  const client = getClient();
  const skill = SKILLS[params.skill];
  const ctxTexto = buildContextoTexto(params.contexto);

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: skill.systemPrompt,
    messages: [
      {
        role: "user",
        content: `${ctxTexto}

=== PETIÇÃO A REVISAR ===
${params.textoPeticao}

=== TAREFA: REVISÃO CRÍTICA ===
Faça uma revisão jurídica rigorosa desta ${params.tipoPeticao}. Analise:

1. **PONTOS FORTES** (argumentos bem construídos)
2. **FRAGILIDADES JURÍDICAS** (argumentos que podem ser refutados, com sugestão de melhoria)
3. **JURISPRUDÊNCIA AUSENTE** (precedentes importantes que deveriam ser citados)
4. **DADOS FALTANTES** (informações do caso que faltam na peça e prejudicam o argumento)
5. **CORREÇÕES DE TEXTO** (erros técnicos, referências incorretas, art. errado)
6. **PONTUAÇÃO GERAL** (0–10) com justificativa

Seja objetivo e cirúrgico — o advogado precisa saber exatamente o que melhorar.`,
      },
    ],
  });

  const block = res.content[0];
  return block?.type === "text"
    ? block.text
    : "Não foi possível revisar a petição.";
}

// ─── Correção de petição ────────────────────────────────────────────────────────

export interface CorrigirPeticaoParams {
  textoPeticao: string;
  revisao: string;
  tipoPeticao: string;
  skill: SkillId;
  contexto?: ContextoJuridico;
}

export async function corrigirPeticao(
  params: CorrigirPeticaoParams
): Promise<string> {
  const client = getClient();
  const ctxTexto = params.contexto ? buildContextoTexto(params.contexto) : "";

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SKILLS[params.skill].systemPrompt,
    messages: [
      {
        role: "user",
        content: `${ctxTexto ? ctxTexto + "\n\n" : ""}=== PETIÇÃO ORIGINAL ===
${params.textoPeticao}

=== REVISÃO REALIZADA ===
${params.revisao}

=== TAREFA: APLICAR CORREÇÕES ===
Com base na revisão acima, reescreva a petição aplicando TODAS as correções indicadas.

REGRAS ABSOLUTAS:
1. NUNCA invente dados — use apenas informações presentes na petição original ou no contexto do caso
2. Mantenha TODOS os dados específicos do caso (nomes, CPF, datas, CID, valores, números de processo)
3. Corrija os pontos apontados na revisão, mas preserve o que estava correto
4. Acrescente a jurisprudência ausente indicada na revisão APENAS se ela for real e verificável
5. Melhore a fundamentação jurídica conforme sugerido, sempre dentro da lei vigente
6. O texto corrigido deve ser COMPLETO — não resuma, não omita seções
7. Mantenha a estrutura formal da petição (cabeçalho, fatos, direito, pedido)

Responda APENAS com a petição corrigida completa, sem comentários ou explicações.`,
      },
    ],
  });

  const block = res.content[0];
  return block?.type === "text" ? block.text : params.textoPeticao;
}

// ─── Estratégia processual ──────────────────────────────────────────────────────

export interface EstrategiaProcessualParams {
  skill: SkillId;
  contexto: ContextoJuridico;
}

export async function estrategiaProcessual(
  params: EstrategiaProcessualParams
): Promise<import("./ai-juridico-skills").EstrategiaResult> {
  const client = getClient();
  const skill = SKILLS[params.skill];
  const ctxTexto = buildContextoTexto(params.contexto);

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: skill.systemPrompt,
    messages: [
      {
        role: "user",
        content: `${ctxTexto}

=== TAREFA: DIAGNÓSTICO ESTRATÉGICO ===
Faça um diagnóstico jurídico completo deste caso e retorne um JSON estruturado com a seguinte estrutura EXATA (nenhum texto fora do JSON):

{
  "probabilidadeExito": <número de 0 a 100 representando % de chance de êxito>,
  "classificacaoRisco": <"alto"|"medio"|"baixo">,
  "resumoEstrategico": "<resumo em 3-4 linhas do caso e estratégia>",
  "pontosFortes": ["<ponto forte 1>", "<ponto forte 2>", ...],
  "pontosFrageis": ["<ponto frágil 1>", "<ponto frágil 2>", ...],
  "estrategiaRecomendada": "<estratégia detalhada em 1 parágrafo>",
  "proximas_acoes": ["<ação 1>", "<ação 2>", ...],
  "jurisprudenciaRelevante": ["<precedente 1 com número>", "<precedente 2 com número>", ...],
  "tempoEstimadoMeses": <número em meses ou null se imprevisível>
}

Base a análise em TODOS os dados disponíveis acima. Seja realista e específico — não dê probabilidades genéricas.`,
      },
    ],
  });

  const block = res.content[0];
  const raw = block?.type === "text" ? block.text : "{}";

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? raw);
    return { ...parsed, raw };
  } catch {
    return {
      probabilidadeExito: 0,
      classificacaoRisco: "alto" as const,
      resumoEstrategico: raw,
      pontosFortes: [],
      pontosFrageis: [],
      estrategiaRecomendada: raw,
      proximas_acoes: [],
      jurisprudenciaRelevante: [],
      tempoEstimadoMeses: null,
      raw,
    };
  }
}
