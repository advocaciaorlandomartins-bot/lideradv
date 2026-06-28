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

// ─── Tipos estruturados ──────────────────────────────────────────────────────

export interface DadoFaltante {
  campo: string;
  prioridade: "alta" | "media" | "baixa";
  impacto: string;
}

export interface AlertaJuridico {
  tipo: "prescricao" | "decadencia" | "dcb_vencida" | "prazo_recurso";
  nivel: "critico" | "atencao";
  mensagem: string;
  base_legal: string;
}

export interface MetadadosCerebro {
  completude_pct: number;
  dados_faltantes: DadoFaltante[];
  alertas: AlertaJuridico[];
  modo_especializado: string;
  tarefa_criada: boolean;
  beneficio_provavel?: string;
  estrategia_recomendada?: string;
}

// ─── Helpers de análise (server-side, sem IA) ────────────────────────────────

const CAMPOS_CRITICOS: Array<{
  campo: string;
  label: string;
  peso: number;
  prioridade: DadoFaltante["prioridade"];
  impacto: string;
}> = [
  {
    campo: "tipo_acao",
    label: "Tipo de ação / benefício",
    peso: 15,
    prioridade: "alta",
    impacto: "Define qual benefício requerer e a tese principal",
  },
  {
    campo: "cid_principal",
    label: "CID Principal",
    peso: 12,
    prioridade: "alta",
    impacto: "Obrigatório para perícia médica e reconhecimento de incapacidade",
  },
  {
    campo: "der",
    label: "DER (Data de Entrada do Requerimento)",
    peso: 10,
    prioridade: "alta",
    impacto:
      "Determina o termo inicial do benefício e cálculo de parcelas atrasadas",
  },
  {
    campo: "num_contribuicoes",
    label: "Número de contribuições (carência)",
    peso: 10,
    prioridade: "alta",
    impacto:
      "Sem isso é impossível saber se o cliente tem direito ao benefício",
  },
  {
    campo: "relato",
    label: "Relato detalhado do caso",
    peso: 8,
    prioridade: "alta",
    impacto: "Fundamenta a tese jurídica e petição inicial",
  },
  {
    campo: "data_afastamento",
    label: "Data do afastamento do trabalho",
    peso: 8,
    prioridade: "alta",
    impacto: "Marco inicial da incapacidade — essencial para B31/B32/B93",
  },
  {
    campo: "categoria_contribuinte",
    label: "Categoria do contribuinte",
    peso: 7,
    prioridade: "media",
    impacto: "Define regras de carência e período de graça aplicáveis",
  },
  {
    campo: "resultado_admin",
    label: "Resultado administrativo INSS",
    peso: 7,
    prioridade: "media",
    impacto:
      "Informa se houve negativa e qual o fundamento — direciona estratégia judicial",
  },
  {
    campo: "atividade_anterior",
    label: "Atividade profissional anterior",
    peso: 6,
    prioridade: "media",
    impacto:
      "Necessário para qualificação profissional e aposentadoria especial",
  },
  {
    campo: "nis",
    label: "NIS/PIS do cliente",
    peso: 5,
    prioridade: "media",
    impacto: "Necessário para consulta CNIS e requerimentos BPC/LOAS",
  },
  {
    campo: "protocolo_inss",
    label: "Protocolo INSS",
    peso: 4,
    prioridade: "baixa",
    impacto: "Comprova protocolo administrativo e data do requerimento",
  },
  {
    campo: "data_distribuicao",
    label: "Data de distribuição judicial",
    peso: 3,
    prioridade: "baixa",
    impacto: "Para processos judiciais — controle de prazos processuais",
  },
];

function calcularCompletude(processo: Record<string, unknown>): {
  pct: number;
  faltantes: DadoFaltante[];
} {
  const totalPeso = CAMPOS_CRITICOS.reduce((acc, c) => acc + c.peso, 0);
  let preenchido = 0;
  const faltantes: DadoFaltante[] = [];

  for (const def of CAMPOS_CRITICOS) {
    const valor = processo[def.campo];
    const preencheu =
      valor !== null &&
      valor !== undefined &&
      String(valor).trim() !== "" &&
      String(valor) !== "0";
    if (preencheu) {
      preenchido += def.peso;
    } else {
      faltantes.push({
        campo: def.label,
        prioridade: def.prioridade,
        impacto: def.impacto,
      });
    }
  }

  return { pct: Math.round((preenchido / totalPeso) * 100), faltantes };
}

function calcularAlertas(processo: Record<string, unknown>): AlertaJuridico[] {
  if ((processo.area as string)?.toLowerCase() !== "previdenciário") return [];

  const alertas: AlertaJuridico[] = [];
  const hoje = new Date();

  // Decadência de revisão administrativa — Art. 103 caput Lei 8.213/91
  if (processo.der) {
    const der = new Date(processo.der as string);
    const anos = (hoje.getTime() - der.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (anos >= 8.5) {
      const mesesRestantes = Math.max(0, Math.ceil((10 - anos) * 12));
      alertas.push({
        tipo: "decadencia",
        nivel: anos >= 9.5 ? "critico" : "atencao",
        mensagem:
          anos >= 10
            ? `DECADÊNCIA POSSIVELMENTE CONSUMADA: Revisão administrativa vence 10 anos após a DER (${der.toLocaleDateString("pt-BR")}). Verificar imediatamente.`
            : `ALERTA DECADÊNCIA: Revisão administrativa vence em ~${mesesRestantes} meses (DER: ${der.toLocaleDateString("pt-BR")}). Agilizar protocolo.`,
        base_legal: "Art. 103 caput da Lei 8.213/91 — decadência decenal",
      });
    }
  }

  // Prescrição quinquenal de parcelas — Art. 103, §1° Lei 8.213/91
  if (processo.der) {
    const der = new Date(processo.der as string);
    const anos = (hoje.getTime() - der.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (anos >= 5) {
      const dataCorte = new Date(
        hoje.getTime() - 5 * 365.25 * 24 * 3600 * 1000
      );
      alertas.push({
        tipo: "prescricao",
        nivel: "atencao",
        mensagem: `PRESCRIÇÃO QUINQUENAL: Parcelas anteriores a ${dataCorte.toLocaleDateString("pt-BR")} estão prescritas. Parcelas de ${Math.floor(anos - 5)} ano(s) perdidas. Ajuizar o quanto antes.`,
        base_legal: "Art. 103, §1° da Lei 8.213/91 — prescrição quinquenal",
      });
    }
  }

  // DCB vencida — benefício cessado
  if (processo.dcb) {
    const dcb = new Date(processo.dcb as string);
    const dias = Math.floor(
      (hoje.getTime() - dcb.getTime()) / (24 * 3600 * 1000)
    );
    if (dias > 0) {
      alertas.push({
        tipo: "dcb_vencida",
        nivel: dias > 60 ? "critico" : "atencao",
        mensagem: `BENEFÍCIO CESSADO há ${dias} dias (DCB: ${dcb.toLocaleDateString("pt-BR")}). ${dias > 60 ? "Ação de restabelecimento urgente." : "Verificar recurso administrativo ou judicial."}`,
        base_legal:
          "Art. 62 da Lei 8.213/91 — cessação por alta médica indevida",
      });
    }
  }

  return alertas;
}

function detectarModo(tipoAcao: string): string {
  const t = (tipoAcao || "").toLowerCase();
  if (t.includes("bpc") || t.includes("loas") || t.includes("assistencial"))
    return "BPC/LOAS";
  if (
    t.includes("especial") ||
    t.includes("insalubr") ||
    t.includes("periculosidade") ||
    t.includes("agente nocivo")
  )
    return "Aposentadoria Especial";
  if (
    t.includes("rural") ||
    t.includes("segurado especial") ||
    t.includes("lavrador") ||
    t.includes("pescador") ||
    t.includes("garimpeiro")
  )
    return "Trabalhador Rural";
  if (
    t.includes("individual") ||
    t.includes("autônom") ||
    t.includes("mei") ||
    t.includes("microempreend")
  )
    return "Contribuinte Individual";
  if (
    t.includes("pensão") ||
    t.includes("morte") ||
    t.includes("b-21") ||
    t.includes("b21")
  )
    return "Pensão por Morte";
  if (
    t.includes("maternidade") ||
    t.includes("gestante") ||
    t.includes("b-80") ||
    t.includes("b80")
  )
    return "Salário-Maternidade";
  if (t.includes("acidente") && !t.includes("aposentadoria"))
    return "Auxílio-Acidente";
  if (
    t.includes("invalidez") ||
    t.includes("incapacidade permanente") ||
    t.includes("b-32") ||
    t.includes("b32") ||
    t.includes("b-92") ||
    t.includes("b92")
  )
    return "Aposentadoria por Incapacidade";
  if (
    t.includes("b-31") ||
    t.includes("b31") ||
    t.includes("auxílio") ||
    t.includes("incapacidade temporária")
  )
    return "Auxílio por Incapacidade";
  if (t.includes("tempo") && t.includes("contribuição"))
    return "Aposentadoria por Tempo de Contribuição";
  if (t.includes("idade")) return "Aposentadoria por Idade";
  return "Geral Previdenciário";
}

function promptModoEspecializado(modo: string): string {
  switch (modo) {
    case "BPC/LOAS":
      return `\n═══ MODO ESPECIALIZADO: BPC/LOAS ═══
• Critério renda: STF ampliou para miserabilidade real (Tema 995 STF, ADPF 182)
• Deficiência: modelo biopsicossocial (Lei 13.146/2015 — EPCD); perícia ICF
• Sem carência contributiva — qualquer pessoa com deficiência ou idoso (65+) pode ter direito
• Idoso: 65 anos (Lei 8.742/93, art. 20, §2°)
• Documentos críticos: laudo médico ICF, composição familiar, declaração de renda
• TNU Súmula 54: miserabilidade vai além do critério renda per capita`;
    case "Trabalhador Rural":
      return `\n═══ MODO ESPECIALIZADO: TRABALHADOR RURAL ═══
• Prova material + testemunhos (TNU Súmulas 9 e 47) — sem prova material não há direito
• Carência reduzida (art. 26, II da Lei 8.213/91) — período de graça art. 15
• Documentos: ITR, bloco produtor, declaração sindicato rural, contrato arrendamento, fotos
• Comprovação deve ser habitual e contemporânea ao período reivindicado
• Segurado especial: art. 11, VII da Lei 8.213/91`;
    case "Aposentadoria Especial":
      return `\n═══ MODO ESPECIALIZADO: APOSENTADORIA ESPECIAL ═══
• PPP + LTCAT obrigatórios (TNU Súmula 33) — sem ambos não prospera
• Exposição habitual, permanente e não ocasional a agentes nocivos (TNU Súmula 10)
• 15 anos: agentes biológicos e químicos perigosos / 20 anos: alguns agentes químicos / 25 anos: ruído, calor, frio
• Dec. 3.048/99, arts. 64-70 + Anexos IV — lista oficial de agentes nocivos
• Conversão de tempo especial em comum é possível`;
    case "Contribuinte Individual":
      return `\n═══ MODO ESPECIALIZADO: CONTRIBUINTE INDIVIDUAL ═══
• Verificar recolhimentos GPS no CNIS — autônomos frequentemente têm lacunas
• Recolhimento em atraso possível (art. 27-A Lei 8.213/91 + Dec. 3.048/99 art. 161) com juros e multa
• Carência: apenas contribuições efetivamente recolhidas contam
• MEI: benefícios limitados ao salário mínimo (exceto por incapacidade com adicional de 25%)
• Atenção ao período de graça: 12 a 36 meses (art. 15 Lei 8.213/91)`;
    case "Pensão por Morte":
      return `\n═══ MODO ESPECIALIZADO: PENSÃO POR MORTE ═══
• Sem carência (art. 26, I Lei 8.213/91) — mas qualidade de segurado é obrigatória na data do óbito
• Dependentes: cônjuge/companheiro (dependência presumida), filhos até 21 anos ou inválidos
• Prova de união estável: documentos demonstrando convivência pública, contínua e duradoura
• DIB: data do óbito (se requerida em até 90 dias) ou data do requerimento
• EC 103/2019: novas regras para % de rateio (cotas percentuais por número de dependentes)`;
    case "Salário-Maternidade":
      return `\n═══ MODO ESPECIALIZADO: SALÁRIO-MATERNIDADE ═══
• Empregada CLT: até o teto do INSS — pago pelo INSS e compensado pelo empregador
• Contribuinte individual/avulsa: 1 contribuição em dia + carência 10 (TNU Súmula 77)
• Desempregada: mantém direito dentro do período de graça (TNU Súmula 63)
• Carência: 10 contribuições para individual (art. 25, III Lei 8.213/91)
• DIB: data do parto, adoção ou guarda judicial`;
    case "Auxílio por Incapacidade":
      return `\n═══ MODO ESPECIALIZADO: AUXÍLIO POR INCAPACIDADE TEMPORÁRIA (B31) ═══
• Carência: 12 contribuições (art. 25, I Lei 8.213/91) — exceções art. 26, II (doenças graves)
• Qualidade de segurado: verificar período de graça (art. 15)
• Carência dispensada: acidente de trabalho, lista doenças graves (art. 26, II)
• Incapacidade > 2 anos: conversão em B32 (Aposentadoria por Incapacidade) — avaliação pericial
• DCB indevida: recurso no CRPS ou mandado de segurança`;
    default:
      return "";
  }
}

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

  // ── Cálculos server-side (sem IA, instantâneos) ──────────────────────────
  const modo = detectarModo(String(processo.tipo_acao || ""));
  const { pct: completudePct, faltantes } = calcularCompletude(
    processo as Record<string, unknown>
  );
  const alertas = calcularAlertas(processo as Record<string, unknown>);

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
Completude dos dados: ${completudePct}%${completudePct < 70 ? " — INCOMPLETO" : ""}

MÓDULO 1 — CLIENTE E ESPÉCIE DE SEGURADO:
Nome: ${processo.cliente_nome}
Idade: ${idadeCliente ? `${idadeCliente} anos` : "Não informada"}
Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}
Atividade anterior: ${processo.atividade_anterior || "Não informada"}
NIS/PIS: ${processo.nis || "Não informado"}
Carência verificada: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}
Nº contribuições: ${processo.num_contribuicoes ?? "Não informado"}

MÓDULO 2 — INCAPACIDADE E DOCUMENTAÇÃO MÉDICA:
CID Principal: ${processo.cid_principal || "Não informado"}
Tipo de incapacidade: ${processo.tipo_incapacidade || "Não informado"}
Data do diagnóstico: ${processo.data_diagnostico || "Não informada"}
Data do afastamento: ${processo.data_afastamento || "Não informada"}

MÓDULO 3 — DADOS ADMINISTRATIVOS E PRAZOS:
DER: ${processo.der || "Não informado"}
DIB: ${processo.dib || "N/A"} | DCB: ${processo.dcb || "N/A"}
Protocolo INSS: ${processo.protocolo_inss || "N/A"} | Agência: ${processo.agencia_inss || "N/A"}
Resultado administrativo: ${processo.resultado_admin || "Pendente"}
Motivo indeferimento: ${processo.motivo_indeferimento || "N/A"}
Nº benefício concedido: ${processo.num_beneficio_concedido || "N/A"}
${alertas.length > 0 ? `\n⚠️ ALERTAS JURÍDICOS DETECTADOS:\n${alertas.map((a) => `• [${a.nivel.toUpperCase()}] ${a.mensagem} — ${a.base_legal}`).join("\n")}` : ""}

MÓDULO 4 — RELATO DO CASO:
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

DADOS FALTANTES (${faltantes.filter((f) => f.prioridade === "alta").length} críticos):
${faltantes.map((f) => `• [${f.prioridade.toUpperCase()}] ${f.campo}`).join("\n") || "Nenhum — dados completos"}

Data da análise: ${new Date().toLocaleDateString("pt-BR")}
`;

  const prompt = `${BASE_LEGAL}
${promptModoEspecializado(modo)}
${contexto}

TAREFA: Análise jurídica completa, estruturada em módulos, para este caso.

${dadosProcesso}

Responda com os cabeçalhos exatos abaixo:

## AVALIAÇÃO GERAL
Síntese em 3-4 frases diretivas. Identifique o perfil do segurado e o benefício mais pertinente.

## MÓDULO: ESPÉCIE DE SEGURADO
Classifique: empregado / autônomo / rural / avulso / doméstico / segurado especial. Verifique qualidade de segurado e período de graça aplicável (art. 15 Lei 8.213/91).

## MÓDULO: BENEFÍCIO MAIS PROVÁVEL
Indique a espécie com maior probabilidade de êxito, cite o código B (B31, B32, B87, B93, etc.) e o artigo aplicável.

## MÓDULO: ESTRATÉGIA — Administrativo | Judicial | Ambos
Recomende a via com justificativa. Se já houve negativa INSS, indique se cabe recurso CRPS ou ação judicial.

## PONTOS FORTES
Liste com base legal específica (cite artigo, lei, súmula).

## PONTOS FRACOS E RISCOS
Liste vulnerabilidades jurídicas e lacunas probatórias que podem comprometer o caso.

## TESE PRINCIPAL RECOMENDADA
A estratégia jurídica mais forte para este caso, com fundamento legal.

## BASE LEGAL APLICÁVEL
Artigos, súmulas e precedentes diretamente aplicáveis a este caso.

## DOCUMENTOS QUE FALTAM
Ordene por prioridade: crítico / importante / complementar.

## PRÓXIMA AÇÃO IMEDIATA
Uma ação específica e prática para executar AGORA. Ex: "Solicitar CNIS atualizado ao cliente" ou "Protocolar recurso CRPS antes de [data]".

## PROBABILIDADE DE ÊXITO: XX%
Justifique com base nos dados disponíveis.

## RISCO GERAL: Alto | Médio | Baixo
`;

  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3500,
    messages: [{ role: "user", content: prompt }],
  });

  const analise = resp.content[0].type === "text" ? resp.content[0].text : "";

  // ── Extrair campos estruturados ───────────────────────────────────────────
  const riscoMatch = analise.match(/RISCO GERAL[:\s*]+(\w+)/i);
  const probMatch = analise.match(/PROBABILIDADE DE ÊXITO[:\s*]+(\d+)/i);
  const acaoMatch = analise.match(
    /## PRÓXIMA AÇÃO IMEDIATA\n([\s\S]*?)(?=\n##|$)/i
  );
  const beneficioMatch = analise.match(
    /## MÓDULO: BENEFÍCIO MAIS PROVÁVEL\n([\s\S]*?)(?=\n##|$)/i
  );
  const estrategiaMatch = analise.match(
    /## MÓDULO: ESTRATÉGIA[^\n]*\n([\s\S]*?)(?=\n##|$)/i
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
    acaoMatch?.[1]?.trim().split("\n")[0] ||
    "Verificar documentação com cliente";
  const beneficioProvavel =
    beneficioMatch?.[1]?.trim().split("\n")[0] || undefined;
  const estrategiaRecomendada =
    estrategiaMatch?.[1]?.trim().split("\n")[0] || undefined;

  const baseLegal = [
    ...analise.matchAll(
      /(?:art(?:igo)?\.?\s*\d+[\w\-]*|Súmula\s+\d+\s+(?:TNU|STJ|STF|TRF\d*)|Tema\s+\d+|Lei\s+[\d.\/]+)/gi
    ),
  ]
    .map((m) => m[0])
    .slice(0, 15);

  // ── Criar tarefa automática (uma por processo, apenas se não existir) ─────
  let tarefaCriada = false;
  try {
    const [tarefaExistente] = await sql`
      SELECT id FROM tarefas_processo
      WHERE processo_id = ${processoId}::uuid
        AND status NOT IN ('Concluída', 'Cancelada')
        AND comentarios ILIKE '%Cérebro Jurídico%'
      LIMIT 1
    `;
    if (!tarefaExistente) {
      const prioridadeTarefa =
        risco === "alto" ? "Alta" : risco === "medio" ? "Média" : "Normal";
      await sql`
        INSERT INTO tarefas_processo
          (processo_id, client_id, titulo, prioridade, comentarios)
        VALUES (
          ${processoId}::uuid,
          ${processo.client_id}::uuid,
          ${proximaAcao.substring(0, 200)},
          ${prioridadeTarefa},
          ${"✅ Criada automaticamente pelo Cérebro Jurídico em " + new Date().toLocaleDateString("pt-BR")}
        )
      `;
      tarefaCriada = true;
    }
  } catch {
    // tarefa é bônus — não pode interromper o fluxo
  }

  // ── Salvar com metadata enriquecida ───────────────────────────────────────
  const metadata: MetadadosCerebro = {
    completude_pct: completudePct,
    dados_faltantes: faltantes,
    alertas,
    modo_especializado: modo,
    tarefa_criada: tarefaCriada,
    beneficio_provavel: beneficioProvavel,
    estrategia_recomendada: estrategiaRecomendada,
  };

  await sql`
    INSERT INTO cerebro_analises
      (processo_id, tipo, titulo, analise, risco, probabilidade_sucesso,
       proxima_acao, base_legal, metadata)
    VALUES (
      ${processoId}::uuid, 'inicial',
      ${"Análise — " + modo},
      ${analise}, ${risco}, ${prob}, ${proximaAcao}, ${baseLegal},
      ${JSON.stringify(metadata)}
    )
  `;

  return {
    analise,
    risco,
    probabilidadeSucesso: prob,
    proximaAcao,
    baseLegal,
    metadata,
  };
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
