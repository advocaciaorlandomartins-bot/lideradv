import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Base legal embedada ──────────────────────────────────────────────────────

const BASE_LEGAL = `
Você é o Cérebro Jurídico do escritório — IA especialista em direito previdenciário
e trabalhista brasileiro. Seu nível é o de um advogado sênior com 20 anos de experiência.

REGRAS ABSOLUTAS (nunca viole sob nenhuma circunstância):
• Nunca invente fatos, datas, números de processo, valores ou precedentes
• Cite SEMPRE a base legal exata: lei, artigo, parágrafo, inciso
• Quando uma informação não estiver nos dados fornecidos, diga "requer verificação"
• Baseie-se exclusivamente nos dados do caso + legislação abaixo
• Nunca dê garantias de resultado — use "alta probabilidade", "risco elevado" etc.

════════════════════════════════════════════════
LEGISLAÇÃO PREVIDENCIÁRIA VIGENTE (2025)
════════════════════════════════════════════════

Lei 8.213/91 — LBPS (Plano de Benefícios):
• Art. 18: espécies de benefícios
• Art. 24-26: carência (aposentadoria por incapacidade: 12 contrib., art. 26 II: exceções graves)
• Art. 15: qualidade de segurado e período de graça (12 a 36 meses s/ contribuir)
• Art. 29: cálculo do salário-de-benefício (média de 80% maiores contribuições)
• Art. 42-47: aposentadoria por incapacidade permanente (ex-invalidez)
• Art. 59-63: auxílio por incapacidade temporária (ex-auxílio-doença) — B31
• Art. 71-73: salário-maternidade (CLT: até teto INSS; avulsa/individual: 1 SM)
• Art. 74-79: pensão por morte (cônjuge, dependentes)
• Art. 86: auxílio-acidente
• Art. 201 CF/88 + EC 103/2019: reforma previdenciária — regras de transição

Decreto 3.048/99 — RPS:
• Arts. 64-70: aposentadoria especial (agentes nocivos físicos/químicos/biológicos)
• Art. 161: recuperação da qualidade de segurado (1 contribuição nova — art. 27-A LBPS)

Lei 8.742/93 — LOAS (BPC):
• Art. 20: BPC ao idoso (65+) e pessoa com deficiência
• § 3°: renda familiar per capita — STF ampliou critério (ADPF 182, RE 567.985)
• Lei 13.146/2015 (EPCD): nova definição de deficiência (modelo biopsicossocial)

EC 103/2019 — Reforma Previdenciária:
• Transição: pedágio 50% (homens), 100% (mulheres) sobre tempo faltante
• Regra de pontos progressiva: 96/86 pts (2024), 100/90 pts (2028)
• Aposentadoria por incapacidade: mantém regras anteriores

IN PRES/INSS 128/2022: instrução normativa vigente para concessão administrativa

════════════════════════════════════════════════
JURISPRUDÊNCIA CONSOLIDADA
════════════════════════════════════════════════

TNU (Turma Nacional de Uniformização):
• Súmula 9: início de prova material para atividade rural
• Súmula 10: atividade especial — exposição habitual e permanente a agentes nocivos
• Súmula 28: DER como termo inicial do benefício negado administrativamente
• Súmula 33: PPP + LTCAT para comprovação de especial
• Súmula 44: auxílio-acidente — redução parcial permanente da capacidade
• Súmula 47: trabalhador rural — comprovação por prova material + testemunhos
• Súmula 54: BPC/LOAS — miserabilidade vai além do critério renda
• Súmula 57: laudo pericial é relativo — juiz pode valorar outros elementos
• Súmula 63: salário-maternidade — empregada demitida durante gestação mantém direito
• Súmula 72: período de graça — contagem para qualidade de segurado
• Súmula 77: salário-maternidade — contribuinte individual: 1 contribuição + carência 10

STJ:
• Tema 352: carência — cômputo de contribuições
• Súmula 548: correção de benefícios anteriores a 1988

STF:
• Tema 995: BPC — critério de renda não é absoluto (miserabilidade)
• RE 636.941: incapacidade — perícia biopsicossocial (ICF)
• ADPF 182: BPC — família de acolhimento

TRF5 / TJAL / TRT19 (Alagoas — sede do escritório):
• Jurisprudência local do TRF5 para benefícios por incapacidade
• TJAL para questões cíveis e de família
• TRT19 para demandas trabalhistas

CÁLCULOS:
• Teto INSS 2025: R$ 7.786,02
• Fator previdenciário: aplicado a aposentadorias por tempo (EC 103/2019)
• Salário mínimo: consultar campo salario_minimo no perfil do escritório
`;

// ─── Contexto aprendido ───────────────────────────────────────────────────────

export async function obterContextoCerebro(
  tipoAcao: string,
  area: string
): Promise<string> {
  const [casos, teses, peticoes] = await Promise.all([
    sql`
      SELECT tipo_acao, resultado_final, argumentos_vencedores, erros_cometidos,
             teses_utilizadas, licao, vara, comarca, motivo_indeferimento
      FROM cerebro_juridico
      WHERE tipo_acao ILIKE ${`%${tipoAcao}%`} OR area = ${area}
      ORDER BY created_at DESC LIMIT 12
    `,
    sql`
      SELECT titulo, tese, base_legal, taxa_sucesso, vezes_venceu, vezes_aplicada
      FROM cerebro_teses
      WHERE (tipo_acao ILIKE ${`%${tipoAcao}%`} OR area = ${area}) AND ativa = true
      ORDER BY taxa_sucesso DESC NULLS LAST, vezes_venceu DESC LIMIT 5
    `,
    sql`
      SELECT titulo, tipo_peticao, texto
      FROM ia_peticoes
      WHERE (area ILIKE ${`%${area}%`} OR tipo_peticao ILIKE ${`%${tipoAcao}%`})
        AND aprovada = true
      ORDER BY vezes_usada DESC LIMIT 2
    `,
  ]);

  if (!casos.length && !teses.length) return "";

  let ctx = "\n════════ CONHECIMENTO DO ESCRITÓRIO ════════\n";

  const ganhos = casos.filter((c) => c.resultado_final === "deferido");
  const perdidos = casos.filter((c) => c.resultado_final === "indeferido");

  if (ganhos.length) {
    ctx += `\n✅ CASOS GANHOS (${ganhos.length}) — O QUE FUNCIONOU:\n`;
    ganhos.forEach((c) => {
      if (c.argumentos_vencedores?.length)
        ctx += `• ${(c.argumentos_vencedores as string[]).slice(0, 3).join(" | ")}\n`;
      if (c.licao) ctx += `  → ${c.licao}\n`;
    });
  }

  if (perdidos.length) {
    ctx += `\n❌ CASOS PERDIDOS (${perdidos.length}) — ERROS A EVITAR:\n`;
    perdidos.forEach((c) => {
      if (c.motivo_indeferimento)
        ctx += `• Motivo negativa: ${c.motivo_indeferimento}\n`;
      if (c.erros_cometidos?.length)
        ctx += `  Erro: ${(c.erros_cometidos as string[]).slice(0, 2).join(" | ")}\n`;
    });
  }

  if (teses.length) {
    ctx += `\n⚖️  TESES COM RESULTADO COMPROVADO:\n`;
    teses.forEach((t) => {
      const taxa =
        Number(t.vezes_aplicada) > 0
          ? ` (${Math.round((Number(t.vezes_venceu) / Number(t.vezes_aplicada)) * 100)}% de sucesso)`
          : "";
      ctx += `• ${t.titulo}${taxa}\n  ${t.tese}\n`;
      if ((t.base_legal as string[])?.length)
        ctx += `  Base: ${(t.base_legal as string[]).join(", ")}\n`;
    });
  }

  if (peticoes.length) {
    ctx += `\n📄 PETIÇÕES APROVADAS DO MESMO TIPO (referência de argumentação):\n`;
    peticoes.forEach(
      (p, i) =>
        (ctx += `[Ref ${i + 1}] ${p.titulo}\n${String(p.texto || "").substring(0, 600)}...\n\n`)
    );
  }

  ctx += "════════════════════════════════════════════\n";
  return ctx;
}

// ─── 1. Análise completa do processo ─────────────────────────────────────────

export async function analisarProcesso(processoId: string) {
  const [processo] = await sql`
    SELECT p.*,
           c.name             AS cliente_nome,
           c.birth_date       AS data_nascimento,
           c.nis,
           c.cid_principal,
           c.tipo_incapacidade,
           c.data_diagnostico,
           c.data_afastamento,
           c.num_contribuicoes,
           c.categoria_contribuinte,
           c.atividade_anterior,
           c.carencia_atingida,
           c.status_beneficio,
           c.tipo_beneficio,
           c.valor_beneficio,
           ec.salario_minimo   AS sm_escritorio
    FROM processos p
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN escritorio_config ec ON true
    WHERE p.id = ${processoId}::uuid
    LIMIT 1
  `;
  if (!processo) throw new Error("Processo não encontrado");

  const [andamentos, documentos, contexto] = await Promise.all([
    sql`
      SELECT texto, tipo, data_referencia, situacao
      FROM historico_registros
      WHERE processo_id = ${processoId}::uuid
      ORDER BY data_referencia DESC, created_at DESC LIMIT 15
    `,
    sql`
      SELECT nome, tipo FROM documentos
      WHERE entity_type = 'processo' AND entity_id = ${processoId}::uuid
    `,
    obterContextoCerebro(
      processo.tipo_acao || "",
      processo.area || "Previdenciário"
    ),
  ]);

  const idadeCliente = processo.data_nascimento
    ? Math.floor(
        (Date.now() - new Date(processo.data_nascimento).getTime()) /
          31_557_600_000
      )
    : null;

  const dadosProcesso = `
PROCESSO Nº ${processo.numero || "Sem número CNJ"}
Tipo de ação: ${processo.tipo_acao || "Não informado"}
Área: ${processo.area || "Previdenciário"} | Fase: ${processo.fase || "N/A"}
Vara: ${processo.vara || "N/A"} | Comarca: ${processo.comarca || "N/A"}
Prioridade: ${processo.prioridade || "Normal"} | Status: ${processo.status}
Parte contrária: ${processo.parte_contraria || "INSS"}
Valor da causa: ${processo.valor_causa ? `R$ ${Number(processo.valor_causa).toLocaleString("pt-BR")}` : "N/A"}

CLIENTE: ${processo.cliente_nome}
Idade: ${idadeCliente ? `${idadeCliente} anos` : "Não informada"}
CID Principal: ${processo.cid_principal || "Não informado"}
Tipo de incapacidade: ${processo.tipo_incapacidade || "Não informado"}
Data do diagnóstico: ${processo.data_diagnostico || "Não informada"}
Data do afastamento: ${processo.data_afastamento || "Não informada"}
Atividade anterior: ${processo.atividade_anterior || "Não informada"}
Nº contribuições: ${processo.num_contribuicoes ?? "Não informado"}
Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}
Carência atingida: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}
NIS/PIS: ${processo.nis || "Não informado"}

DADOS ADMINISTRATIVOS:
DER: ${processo.der || "Não informado"}
DIB: ${processo.dib || "N/A"} | DCB: ${processo.dcb || "N/A"}
Protocolo INSS: ${processo.protocolo_inss || "N/A"} | Agência: ${processo.agencia_inss || "N/A"}
Resultado administrativo: ${processo.resultado_admin || "Pendente"}
Motivo indeferimento: ${processo.motivo_indeferimento || "N/A"}
Nº benefício concedido: ${processo.num_beneficio_concedido || "N/A"}

RELATO DO CASO:
${processo.relato || "Não informado"}

ANDAMENTOS (${andamentos.length} registros):
${
  andamentos
    .slice(0, 6)
    .map(
      (a) =>
        `[${a.data_referencia || "S/D"}] ${a.tipo || ""}: ${String(a.texto || "").substring(0, 120)}`
    )
    .join("\n") || "Nenhum"
}

DOCUMENTOS ANEXADOS (${documentos.length}):
${documentos.map((d) => d.nome).join(", ") || "Nenhum"}

Data da análise: ${new Date().toLocaleDateString("pt-BR")}
`;

  const prompt = `${BASE_LEGAL}
${contexto}

TAREFA: Análise jurídica completa e estratégica deste caso.

${dadosProcesso}

Responda com a estrutura abaixo (use os cabeçalhos exatos):

## AVALIAÇÃO GERAL
Síntese da viabilidade em 3-4 frases. Seja direto.

## PONTOS FORTES
Liste com base legal específica (cite artigo, lei).

## PONTOS FRACOS E RISCOS
Liste vulnerabilidades jurídicas e lacunas probatórias.

## TESE PRINCIPAL RECOMENDADA
A estratégia jurídica mais forte para este caso específico.

## BASE LEGAL APLICÁVEL
Artigos, súmulas e precedentes diretamente aplicáveis.

## DOCUMENTOS QUE FALTAM
O que ainda precisa ser obtido para fortalecer o caso.

## PRÓXIMA AÇÃO IMEDIATA
O que fazer agora (prático e específico — ex: "Solicitar CNIS atualizado ao cliente").

## PROBABILIDADE DE ÊXITO: XX%
Justifique brevemente.

## RISCO GERAL: Alto | Médio | Baixo
`;

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const analise = resp.content[0].type === "text" ? resp.content[0].text : "";

  const riscoMatch = analise.match(/RISCO GERAL[:\s*]+(\w+)/i);
  const probMatch = analise.match(/PROBABILIDADE DE ÊXITO[:\s*]+(\d+)/i);
  const acaoMatch = analise.match(
    /## PRÓXIMA AÇÃO IMEDIATA\n([\s\S]*?)(?=\n##|$)/i
  );

  const risco = riscoMatch?.[1]?.toLowerCase().includes("alto")
    ? "alto"
    : riscoMatch?.[1]?.toLowerCase().includes("baixo")
      ? "baixo"
      : "medio";
  const prob = probMatch
    ? Math.min(100, Math.max(0, parseInt(probMatch[1])))
    : 50;
  const proximaAcao =
    acaoMatch?.[1]?.trim() || "Verificar documentação com cliente";

  const baseLegal = [
    ...analise.matchAll(
      /(?:art(?:igo)?\.?\s*\d+[\w\-]*|Súmula\s+\d+\s+(?:TNU|STJ|STF|TRF\d*)|Tema\s+\d+|Lei\s+[\d.\/]+)/gi
    ),
  ]
    .map((m) => m[0])
    .slice(0, 12);

  await sql`
    INSERT INTO cerebro_analises
      (processo_id, tipo, titulo, analise, risco, probabilidade_sucesso, proxima_acao, base_legal)
    VALUES
      (${processoId}::uuid, 'inicial', 'Análise Automática do Caso',
       ${analise}, ${risco}, ${prob}, ${proximaAcao}, ${baseLegal})
  `;

  return { analise, risco, probabilidadeSucesso: prob, proximaAcao, baseLegal };
}

// ─── 2. Análise de documentos ─────────────────────────────────────────────────

export async function analisarDocumento(
  documentoId: string,
  processoId: string
): Promise<string> {
  const [[doc], [processo]] = await Promise.all([
    sql`SELECT * FROM documentos WHERE id = ${documentoId}::uuid`,
    sql`SELECT tipo_acao, area FROM processos WHERE id = ${processoId}::uuid`,
  ]);
  if (!doc) throw new Error("Documento não encontrado");

  const resp = await fetch(doc.url as string);
  if (!resp.ok) return "Não foi possível acessar o documento.";

  const buffer = await resp.arrayBuffer();
  const b64 = Buffer.from(buffer).toString("base64");
  const mime = (doc.tipo as string) || "application/pdf";
  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  if (!isPdf && !isImage) return "Formato não suportado (use PDF ou imagem).";

  const prompt = `${BASE_LEGAL}

Processo: ${processo?.tipo_acao || "N/A"} | Área: ${processo?.area || "Previdenciário"}
Arquivo: ${doc.nome}

TAREFA: Analise este documento e extraia todos os dados jurídicos relevantes.

## TIPO DO DOCUMENTO
Identifique (CNIS, laudo médico, carta INSS, PPP, CTPS, sentença, etc.)

## DADOS EXTRAÍDOS
Todos os dados relevantes: datas, números, CIDs, períodos contributivos, vínculos, valores, resultados de perícia.

## RELEVÂNCIA JURÍDICA
Como este documento impacta o caso previdenciário.

## PONTOS DE ATENÇÃO
Inconsistências, datas suspeitas, lacunas, informações contraditórias.

## O QUE COMPROVA
O que este documento prova juridicamente (e o que não prova).

## RECOMENDAÇÃO PRÁTICA
Ação concreta com base neste documento.

Nunca invente dados que não estejam no documento. Se não conseguir ler alguma parte, informe.`;

  const content: Anthropic.MessageParam["content"] = [
    isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: b64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mime as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data: b64,
          },
        },
    { type: "text", text: prompt },
  ];

  const aiResp = await claude.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content }],
    },
    isPdf ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : {}
  );

  const analise =
    aiResp.content[0].type === "text"
      ? aiResp.content[0].text
      : "Não foi possível analisar o documento.";

  await sql`
    INSERT INTO cerebro_analises (processo_id, tipo, titulo, analise, metadata)
    VALUES (${processoId}::uuid, 'documento', ${`Análise: ${doc.nome}`},
            ${analise}, ${JSON.stringify({ documento_id: documentoId, nome: doc.nome, url: doc.url })})
  `;

  return analise;
}

// ─── 3. Interpretação de andamentos ──────────────────────────────────────────

export async function interpretarAndamento(
  andamentoId: string,
  processoId: string
) {
  const [[andamento], [processo]] = await Promise.all([
    sql`SELECT * FROM historico_registros WHERE id = ${andamentoId}::uuid`,
    sql`SELECT tipo_acao, area, vara, comarca, fase, status FROM processos WHERE id = ${processoId}::uuid`,
  ]);
  if (!andamento) throw new Error("Andamento não encontrado");

  const prompt = `${BASE_LEGAL}

Processo: ${processo?.tipo_acao || "N/A"} | Vara: ${processo?.vara || "N/A"} | Fase: ${processo?.fase || "N/A"}

ANDAMENTO:
"${andamento.texto}"
Data: ${andamento.data_referencia || "Não informada"} | Tipo: ${andamento.tipo || "N/A"}

TAREFA: Interprete este andamento para o advogado responsável.

## O QUE SIGNIFICA
Explicação em linguagem clara (2-3 frases).

## IMPACTO NO CASO
Como este andamento afeta a estratégia.

## PRÓXIMA AÇÃO OBRIGATÓRIA
O que o advogado deve fazer agora (seja específico).

## URGENTE: Sim | Não
Há prazo ou providência imediata necessária?

## PRAZO
Se houver prazo, quando vence e qual a base legal do prazo.

## BASE LEGAL
Dispositivo que fundamenta a providência.`;

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const texto = resp.content[0].type === "text" ? resp.content[0].text : "";
  const urgente = /URGENTE:\s*Sim/i.test(texto);
  const prazo =
    texto.match(/## PRAZO\n([\s\S]*?)(?=\n##|$)/i)?.[1]?.trim() ?? null;
  const acao =
    texto
      .match(/## PRÓXIMA AÇÃO OBRIGATÓRIA\n([\s\S]*?)(?=\n##|$)/i)?.[1]
      ?.trim() ?? "";

  await sql`
    INSERT INTO cerebro_analises (processo_id, tipo, titulo, analise, metadata)
    VALUES (${processoId}::uuid, 'andamento', 'Interpretação de Andamento',
            ${texto}, ${JSON.stringify({ andamento_id: andamentoId, urgente, prazo })})
  `;

  return { interpretacao: texto, proximaAcao: acao, urgente, prazo };
}

// ─── 4. Aprender quando processo encerra ─────────────────────────────────────

export async function aprenderComResultado(
  processoId: string
): Promise<boolean> {
  const [processo] = await sql`
    SELECT p.*, c.cid_principal, c.tipo_incapacidade,
           c.num_contribuicoes, c.categoria_contribuinte,
           c.birth_date AS data_nascimento,
           c.name AS cliente_nome
    FROM processos p
    JOIN clients c ON p.client_id = c.id
    WHERE p.id = ${processoId}::uuid
  `;
  if (!processo) return false;

  const resultado =
    processo.resultado_admin ||
    processo.resultado_judicial ||
    processo.resultado;
  if (!resultado || processo.status !== "Concluída") return false;

  const [jaAprendeu] = await sql`
    SELECT id FROM cerebro_juridico WHERE processo_id = ${processoId}::uuid LIMIT 1
  `;
  if (jaAprendeu) return false;

  const [peticoes, andamentos] = await Promise.all([
    sql`SELECT titulo, tipo_peticao, aprovada FROM ia_peticoes WHERE processo_id = ${processoId}::uuid ORDER BY created_at`,
    sql`SELECT texto, tipo, data_referencia FROM historico_registros WHERE processo_id = ${processoId}::uuid ORDER BY data_referencia`,
  ]);

  const resultLower = String(resultado).toLowerCase();
  const resultNorm =
    resultLower.includes("defer") && !resultLower.includes("indeferid")
      ? resultLower.includes("parcial")
        ? "parcialmente_deferido"
        : "deferido"
      : "indeferido";

  const idadeCliente = processo.data_nascimento
    ? Math.floor(
        (Date.now() - new Date(processo.data_nascimento).getTime()) /
          31_557_600_000
      )
    : null;

  const diasResolucao =
    processo.data_distribuicao && processo.data_resultado_admin
      ? Math.floor(
          (new Date(processo.data_resultado_admin).getTime() -
            new Date(processo.data_distribuicao).getTime()) /
            86_400_000
        )
      : null;

  const prompt = `${BASE_LEGAL}

CASO ENCERRADO — EXTRAÇÃO DE APRENDIZADO JURÍDICO

Processo: ${processo.tipo_acao || "N/A"} | Área: ${processo.area || "N/A"}
Vara: ${processo.vara || "N/A"} | Comarca: ${processo.comarca || "N/A"}
RESULTADO FINAL: ${resultado}
Motivo indeferimento: ${processo.motivo_indeferimento || "N/A"}
Tempo de resolução: ${diasResolucao ? `${diasResolucao} dias` : "N/A"}

PERFIL DO CLIENTE:
Idade: ${idadeCliente ? `${idadeCliente} anos` : "N/A"} | CID: ${processo.cid_principal || "N/A"}
Incapacidade: ${processo.tipo_incapacidade || "N/A"} | Contribuições: ${processo.num_contribuicoes ?? "N/A"}
Categoria: ${processo.categoria_contribuinte || "N/A"}

PETIÇÕES UTILIZADAS (${peticoes.length}):
${
  peticoes
    .slice(0, 4)
    .map((p) => `[${p.tipo_peticao}]${p.aprovada ? " ✅" : ""} ${p.titulo}`)
    .join("\n") || "Nenhuma"
}

PRINCIPAIS ANDAMENTOS (${andamentos.length}):
${andamentos
  .slice(0, 6)
  .map(
    (a) =>
      `[${a.data_referencia || ""}] ${String(a.texto || "").substring(0, 100)}`
  )
  .join("\n")}

TAREFA: Extraia os aprendizados deste caso para melhorar casos futuros.

Responda SOMENTE o JSON abaixo (sem markdown, sem texto fora do JSON):
{
  "argumentos_vencedores": ["arg específico 1", "arg 2"],
  "erros_cometidos": ["erro específico 1"],
  "teses_utilizadas": ["tese jurídica com base legal 1", "tese 2"],
  "licao": "uma frase: o principal aprendizado",
  "resumo_aprendizado": "parágrafo completo do que funcionou ou não",
  "pontos_chave": ["ponto 1", "ponto 2", "ponto 3"],
  "perfil_caso": "descrição do perfil de caso ideal para este tipo de ação"
}`;

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const texto = resp.content[0].type === "text" ? resp.content[0].text : "{}";
  let ap: {
    argumentos_vencedores?: string[];
    erros_cometidos?: string[];
    teses_utilizadas?: string[];
    licao?: string;
    resumo_aprendizado?: string;
    pontos_chave?: string[];
    perfil_caso?: string;
  } = {};
  try {
    const m = texto.match(/\{[\s\S]+\}/);
    if (m) ap = JSON.parse(m[0]);
  } catch {
    ap = {
      licao: resultado,
      resumo_aprendizado: texto.substring(0, 500),
    };
  }

  await sql`
    INSERT INTO cerebro_juridico (
      processo_id, tipo_acao, area, vara, comarca, resultado_final, motivo_indeferimento,
      argumentos_vencedores, erros_cometidos, teses_utilizadas,
      licao, resumo_aprendizado, pontos_chave, perfil_caso, tempo_resolucao_dias
    ) VALUES (
      ${processoId}::uuid,
      ${processo.tipo_acao || ""},
      ${processo.area || "Previdenciário"},
      ${processo.vara ?? null},
      ${processo.comarca ?? null},
      ${resultNorm},
      ${processo.motivo_indeferimento ?? null},
      ${ap.argumentos_vencedores || []},
      ${ap.erros_cometidos || []},
      ${ap.teses_utilizadas || []},
      ${ap.licao || ""},
      ${ap.resumo_aprendizado || ""},
      ${ap.pontos_chave || []},
      ${JSON.stringify({
        cid: processo.cid_principal,
        idade: idadeCliente,
        contribuicoes: processo.num_contribuicoes,
        perfil: ap.perfil_caso,
      })},
      ${diasResolucao}
    )
  `;

  if (resultNorm === "deferido") {
    for (const tese of (ap.teses_utilizadas || []).slice(0, 3)) {
      const [exist] = await sql`
        SELECT id FROM cerebro_teses
        WHERE tipo_acao ILIKE ${`%${processo.tipo_acao || ""}%`}
          AND titulo ILIKE ${`%${String(tese).substring(0, 40)}%`}
        LIMIT 1
      `;
      if (exist) {
        await sql`
          UPDATE cerebro_teses
          SET vezes_aplicada = vezes_aplicada + 1,
              vezes_venceu   = vezes_venceu   + 1,
              taxa_sucesso   = ROUND(((vezes_venceu+1)::numeric / (vezes_aplicada+1)) * 100, 1)
          WHERE id = ${exist.id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO cerebro_teses
            (titulo, tese, area, tipo_acao, taxa_sucesso, vezes_aplicada, vezes_venceu)
          VALUES (
            ${String(tese).substring(0, 100)}, ${String(tese)},
            ${processo.area || "Previdenciário"}, ${processo.tipo_acao || ""},
            100, 1, 1
          )
        `;
      }
    }
  }

  console.log(
    `[CerebroJuridico] ✅ Aprendizado: processo ${processoId} → ${resultNorm}`
  );
  return true;
}

// ─── 5. Contexto enriquecido para petições ───────────────────────────────────

export async function gerarContextoPeticao(
  processoId: string,
  tipoPeticao: string
): Promise<string> {
  const [processo] = await sql`
    SELECT p.*, c.name AS cliente_nome, c.birth_date AS data_nascimento,
           c.cid_principal, c.tipo_incapacidade, c.num_contribuicoes,
           c.nis, c.atividade_anterior, c.data_diagnostico, c.data_afastamento
    FROM processos p
    JOIN clients c ON p.client_id = c.id
    WHERE p.id = ${processoId}::uuid
    LIMIT 1
  `;
  if (!processo) return "";

  return obterContextoCerebro(
    processo.tipo_acao || tipoPeticao,
    processo.area || "Previdenciário"
  );
}
