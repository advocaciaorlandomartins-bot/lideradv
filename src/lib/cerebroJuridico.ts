import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";

function getClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  return new Anthropic({ apiKey });
}

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

IN PRES/INSS 128/2022 (alterada pela IN 188/2025):
• Art. 200, §4°: isenção de carência ao salário-maternidade aplicada a requerimentos a partir de 05/04/2024 e aos pendentes de análise, independentemente da data do fato gerador

════════════════════════════════════════════════
SALÁRIO-MATERNIDADE SEM CARÊNCIA (2024-2025)
════════════════════════════════════════════════

• ADIs 2.110 e 2.111 (STF, 21/03/2024): INCONSTITUCIONAL a exigência de carência (art. 25, III, Lei 8.213/91) — viola isonomia
• ÚNICO REQUISITO: ter qualidade de segurado na data do parto/adoção
• Partos anteriores a 05/04/2024: regra retroativa, desde que dentro do prazo de 5 anos (prescrição quinquenal)
• Indeferimentos anteriores: podem ser reabertos; coisa julgada anterior NÃO é empecilho (RE 586.068, Tema 100 STF)
• DEFERIMENTO AUTOMÁTICO no INSS desde 05/04/2024 para qualquer segurada com qualidade de segurado

Enunciado 19 CRPS (Resolução 13, 27/08/2025 — DOU 08/09/2025):
• Contribuinte individual: provar exercício de atividade remunerada + ao menos 1 contribuição (GPS 1163 mensal / 1180 trimestral, 11%)
  - Se não comprovar atividade → enquadrar como SEGURADO FACULTATIVO (sem precisar provar atividade)
• Segurado facultativo: apenas comprovar pagamento da contribuição (GPS 1473 mensal / 1490 trimestral, 11%)
• Segurada especial (rural): NÃO precisa de carência nem contribuição — apenas 1 documento rural anterior ao fato gerador (Ofício Circular 63/2025)
• NÃO USAR alíquota de 5% (baixa renda) — risco de não validação pelo INSS; sempre 11%
• Recolhimento trimestral: JAN-MAR (vence 15/abr), ABR-JUN (vence 15/jul), JUL-SET (vence 15/out), OUT-DEZ (vence 15/jan)
• Atividades concomitantes (2 salários-maternidade): empregada+autônoma, empregada+MEI — NÃO: empregada+facultativa

Ofício Circular 63/2025/DIRBEN-INSS (17/07/2025):
• Segurada especial: basta 1 instrumento ratificador anterior ao fato gerador (nascimento/adoção/guarda)
• Revogou Ofício 46/2019 — antes exigia documento anterior à data presumida da gravidez

TNU Tema 11: Flexibilização da exigência de prova material contemporânea para segurada especial (salário-maternidade)

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
• Súmula 77: SUPERADA pela ADI 2.110 (STF 2024) — carência de 10 contribuições para individual não se aplica mais
• Tema 173 TNU: BPC — impedimento de longo prazo pode ser reconhecido de forma prospectiva (após a DER)
• Tema 185 TNU: BPC — análise de miserabilidade dispensa nova perícia quando o INSS já reconheceu hipossuficiência
• Tema 192 TNU: recolhimento de GPS em atraso dentro do período de graça é válido para cômputo de carência
• Tema 220 TNU: gravidez de alto risco equipara-se a acidente de trabalho — dispensa de carência para B31
• Tema 285 TNU: segurado facultativo de baixa renda — requisitos para recolhimento a 5% (alíquota reduzida)
• Tema 300 TNU: mantém qualidade de segurado quando empregador se recusa a aceitar trabalhador após alta do INSS
• Tema 301 TNU: vínculos urbanos intercalados não descaracterizam a condição de segurado especial rural
• Tema 315 TNU: auxílio-acidente independe de pedido específico quando há sequela após cessação do B31
• Tema 327 TNU: documentos em nome do cônjuge servem como início de prova material para segurado rural
• Tema 348 TNU: desemprego involuntário amplia período de graça de 12 para 24 meses (art. 15, §2°, Lei 8.213/91)

STJ:
• Tema 352: carência — cômputo de contribuições
• Súmula 548: correção de benefícios anteriores a 1988
• Tema 862 STJ: DIB do auxílio-acidente é o dia seguinte à cessação do auxílio-doença (B31)
• Tema 416 STJ: qualquer redução funcional permanente é suficiente para auxílio-acidente — irrelevante a extensão da sequela

STF:
• ADIs 2.110/2.111 (21/03/2024): carência para salário-maternidade inconstitucional
• RE 586.068 (Tema 100): coisa julgada de juizado especial revisável quando fundada em lei inconstitucional
• Tema 995: BPC — critério de renda não é absoluto (miserabilidade)
• RE 636.941: incapacidade — perícia biopsicossocial (ICF)
• ADPF 182: BPC — família de acolhimento
• ARE 930.647 AgR: precedente STF vinculante aplicável imediatamente, independente de publicação do paradigma

TRF5 / TJAL / TRT19 (Alagoas — sede do escritório):
• Jurisprudência local do TRF5 para benefícios por incapacidade
• TJAL para questões cíveis e de família
• TRT19 para demandas trabalhistas

════════════════════════════════════════════════
BPC/LOAS — FRAMEWORK BPC 360 (2025)
════════════════════════════════════════════════

Lei 13.982/2020 — Rendas EXCLUÍDAS do cálculo familiar BPC:
• BPC ou pensão por morte recebido pelo cônjuge/companheiro até 1 SM
• Rendimentos da própria pessoa com deficiência (quando membro da família)
• Bolsa Família e outros benefícios assistenciais eventuais
• Parcelas de programas federais de transferência de renda

Critério de miserabilidade holística (Tema 185 TNU + Súmula 54 TNU + ADPF 182):
• O critério ¼ SM per capita NÃO é absoluto — juiz deve considerar gastos com saúde, cuidador, medicamentos, habitação, dívidas
• Se o INSS já reconheceu hipossuficiência, nova perícia de renda é dispensável (Tema 185 TNU)
• CadÚnico atualizado reforça prova de hipossuficiência, mas a ausência não impede concessão

Impedimento de longo prazo (Tema 173 TNU):
• Pode ser reconhecido prospectivamente — laudo atual demonstrando cronificação ou progressão da doença
• Aplicável mesmo quando a data do laudo é posterior à DER

Estratégia PAP (Processo Administrativo Previdenciário):
• Priorizar resolução no INSS (Ofício Circular 46/19, IN 128/22) — mais rápido e economiza honorários
• Vínculo em aberto no CNIS é causa recorrente de indeferimento — verificar e resolver antes do protocolo
• Se indeferido: CRPS (recurso) em 30 dias; se mantido: ação judicial com perícia biopsicossocial

════════════════════════════════════════════════
BENEFÍCIOS POR INCAPACIDADE — FUNGIBILIDADE
════════════════════════════════════════════════

Regra de ouro (Súmula 47 TNU + prática do Prof. Frederico Martins):
• SEMPRE peticionar B31 com pedido SUBSIDIÁRIO de B32 — e vice-versa
• Se B32 negado mas há incapacidade parcial → pedir B31 como subsidiário
• Incluir B94 (auxílio-acidente) quando há sequela permanente pós-acidente/pós-B31

Auxílio-acidente (B94) — pontos críticos:
• Tema 862 STJ: DIB é o dia SEGUINTE à cessação do B31, automático
• Tema 315 TNU: dispensa pedido específico de B94 quando há sequela após B31
• Tema 416 STJ: qualquer redução funcional permanente basta — sem percentual mínimo

Incapacidade e qualidade de segurado:
• Tema 348 TNU: desemprego involuntário → período de graça de 12 → 24 meses
• Tema 192 TNU: GPS recolhida em atraso no período de graça conta para carência (art. 27-A LBPS)
• Tema 300 TNU: empregador que recusa retorno do reabilitado → qualidade de segurado mantida
• Gravidez de alto risco: Tema 220 TNU — carência dispensada (equiparada a acidente de trabalho)
• Neoplasia maligna: carência sempre dispensada (art. 26, II, Lei 8.213/91) — citar no diagnóstico

Revisão de RMI:
• Portaria MTP 87/2023: revisão de renda mensal inicial de aposentadoria por incapacidade concedida pré-EC 103/2019

Lei 15.156/2025: pensão por morte para genitores de vítimas da síndrome congênita do Zika vírus (B21)

════════════════════════════════════════════════
ALGORITMO DE RACIOCÍNIO (5 PASSOS — Prof. Frederico Martins)
════════════════════════════════════════════════

1. IDENTIFICAR VULNERABILIDADE: qual direito está sendo negado? Por qual razão o INSS indeferiu?
2. FILTRO DE ADMISSIBILIDADE: o cliente tem qualidade de segurado? Carência atingida? Prazo vigente?
3. SELECIONAR TESE: qual a tese mais forte — legal, jurisprudencial ou fática?
4. CONSTRUIR A PROVA: quais documentos provam a tese? O que ainda falta obter?
5. CALCULAR VIABILIDADE: probabilidade de êxito × honorários × esforço = decisão de aceitar o caso

════════════════════════════════════════════════
VOCABULÁRIO ESTRATÉGICO (Prof. Frederico Martins)
════════════════════════════════════════════════

• "Instrumento Ratificador": qualquer prova documental que confirma/corrobora um fato alegado
• "Blindagem Documental": estratégia de organizar o PAP de forma irrebatível — o INSS não tem margem para negar
• "Galinha dos Ovos de Ouro": o PAP bem-feito que gera honorários rápidos sem perícia judicial
• "Instrução Concentrada": resolver toda a prova de uma vez, focando na eficiência — mínimo de documentos, máximo de eficácia
• "Advocacia de Resultado": foco no dinheiro no bolso do cliente e honorários no bolso do advogado
• "Quesitos Estratégicos": perguntas feitas ao perito para "encurralar" a conclusão técnica — foco em incapacidade para a atividade HABITUAL, não apenas na doença
• "Fungibilidade Prática": pedir o melhor benefício, mas deixar a porta aberta para o subsidiário possível
• "Mundo Administrativo vs. Judicial": diferenciar as regras do INSS (IN 128/22, Ofícios) das regras da Justiça (CPC, Lei 9.099/95) — são sistemas diferentes com instrumentos diferentes

ESTRUTURA DE PETIÇÃO (estilo Prof. Frederico Martins):
• EMENTA: síntese do caso + tese principal em 2-3 linhas
• FATOS: fatos concretos e objetivos — sem juridiquês abstrato; foco na vulnerabilidade social
• DIREITO: base legal exata + jurisprudência mais recente do STF/STJ/TNU
• PEDIDOS: pedido principal + subsidiários fortes — sempre com fungibilidade

COMPORTAMENTO EM AUDIÊNCIA (Mestre em Audiência):
• Postura de Juiz: antecipar as perguntas que o juiz faria — pensar como magistrado
• Foco no Fato Concreto: "Onde o senhor dorme?", "Quem paga a luz?" — não juridiquês abstrato
• Respeito Institucional com Firmeza: citar a norma ao tratar com servidor/juiz ("Conforme o Ofício Circular nº...")

INDEFERIMENTOS — COMO REAGIR:
• Análise técnica imediata do ERRO DO SERVIDOR — não recorrer por recorrer
• Identificar qual Instrução Normativa ou Ofício Circular foi descumprido
• Apontar o descumprimento técnico específico — não a injustiça genérica

GUIA DE INJEÇÃO DE CONTEXTO (identificar antes de analisar):
• FATO GERADOR: o que aconteceu? (acidente, doença, desemprego, nascimento, óbito, revisão)
• STATUS QUO: em que fase está? (pré-protocolo / aguardando INSS / CRPS / JEF / TRF5)
• PROVA RAINHA: qual o documento mais forte que já existe?
• OBJETIVO MESTRE: qual o resultado esperado? (deferimento, revisão de valor, restabelecimento, retroatividade)

════════════════════════════════════════════════
BPC/LOAS — REGRAS ADICIONAIS (2021-2025)
════════════════════════════════════════════════

Lei 14.126/2021: visão monocular classificada como DEFICIÊNCIA SENSORIAL (tipo visual) para todos os efeitos legais, inclusive BPC
STF Tema 27: repetitório geral sobre BPC — renda per capita ¼ SM pode ser relativizada
STF Tema 312: exclusão de benefícios de renda mínima e transferência de renda do cálculo da renda familiar BPC
Art. 20, §11-A, Lei 8.742/93: autoriza considerar gastos com saúde, medicamentos e cuidador para fins de aferição de miserabilidade
Art. 20-B, Lei 8.742/93: critérios adicionais de flexibilização da renda familiar per capita
Art. 4°, §1°, Decreto 6.214/07: menor de 16 anos com deficiência pode receber BPC — impedimento de longo prazo é suficiente
Instituição de longa permanência: internação em abrigo/ILPI NÃO impede BPC — requisitos avaliados individualmente (Portaria Conjunta MDS 03/2018)
Deficiente mental/intelectual: NÃO precisa de interdição judicial para requerer BPC
CadÚnico: OBRIGATÓRIO para BPC — se desatualizado, atualizar na CRAS antes do requerimento; inscrição pode ser feita no mesmo dia

════════════════════════════════════════════════
AUDIÊNCIAS PREVIDENCIÁRIAS — FRAMEWORK
════════════════════════════════════════════════

Bases normativas: CPC arts. 358-368, Lei 9.099/95 arts. 27-29, Lei 10.259/01
Fases: 1) CONCILIAÇÃO (proposta INSS → proposta advogado → acordo ou sem acordo) | 2) INSTRUÇÃO (depoimento pessoal, oitiva testemunhas, perito) | 3) JULGAMENTO (oral/posterior)

Tipos mais comuns de audiência previdenciária:
• Segurado especial rural: Súmula 9 TNU — prova oral + material (documentos + testemunhos)
• Pensão por morte: prova de união estável ou dependência econômica
• Período de graça por desemprego involuntário: 24 meses (Tema 348 TNU + art. 15, §2°)
• Vínculos de emprego: CTPS + CNIS + testemunhos de ex-colegas
• Aposentadoria híbrida/tempo rural: prova de período remoto rural
• Benefícios por incapacidade: esclarecimentos do perito médico judicial
• BPC/LOAS: prova de renda familiar e deficiência

Testemunhas (CPC art. 455 + Lei 9.099/95 art. 34):
• Advogado DEVE levar as testemunhas — não depende de intimação (salvo pedido formal com 5 dias de antecedência)
• Máx. 3 testemunhas por parte (JEF)
• Impedidas: cônjuge/companheiro, ascendentes, descendentes, parentes até 3º grau (exceto interesse público ou quando for única prova)
• Suspeitas: inimigos ou amigos íntimos da parte, interesse no resultado
• Incapazes: interditados por saúde mental, menores de 16 anos, deficientes visuais/auditivos quando o fato depender do sentido que lhes falta
• Flexibilização (§4° e §5° CPC art. 447): juiz pode aceitar testemunho impedido/suspeito "sem compromisso"

Juntada de documentos na audiência: POSSÍVEL (aplicação subsidiária Lei 9.099/95 arts. 28-29)
Gravação da audiência pelo advogado: PERMITIDA (precedentes TRF1 e TRF6)
Alegações finais orais: o advogado DEVE falar em audiência — não é necessário aguardar prazo escrito
Sentença: imediata possível no JEF (art. 62 Lei 9.099/95) ou em até 30 dias (CPC art. 366)
Audiência telepresencial: a pedido da parte (Resolução CNJ 354/2020 + 481/2022); PID disponível para distantes (Resolução CNJ 508/2023, distância ≥40km, município ≤50mil hab.)
Pedido indeferido de audiência: CERCEAMENTO DE DEFESA → JEF: recurso inominado; VARA: agravo de instrumento (CPC art. 1.015)

CÁLCULOS:
• Teto INSS 2025: R$ 7.786,02
• Salário mínimo 2025: R$ 1.622,00
• GPS Salário-Maternidade (mensal, 11%): Facultativa=1473 (R$178,42), Individual=1163 (R$178,42), Especial Rural=1503 (20%, R$324,40)
• GPS Salário-Maternidade (trimestral, 11%): Facultativa=1490 (R$535,26), Individual=1180 (R$535,26), Especial Rural=1554 (20%, R$973,20)
• Fator previdenciário: aplicado a aposentadorias por tempo (EC 103/2019)
`;

// ─── Tipos estruturados ──────────────────────────────────────────────────────

export interface DadoFaltante {
  campo: string;
  prioridade: "alta" | "media" | "baixa";
  impacto: string;
}

export interface AlertaJuridico {
  tipo:
    | "prescricao"
    | "decadencia"
    | "dcb_vencida"
    | "prazo_recurso"
    | "processo_parado";
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

const CAMPOS_BPC: typeof CAMPOS_CRITICOS = [
  {
    campo: "tipo_acao",
    label: "Tipo de ação / benefício",
    peso: 15,
    prioridade: "alta",
    impacto: "Define o benefício BPC (B87/B88) e a tese principal",
  },
  {
    campo: "cid_principal",
    label: "CID Principal da deficiência",
    peso: 12,
    prioridade: "alta",
    impacto: "Obrigatório para reconhecimento do impedimento de longo prazo",
  },
  {
    campo: "relato",
    label: "Relato detalhado do caso e situação familiar",
    peso: 10,
    prioridade: "alta",
    impacto:
      "Fundamenta a miserabilidade e o impedimento funcional do requerente",
  },
  {
    campo: "nis",
    label: "NIS/PIS do cliente",
    peso: 10,
    prioridade: "alta",
    impacto: "Obrigatório para requerimento BPC e consulta CadÚnico",
  },
  {
    campo: "der",
    label: "DER (Data de Entrada do Requerimento)",
    peso: 8,
    prioridade: "alta",
    impacto: "Determina o termo inicial do BPC e cálculo de atrasados",
  },
  {
    campo: "resultado_admin",
    label: "Resultado administrativo INSS",
    peso: 7,
    prioridade: "media",
    impacto:
      "Informa se houve indeferimento e qual o fundamento — direciona estratégia",
  },
  {
    campo: "tipo_incapacidade",
    label: "Tipo de incapacidade / deficiência",
    peso: 7,
    prioridade: "media",
    impacto:
      "Classifica o impedimento (físico, mental, intelectual, sensorial) para ICF",
  },
  {
    campo: "protocolo_inss",
    label: "Protocolo INSS",
    peso: 4,
    prioridade: "baixa",
    impacto: "Comprova protocolo administrativo e data do requerimento",
  },
];

function isBPC(processo: Record<string, unknown>): boolean {
  const t = String(processo.tipo_acao || "").toLowerCase();
  return (
    t.includes("bpc") ||
    t.includes("loas") ||
    t.includes("assistencial") ||
    t.includes("b87") ||
    t.includes("b88")
  );
}

function isPensao(processo: Record<string, unknown>): boolean {
  const t = String(processo.tipo_acao || "").toLowerCase();
  return (
    t.includes("pensão") ||
    t.includes("pensao") ||
    t.includes("b21") ||
    t.includes("b22")
  );
}

function isMaternidade(processo: Record<string, unknown>): boolean {
  const t = String(processo.tipo_acao || "").toLowerCase();
  return (
    t.includes("maternidade") ||
    t.includes("b80") ||
    t.includes("b81") ||
    t.includes("b82")
  );
}

function isAposentadoria(processo: Record<string, unknown>): boolean {
  const t = String(processo.tipo_acao || "").toLowerCase();
  return (
    (t.includes("aposentadoria") && !t.includes("incapacidade")) ||
    t.includes("b41") ||
    t.includes("b42") ||
    t.includes("b57") ||
    t.includes("tempo de contribuição") ||
    t.includes("tempo de contribuicao") ||
    (t.includes("aposentadoria") &&
      (t.includes("idade") || t.includes("especial") || t.includes("tempo")))
  );
}

function isOperacional(processo: Record<string, unknown>): boolean {
  const t = String(processo.tipo_acao || "").toLowerCase();
  return (
    t.includes("cnis") ||
    t.includes("mandado de segurança") ||
    t.includes("mandado de seguranca") ||
    t.includes("pap ") ||
    t.includes("processo administrativo") ||
    t.includes("quesito") ||
    t.includes("audiência") ||
    t.includes("audiencia") ||
    t.includes("pente-fino") ||
    t.includes("pente fino") ||
    t.includes("sdr") ||
    t.includes("qualificação") ||
    t.includes("qualificacao") ||
    t.includes("captação") ||
    t.includes("captacao")
  );
}

const CAMPOS_PENSAO: typeof CAMPOS_CRITICOS = [
  {
    campo: "tipo_acao",
    label: "Tipo de ação / benefício",
    peso: 15,
    prioridade: "alta",
    impacto: "Define o tipo de pensão e os dependentes habilitados",
  },
  {
    campo: "relato",
    label:
      "Relato detalhado (qualidade de segurado do falecido + vínculo com dependente)",
    peso: 12,
    prioridade: "alta",
    impacto: "Fundamenta qualidade de segurado e dependência",
  },
  {
    campo: "der",
    label: "DER (Data de Entrada do Requerimento)",
    peso: 10,
    prioridade: "alta",
    impacto: "Pensão requerida em até 90 dias do óbito = DIB na data do óbito",
  },
  {
    campo: "resultado_admin",
    label: "Resultado administrativo INSS",
    peso: 8,
    prioridade: "alta",
    impacto: "Informa se foi indeferida e o fundamento — direciona estratégia",
  },
  {
    campo: "nis",
    label: "NIS/PIS do cliente (dependente)",
    peso: 7,
    prioridade: "media",
    impacto: "Necessário para requerimento administrativo",
  },
  {
    campo: "protocolo_inss",
    label: "Protocolo INSS",
    peso: 4,
    prioridade: "baixa",
    impacto: "Comprova o protocolo do requerimento",
  },
];

const CAMPOS_MATERNIDADE: typeof CAMPOS_CRITICOS = [
  {
    campo: "tipo_acao",
    label: "Tipo de ação / salário-maternidade",
    peso: 15,
    prioridade: "alta",
    impacto: "Define a espécie de segurada e o benefício aplicável",
  },
  {
    campo: "relato",
    label: "Relato detalhado (data do parto/adoção, tipo de segurada)",
    peso: 12,
    prioridade: "alta",
    impacto:
      "Fundamental para calcular DIB e carência (agora dispensada — ADI 2.110/2024)",
  },
  {
    campo: "der",
    label: "DER (Data de Entrada do Requerimento)",
    peso: 10,
    prioridade: "alta",
    impacto: "Requerimento até 90 dias do parto = DIB na data do parto",
  },
  {
    campo: "categoria_contribuinte",
    label: "Categoria da segurada (empregada/individual/especial/facultativa)",
    peso: 10,
    prioridade: "alta",
    impacto: "Define o valor do benefício e os requisitos aplicáveis",
  },
  {
    campo: "resultado_admin",
    label: "Resultado administrativo INSS",
    peso: 7,
    prioridade: "media",
    impacto: "Informa fundamento do indeferimento se houver",
  },
  {
    campo: "nis",
    label: "NIS/PIS da cliente",
    peso: 5,
    prioridade: "media",
    impacto: "Necessário para requerimento",
  },
];

const CAMPOS_APOSENTADORIA: typeof CAMPOS_CRITICOS = [
  {
    campo: "tipo_acao",
    label: "Tipo de aposentadoria (tempo/idade/especial)",
    peso: 15,
    prioridade: "alta",
    impacto:
      "Define os requisitos e a regra de transição aplicável (EC 103/2019)",
  },
  {
    campo: "num_contribuicoes",
    label: "Tempo de contribuição / carência",
    peso: 12,
    prioridade: "alta",
    impacto: "Requisito fundamental para todas as aposentadorias",
  },
  {
    campo: "relato",
    label: "Relato detalhado do caso",
    peso: 8,
    prioridade: "alta",
    impacto: "Fundamenta a tese e os pedidos subsidiários",
  },
  {
    campo: "der",
    label: "DER (Data de Entrada do Requerimento)",
    peso: 8,
    prioridade: "alta",
    impacto: "Determina o termo inicial e as regras de transição aplicáveis",
  },
  {
    campo: "categoria_contribuinte",
    label: "Categoria do contribuinte",
    peso: 7,
    prioridade: "alta",
    impacto: "Define regras de carência e período de graça aplicáveis",
  },
  {
    campo: "resultado_admin",
    label: "Resultado administrativo INSS",
    peso: 7,
    prioridade: "media",
    impacto: "Fundamento do indeferimento — direciona estratégia de recurso",
  },
  {
    campo: "atividade_anterior",
    label: "Atividade profissional (para aposentadoria especial)",
    peso: 5,
    prioridade: "media",
    impacto: "Necessário para aposentadoria especial por agentes nocivos",
  },
  {
    campo: "nis",
    label: "NIS/PIS do cliente",
    peso: 5,
    prioridade: "media",
    impacto: "Necessário para consulta CNIS e requerimento",
  },
  {
    campo: "protocolo_inss",
    label: "Protocolo INSS",
    peso: 4,
    prioridade: "baixa",
    impacto: "Comprova protocolo administrativo",
  },
];

const CAMPOS_OPERACIONAL: typeof CAMPOS_CRITICOS = [
  {
    campo: "tipo_acao",
    label: "Tipo de ação / demanda",
    peso: 20,
    prioridade: "alta",
    impacto: "Define o objeto e a estratégia a adotar",
  },
  {
    campo: "relato",
    label: "Relato detalhado da situação",
    peso: 15,
    prioridade: "alta",
    impacto: "Fundamenta a análise e as providências necessárias",
  },
  {
    campo: "der",
    label: "Data do protocolo / requerimento",
    peso: 10,
    prioridade: "alta",
    impacto: "Define prazo e urgência da demanda",
  },
  {
    campo: "resultado_admin",
    label: "Situação atual no INSS",
    peso: 10,
    prioridade: "alta",
    impacto: "Estado atual do processo administrativo",
  },
  {
    campo: "protocolo_inss",
    label: "Protocolo INSS / número do processo",
    peso: 8,
    prioridade: "media",
    impacto: "Permite rastrear e acompanhar a demanda",
  },
];

function calcularCompletude(processo: Record<string, unknown>): {
  pct: number;
  faltantes: DadoFaltante[];
} {
  let campos: typeof CAMPOS_CRITICOS;
  if (isBPC(processo)) campos = CAMPOS_BPC;
  else if (isPensao(processo)) campos = CAMPOS_PENSAO;
  else if (isMaternidade(processo)) campos = CAMPOS_MATERNIDADE;
  else if (isAposentadoria(processo)) campos = CAMPOS_APOSENTADORIA;
  else if (isOperacional(processo)) campos = CAMPOS_OPERACIONAL;
  else campos = CAMPOS_CRITICOS; // B31/B32/B91/B92/B93 e demais incapacidades
  const totalPeso = campos.reduce((acc, c) => acc + c.peso, 0);
  let preenchido = 0;
  const faltantes: DadoFaltante[] = [];

  for (const def of campos) {
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
        nivel: "critico",
        mensagem: `PRESCRIÇÃO QUINQUENAL EM CURSO: Parcelas anteriores a ${dataCorte.toLocaleDateString("pt-BR")} já estão prescritas. ${Math.floor(anos - 5)} ano(s) de parcelas perdidos. Ajuizar URGENTE para estancar a perda.`,
        base_legal: "Art. 103, §1° da Lei 8.213/91 — prescrição quinquenal",
      });
    } else if (anos >= 4) {
      const mesesAtePrescrever = Math.ceil((5 - anos) * 12);
      alertas.push({
        tipo: "prescricao",
        nivel: "atencao",
        mensagem: `ALERTA PRESCRIÇÃO: Em ~${mesesAtePrescrever} meses as primeiras parcelas começarão a prescrever (DER: ${new Date(processo.der as string).toLocaleDateString("pt-BR")}). Ajuizar antes que parcelas sejam perdidas.`,
        base_legal: "Art. 103, §1° da Lei 8.213/91 — prescrição quinquenal",
      });
    }
  }

  // Prazo de recurso CRPS — 30 dias do indeferimento (Art. 304, Dec. 3.048/99)
  if (processo.resultado_admin === "indeferido" && processo.der) {
    const der = new Date(processo.der as string);
    const diasDesdeDeR = Math.floor(
      (hoje.getTime() - der.getTime()) / (24 * 3600 * 1000)
    );
    if (diasDesdeDeR >= 1 && diasDesdeDeR <= 35) {
      const diasRestantes = 30 - diasDesdeDeR;
      alertas.push({
        tipo: "prazo_recurso",
        nivel: diasRestantes <= 5 ? "critico" : "atencao",
        mensagem:
          diasRestantes > 0
            ? `PRAZO RECURSO CRPS: ${diasRestantes} dia(s) restantes para interpor recurso administrativo (indeferido em ${der.toLocaleDateString("pt-BR")}).`
            : `PRAZO RECURSO CRPS POSSIVELMENTE VENCIDO: Verificar data exata da ciência do indeferimento — prazo de 30 dias para CRPS.`,
        base_legal: "Art. 304, Decreto 3.048/99 — recurso ao CRPS em 30 dias",
      });
    }
  }

  // Processo parado no INSS — Avanço Tático (45/90 dias sem resposta)
  // Fase Aceleração: 45 dias → Reabertura de Tarefa / Ouvidoria; 90 dias → MS
  if (
    processo.der &&
    (!processo.resultado_admin || processo.resultado_admin === "pendente") &&
    !processo.dcb
  ) {
    const der = new Date(processo.der as string);
    const dias = Math.floor(
      (hoje.getTime() - der.getTime()) / (24 * 3600 * 1000)
    );
    if (dias >= 90) {
      alertas.push({
        tipo: "processo_parado",
        nivel: "critico",
        mensagem: `PROCESSO PARADO HÁ ${dias} DIAS — MANDADO DE SEGURANÇA CABÍVEL: INSS descumpriu prazo legal (Lei 9.784/99, art. 24 — 90 dias). Preparar MS imediatamente para garantir análise em 30 dias. Blindagem: protocolo INSS + print da tela de acompanhamento.`,
        base_legal:
          "Art. 24 Lei 9.784/99 — prazo máximo 90 dias. MS: Art. 5°, LXIX, CF/88",
      });
    } else if (dias >= 45) {
      alertas.push({
        tipo: "processo_parado",
        nivel: "atencao",
        mensagem: `AVANÇO TÁTICO: Processo sem resposta há ${dias} dias. Acionar Reabertura de Tarefa no portal Meu INSS + Ouvidoria (0800-722-8477). Em ${90 - dias} dias caberá Mandado de Segurança se não houver resposta.`,
        base_legal:
          "Art. 24 Lei 9.784/99 — prazo máximo 90 dias para decisão administrativa",
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
  // Rural ANTES de Especial — "segurado especial" é rural, não atividade especial
  if (
    t.includes("rural") ||
    t.includes("segurado especial") ||
    t.includes("lavrador") ||
    t.includes("pescador") ||
    t.includes("garimpeiro")
  )
    return "Trabalhador Rural";
  if (
    (t.includes("especial") && !t.includes("rural")) ||
    t.includes("insalubr") ||
    t.includes("periculosidade") ||
    t.includes("agente nocivo")
  )
    return "Aposentadoria Especial";
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
    t.includes("parto") ||
    t.includes("gestação") ||
    t.includes("adoção") ||
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
  if (
    t.includes("cnis") ||
    t.includes("extrato previdenciário") ||
    t.includes("extrato prev")
  )
    return "Análise CNIS";
  if (
    t.includes("mandado de segurança") ||
    t.includes("omissão inss") ||
    t.includes("demora administrativa")
  )
    return "Mandado de Segurança";
  if (t.includes("quesito") || (t.includes("perito") && t.includes("médic")))
    return "Quesitos Médicos";
  if (
    t.includes("processo administrativo") ||
    t.includes("erro inss") ||
    t.includes("erro do servidor") ||
    t.includes("revisão administrativa")
  )
    return "PAP Administrativo";
  if (
    t.includes("audiência") ||
    t.includes("audiencia") ||
    t.includes("depoimento")
  )
    return "Audiência Previdenciária";
  if (
    (t.includes("pente") && t.includes("fino")) ||
    (t.includes("revisão") && (t.includes("bpc") || t.includes("loas")))
  )
    return "Pente-Fino BPC";
  if (t.includes("tempo") && t.includes("contribuição"))
    return "Aposentadoria por Tempo de Contribuição";
  if (t.includes("idade")) return "Aposentadoria por Idade";
  if (
    t.includes("sdr") ||
    t.includes("lead") ||
    t.includes("captação") ||
    t.includes("captacao") ||
    t.includes("qualificação") ||
    t.includes("qualificacao") ||
    t.includes("novo cliente") ||
    t.includes("prospecção") ||
    t.includes("prospeccao")
  )
    return "SDR/Qualificação";
  return "Geral Previdenciário";
}

function promptModoEspecializado(modo: string): string {
  switch (modo) {
    case "BPC/LOAS":
      return `\n═══ MODO ESPECIALIZADO: BPC/LOAS 360° ═══
• Sem carência contributiva — pessoa com deficiência (qualquer idade) ou idoso (65+, art. 20 LOAS)
• Deficiência: modelo biopsicossocial ICF (Lei 13.146/2015 — EPCD) — impedimento de longo prazo (≥2 anos) físico, mental, intelectual ou sensorial que restrinja participação social

CRITÉRIO DE RENDA — ANÁLISE BPC 360 (holística):
• Critério legal ¼ SM per capita NÃO é absoluto: Tema 995 STF + Súmula 54 TNU + ADPF 182 + Temas 27 e 312 STF
• Lei 13.982/2020 — rendas EXCLUÍDAS: BPC do cônjuge, 1 SM de pensão por morte, benefícios assistenciais eventuais, bolsa família, rendimentos da própria PcD
• Art. 20, §11-A, Lei 8.742/93: GASTOS com medicamentos, cuidador, aluguel, transporte, dívidas REDUZEM renda efetiva
• Art. 20-B, Lei 8.742/93: critérios adicionais de flexibilização — aplicar sempre
• Tema 185 TNU: se INSS já reconheceu hipossuficiência, dispensa nova perícia de renda
• Tema 312 STF: benefícios de renda mínima (Bolsa Família, auxílio emergencial etc.) excluídos do cálculo

DEFICIÊNCIA — AMPLITUDE DO CONCEITO (Blindagem Documental):
• Modelo biopsicossocial ICF — impedimento de longo prazo (≥2 anos) + barreiras que restringem participação social
• Lei 14.126/2021: VISÃO MONOCULAR = deficiência sensorial visual — QUALIFICA para BPC
• HIV, autismo, TDAH, neoplasia, esquizofrenia, epilepsia, paralisia cerebral: documentar impacto funcional
• Menor de 16 anos: BPC possível (Decreto 6.214/07, art. 4°, §1°) — deficiência suficiente
• Interditado: NÃO precisa de interdição judicial para requerer BPC
• Internado em ILPI/abrigo: NÃO impede BPC — requisitos avaliados individualmente (Portaria MDS 03/2018)

IMPEDIMENTO DE LONGO PRAZO:
• Tema 173 TNU: pode ser reconhecido PROSPECTIVAMENTE (laudo atual demonstra cronificação)
• Não precisa estar incapacitado para o trabalho — basta restrição à participação social plena

ESTRATÉGIA — PAP COMO PRIORIDADE ("Galinha dos Ovos de Ouro"):
• CadÚnico: OBRIGATÓRIO — se desatualizado, atualizar na CRAS antes do requerimento
• Verificar CNIS: vínculos em aberto = causa frequente de indeferimento indevido — solucionar antes
• PAP PRIMEIRO (IN 128/22): administrativo resolve em ~30 dias + economiza honorários
• Se indeferido: CRPS em 30 dias; se mantido: ação judicial com perícia biopsicossocial (CIF)
• Estratégia subsidiária: BPC deficiente + pedido subsidiário BPC idoso (se próximo dos 65 anos)
• Documentos críticos ("Instrução Concentrada"): laudo ICF/CIF, CNIS, CadÚnico, composição familiar, comprovantes de renda e GASTOS com saúde`;
    case "Trabalhador Rural":
      return `\n═══ MODO ESPECIALIZADO: TRABALHADOR RURAL / SEGURADO ESPECIAL ═══
• Prova material OBRIGATÓRIA + testemunhos (Súmula 9 TNU) — sem prova material o pedido não prospera
• Documentos aceitos: ITR, bloco produtor rural, declaração do sindicato rural, contrato de arrendamento/parceria, nota fiscal de venda de produção, certidão de nascimento dos filhos (com profissão rural), fotos, ficha de associado rural, cadastro Pronaf
• Tema 327 TNU: documentos em nome do cônjuge VALEM como início de prova material (ex: ITR do marido serve para a esposa comprovar atividade rural)
• Tema 301 TNU: vínculos urbanos intercalados NÃO descaracterizam o segurado especial — verificar se a atividade rural principal era mantida concomitantemente
• Verificar CNIS: vínculos em aberto ou vínculos urbanos no período reivindicado = indeferimento provável — identificar e fundamentar antes do protocolo
• Comprovação: habitual e contemporânea ao período reivindicado (não basta documento isolado antigo)
• Segurado especial (art. 11, VII, Lei 8.213/91): SEM carência contributiva — comprovar período de atividade rural equivalente à carência do benefício solicitado
• Carência: para benefícios rurais com carência, usar período de atividade rural como substituição (art. 26, II, Lei 8.213/91)`;
    case "Aposentadoria Especial":
      return `\n═══ MODO ESPECIALIZADO: APOSENTADORIA ESPECIAL ═══
• PPP + LTCAT obrigatórios (TNU Súmula 33) — sem ambos não prospera
• Exposição habitual, permanente e não ocasional a agentes nocivos (TNU Súmula 10)
• 15 anos: agentes biológicos e químicos perigosos / 20 anos: alguns agentes químicos / 25 anos: ruído, calor, frio
• Dec. 3.048/99, arts. 64-70 + Anexos IV — lista oficial de agentes nocivos

CONVERSÃO DE TEMPO ESPECIAL EM COMUM:
• Homens: fator 1.4 (15 anos especiais = 21 anos comuns) / fator 1.2 (20 anos = 24 anos comuns)
• Mulheres: fator 1.4 (15 anos especiais = 21 anos) / fator 1.2 (20 anos = 24 anos)
• Verificar período por período com a legislação da ÉPOCA — decretos variaram ao longo do tempo

EPI (Equipamento de Proteção Individual):
• EPI NÃO neutraliza a nocividade para fins de aposentadoria especial — apenas ruído é exceção quando EPI reduz a efetiva exposição abaixo do limite (Tema 555 STF)
• Verificar no PPP se o EPI foi anotado como "eficaz" — contestar com LTCAT quando possível
• Se LTCAT confirma exposição real mesmo com EPI, prevalecer o LTCAT

ESTRATÉGIA PAP:
• Erro frequente do INSS: desconsiderar PPP porque nome do cargo mudou — contestar com LTCAT
• Se empresa não emite PPP: ação regressiva do segurado + testemunhos de ex-colegas
• Aposentadoria especial + conversão: calcular qual traz mais tempo/benefício melhor`;
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
      return `\n═══ MODO ESPECIALIZADO: SALÁRIO-MATERNIDADE SEM CARÊNCIA ═══
ATENÇÃO — MUDANÇA HISTÓRICA: A ADI 2.110 (STF, 21/03/2024) declarou INCONSTITUCIONAL a exigência de carência (art. 25, III, Lei 8.213/91). A TNU Súmula 77 está SUPERADA. O único requisito é ter QUALIDADE DE SEGURADO na data do parto/adoção.

FLUXO DE DECISÃO POR TIPO DE SEGURADA:
• Empregada CLT: qualidade de segurado automática — deferimento certo; valor até o teto do INSS
• Desempregada/ex-empregada: mantém direito dentro do período de graça (TNU Súmula 63) — verificar se ainda está no prazo
• Contribuinte individual: 1 contribuição + comprovação de atividade remunerada (Enunciado 19 CRPS)
  - Se não comprovar atividade → ENQUADRAR COMO FACULTATIVA (inversão de ônus — não perde o direito)
• Segurada facultativa: apenas 1 contribuição paga (GPS 1473 ou 1490 trimestral, 11%) — sem precisar provar atividade
• Segurada especial (rural): SEM carência, SEM contribuição — basta 1 documento rural anterior ao parto (Ofício Circular 63/2025)

RETROATIVIDADE — PARTOS ANTERIORES A 05/04/2024:
• Aplica-se a partos dentro dos últimos 5 anos (prescrição quinquenal)
• Se foi indeferido antes: PODE REQUERER NOVAMENTE — coisa julgada anterior NÃO impede (RE 586.068, Tema 100 STF)
• Valor: 1 salário mínimo (R$ 1.622,00) — DIB: data do parto

ESTRATÉGIA DE RECOLHIMENTO (se cliente ainda não tem contribuição):
• ANTES do parto: GPS até o dia do parto; DEPOIS do parto: GPS até o dia 15 do mês seguinte
• Sempre alíquota 11% — NUNCA 5% (risco de não validação pelo INSS)
• Facultativa mensal: código 1473 | Facultativa trimestral: código 1490
• Individual mensal: código 1163 | Individual trimestral: código 1180

ATIVIDADES CONCOMITANTES (2 salários):
• Empregada + autônoma (contribuinte individual): SIM
• Empregada + MEI: SIM
• Empregada + segurada facultativa: NÃO é possível

POTENCIAL FINANCEIRO: Honorários médios R$ 2.000,00 por contrato — 10 clientes = R$ 20.000,00
DIB: data do parto, adoção ou guarda judicial para adoção`;
    case "Auxílio por Incapacidade":
      return `\n═══ MODO ESPECIALIZADO: BENEFÍCIOS POR INCAPACIDADE (B31/B32/B94) ═══
FUNGIBILIDADE — REGRA DE OURO: SEMPRE peticionar B31 com pedido SUBSIDIÁRIO de B32 (e vice-versa)
• B31 (Auxílio-Doença): incapacidade temporária > 15 dias
• B32 (Aposentadoria por Incapacidade): incapacidade permanente e insusceptível de reabilitação
• B94 (Auxílio-Acidente): sequela permanente redutora da capacidade — SEMPRE incluir quando há pós-acidente/pós-B31

CARÊNCIA:
• 12 contribuições (art. 25, I, Lei 8.213/91)
• DISPENSADA: acidente de trabalho, doenças graves (art. 26, II) — neoplasia maligna SEMPRE dispensa
• Gravidez de alto risco: Tema 220 TNU — equiparada a acidente, dispensa carência imediata

QUALIDADE DE SEGURADO — VERIFICAR:
• Período de graça padrão: 12 meses (art. 15, Lei 8.213/91)
• Desemprego involuntário: amplia para 24 meses (Tema 348 TNU — art. 15, §2°)
• GPS paga em atraso dentro do período de graça: válida para carência (Tema 192 TNU + art. 27-A LBPS)
• Empregador que recusa retorno do reabilitado: qualidade de segurado MANTIDA (Tema 300 TNU)

AUXÍLIO-ACIDENTE (B94) — PONTOS CRÍTICOS:
• Tema 862 STJ: DIB é o dia SEGUINTE à cessação do B31 — automático, sem pedido de nova data
• Tema 315 TNU: dispensa pedido específico de B94 quando há sequela comprovada após B31
• Tema 416 STJ: QUALQUER redução funcional permanente é suficiente — sem percentual mínimo de sequela
• Súmula 44 TNU: basta redução parcial permanente da capacidade para o trabalho habitual

DCB INDEVIDA — ESTRATÉGIA:
• 1ª via: recurso no CRPS (30 dias da cessação) — mais ágil e gratuito
• 2ª via: mandado de segurança na JF (célere, liminar possível)
• Revisão de RMI: Portaria MTP 87/2023 — aposentadoria por incapacidade concedida antes da EC 103/2019

INCAPACIDADE > 2 ANOS: avaliar conversão B31→B32 com perícia especializada em biopsicossocial`;
    case "Análise CNIS":
      return `\n═══ MODO ESPECIALIZADO: ANALISADOR DE CNIS ═══
OBJETIVO: extrair tempo total de contribuição, carência e pendências que precisam de retificação

INDICADORES CRÍTICOS DO CNIS (verificar em cada vínculo):
• PEXT (Período Extinto): vínculo cancelado pelo INSS — contestar com CTPS/contrato/testemunhos
• AEXT (Averbação Extinta): averbação cancelada — pode ser revertida com documentação
• PREC-MENOR-MIN: recolhimento abaixo do salário mínimo — pode não contar para carência
• VINC-ABERTO: vínculo em aberto sem data de saída — bloqueia requerimento → resolver antes
• IND (Indicativo de Divergência): INSS identificou inconsistência — precisa de retificação

CÁLCULO DE TEMPO E CARÊNCIA:
• Tempo total: somar todos os vínculos válidos — períodos concomitantes NÃO se somam para tempo, mas SIM para carência (art. 25 c/c art. 29, Lei 8.213/91)
• Carência: contar apenas competências recolhidas dentro da carência exigida (12 ou 180, conforme benefício)
• Períodos especiais: identificar agentes nocivos no CNIS — cruzar com PPP/LTCAT
• Períodos rurais: verificar cadastro como segurado especial (Categoria "E" ou "V" no CNIS)

ALERTAS AUTOMÁTICOS:
• Vínculo em aberto (VINC-ABERTO) → solicitar TRCT/rescisão ou retificação via CAGED antes do requerimento
• Recolhimentos abaixo do mínimo (PREC-MENOR-MIN) → verificar se complementação é possível (art. 27-A LBPS)
• Gaps > 12 meses entre vínculos → verificar se qualidade de segurado foi perdida
• Última contribuição > 12 meses: calcular período de graça e verificar se o benefício solicitado ainda é possível`;

    case "PAP Administrativo":
      return `\n═══ MODO ESPECIALIZADO: ANÁLISE DO PROCESSO ADMINISTRATIVO (PAP) ═══
OBJETIVO: identificar erros técnicos do servidor INSS e construir estratégia de reversão

ERROS MAIS COMUNS DO SERVIDOR INSS (verificar sistematicamente):
• Erro de cálculo: soma incorreta de tempo de contribuição ou carência
• Falta de análise de documento: documento juntado mas não analisado na decisão
• Enquadramento incorreto: benefício negado com fundamento equivocado (ex: nega B32 sem avaliar B31)
• Descumprimento de prazo: IN 128/22 fixa 45 dias para análise — prazo vencido = MS possível
• Falta de notificação: segurado deve ser notificado antes de qualquer cessação (art. 69 Lei 8.213/91)
• Ausência de perícia: negou sem agendar perícia médica quando era obrigatória
• Exigência indevida: servidor pediu documento não previsto na legislação

VERIFICAÇÃO DE CUMPRIMENTO DE PRAZOS (Lei 9.784/99 + IN 128/22):
• Prazo para análise do requerimento: 45 dias corridos (art. 24, Lei 9.784/99)
• Prazo para recurso CRPS: 30 dias da ciência da decisão (art. 304, Decreto 3.048/99)
• Cessação de benefício: notificação prévia obrigatória — sem notificação = nulidade

EXTRAÇÃO DE "INSTRUMENTOS RATIFICADORES" JÁ PRESENTES NO PAP:
• Quais documentos já estão no PAP que o servidor deveria ter valorado?
• Há autodeclaração do segurado que não foi considerada?
• Há laudo médico, CadÚnico ou certidão que confirma o direito?

ESTRATÉGIA DE REVERSÃO:
• CRPS: citar o erro técnico específico e a IN descumprida — não recorrer genericamente
• Judicial: se PAP tem erro de direito, usar o próprio PAP como prova do erro do INSS
• Mandado de Segurança: se prazo vencido sem resposta (>45 dias) → direito líquido e certo`;

    case "Quesitos Médicos":
      return `\n═══ MODO ESPECIALIZADO: GERADOR DE QUESITOS ESTRATÉGICOS (PERÍCIA) ═══
OBJETIVO: criar perguntas que "encurralem" a conclusão do perito médico judicial

PRINCÍPIO: o foco é a INCAPACIDADE PARA A ATIVIDADE HABITUAL, não apenas a existência da doença

QUESITOS UNIVERSAIS (aplicáveis a qualquer caso):
1. O(a) periciando(a) possui diagnóstico confirmado de [CID]? Desde quando?
2. A doença limita a capacidade do(a) periciando(a) para exercer sua atividade habitual (${"{atividade anterior}"})?
3. A incapacidade é total ou parcial? Temporária ou permanente?
4. Existe progressão ou agravamento da doença ao longo do tempo?
5. O tratamento em curso é capaz de promover recuperação da capacidade laboral? Em que prazo?
6. O(a) periciando(a) pode exercer outra atividade compatível com sua limitação? Qual?
7. As limitações físicas/mentais interferem na execução das atividades básicas da vida diária (AVDs)?
8. Qual a data de início da incapacidade (DII) segundo critérios clínicos?

QUESITOS ESPECÍFICOS POR SITUAÇÃO:
• TDAH/Autismo/Saúde mental: "As barreiras sociais e comportamentais restringem a participação social plena?" (foco BPC)
• Ortopédico/neurológico: "O(a) periciando(a) consegue permanecer em pé/sentado por mais de 2 horas?"
• Cardíaco/respiratório: "Há limitação para esforço físico moderado? Afeta atividades laborais cotidianas?"
• Crônico/progressivo: "A condição tem probabilidade de agravamento sem intervenção cirúrgica ou tratamento especializado?"

QUESITOS PARA BPC (deficiência + miserabilidade):
• "O impedimento diagnosticado tem duração estimada superior a 2 anos?"
• "O impedimento, em interação com barreiras sociais, restringe a participação plena na sociedade?"
• "A condição exige cuidador ou auxílio de terceiros para atividades da vida diária?"

APÓS A PERÍCIA:
• Se laudo desfavorável: pedir esclarecimentos (CPC art. 477, §3°) focando nas respostas vagas ou contraditórias
• Se perito não respondeu quesito: requerer complementação — ausência de resposta = cerceamento de defesa`;

    case "Mandado de Segurança":
      return `\n═══ MODO ESPECIALIZADO: MANDADO DE SEGURANÇA (DEMORA INSS) ═══
OBJETIVO: combater omissão administrativa com base no direito líquido e certo à razoável duração do processo

FUNDAMENTOS LEGAIS:
• Lei 9.784/99, art. 24: INSS tem 30 dias para decidir (prorrogável por igual período por motivo justificado)
• IN PRES/INSS 128/22: prazo específico de 45 dias para análise de benefícios
• CF/88, art. 5°, LXXVIII: razoável duração do processo (direito fundamental)
• CF/88, art. 5°, LXIX + Lei 12.016/09: mandado de segurança para proteger direito líquido e certo
• CF/88, art. 37, §6°: responsabilidade do Estado por omissão

VERIFICAÇÃO DE CABIMENTO (checklist antes de impetrar):
1. Data do protocolo no INSS: registrada e comprovada? (protocolo + número do benefício)
2. Prazo vencido: >30 dias sem decisão (Lei 9.784/99) ou >45 dias sem análise (IN 128/22)?
3. Prova da demora: comprovante de protocolo + consulta INSS mostrando "em análise"
4. Autoridade coatora: Agência do INSS onde foi protocolado + Gerência Executiva

ESTRATÉGIA:
• Pedido liminar: tutela de urgência para obrigar INSS a decidir em X dias (ex: 15 dias)
• Não pede o benefício — pede que o INSS DECIDA sobre o requerimento
• Competência: JEF (valor da causa previdenciário) ou Vara Federal comum
• Honorários: cabíveis em MS (Lei 12.016/09, art. 25 — mas vide STJ: só em caso de ilegalidade)

DOCUMENTOS ESSENCIAIS:
• Comprovante de protocolo com data e número
• CNIS/extrato mostrando que não há benefício ativo
• Consulta INSS online ou presencial mostrando "em análise" há mais de 45 dias
• Procuração + documentos do cliente`;

    case "Audiência Previdenciária":
      return `\n═══ MODO ESPECIALIZADO: AUDIÊNCIA PREVIDENCIÁRIA ═══
FASES: 1) CONCILIAÇÃO → 2) INSTRUÇÃO → 3) JULGAMENTO

PRÉ-AUDIÊNCIA — 3 pontos obrigatórios:
• Revisar todos os fatos e documentos do processo — não confiar na memória
• Preparar perguntas diretas para testemunhas (formulá-las antes, não improvisar)
• Identificar o "ponto controverso" central: é renda? é vínculo? é incapacidade? é tempo rural?

CONCILIAÇÃO:
• Proposta do INSS via preposto (pode ser por videoconferência — Resolução CNJ 354/2020 + 481/2022)
• Avaliar proposta: DIB + risco de perda na instrução + tempo restante até sentença
• Acordo homologado tem força de sentença — avaliar reparcelamento vs. pagamento à vista

INSTRUÇÃO:
• Depoimento pessoal DO CLIENTE: advogado PODE requerer (CPC art. 385)
• Testemunhas: advogado DEVE levar (CPC art. 455 + Lei 9.099/95 art. 34) — máx. 3 por parte
• Formalidade essencial: tratar o juiz de "Excelência" — urbanidade obrigatória (CPC art. 358)
• Juntada de documentos NA audiência: POSSÍVEL (Lei 9.099/95 arts. 28-29)
• Gravação pelo advogado: PERMITIDA (precedentes TRF1 e TRF6)

TESTEMUNHAS — REGRAS:
• Advogado leva sem intimação ou requer intimação ≥5 dias antes (Lei 9.099/95 art. 34)
• IMPEDIDAS: cônjuge/companheiro, ascendentes, descendentes, parentes até 3° grau (consanguinidade ou afinidade)
• EXCETO quando for a ÚNICA forma de provar o fato (ex: rural, união estável)
• Testemunha impedida pode depor "sem compromisso" — juiz avalia credibilidade

CASOS MAIS COMUNS QUE EXIGEM AUDIÊNCIA:
• Rural/segurado especial: Súmula 9 TNU — prova oral + material (documentos + testemunhos)
• Pensão por morte: provar união estável ou dependência econômica
• Desemprego involuntário: provar para estender período de graça (Tema 348 TNU — 24 meses)
• Vínculos de emprego: CTPS + CNIS + testemunhas de colegas/supervisores
• Aposentadoria híbrida/tempo rural: comprovação de período rural remoto
• BPC: prova de renda familiar e deficiência por biopsicossocial

CLIENTE DISTANTE (>40km): solicitar PID (Ponto de Inclusão Digital) via JF — Resolução CNJ 508/2023
SENTENÇA: imediata no JEF (art. 62 Lei 9.099/95) ou em até 30 dias (CPC art. 366)
RECURSO se negar audiência injustamente: JEF → recurso inominado; VARA → agravo de instrumento (CPC art. 1.015)
ALEGAÇÕES FINAIS: falar oralmente em audiência — não aguardar prazo escrito`;

    case "Pente-Fino BPC":
      return `\n═══ MODO ESPECIALIZADO: PENTE-FINO / REVISÃO BPC ═══
CONTEXTO: O INSS iniciou revisão periódica do BPC (art. 21, Lei 8.742/93). O objetivo é MANTER o benefício, não perder.

ESTRATÉGIA DE DEFESA — "BLINDAGEM DOCUMENTAL":
• DEFESA PREVENTIVA: não esperar notificação — regularizar documentação proativamente
• FOCO NO ERRO FORMAL DO INSS: verificar se a notificação obedece aos requisitos legais (prazo, forma, fundamentação)
• Erro formal do INSS no procedimento de revisão → nulidade → manutenção do benefício

CHECKLIST DE REVISÃO (antes de qualquer manifestação):
1. CNIS atualizado: verificar se há vínculos empregatícios em aberto (causa nº 1 de cessação)
2. CadÚnico: verificar se está atualizado e consistente com declaração original
3. Renda familiar: recalcular com EXCLUSÕES da Lei 13.982/2020 + art. 20, §11-A (gastos de saúde)
4. Composição familiar: confirmar se houve mudança (morte, separação, nascimento) — atualizar CadÚnico
5. Deficiência: reavaliação médica agendada? Obter novo laudo com CIF/biopsicossocial ANTES da perícia do INSS
6. Resultado INSS: o médico-perito do INSS pode reconhecer deficiência diferente — pedir vista do laudo

FUNDAMENTOS PARA MANTER O BENEFÍCIO:
• Tema 185 TNU: se INSS já reconheceu hipossuficiência anteriormente, nova perícia de renda é dispensável
• Art. 20, §11-A, Lei 8.742/93: gastos com saúde REDUZEM renda efetiva — calcular sempre
• Temas 27 e 312 STF: critério renda ¼ SM não é absoluto — prova de miserabilidade por outros meios
• Lei 14.126/2021: visão monocular = deficiência visual → qualifica para BPC (novo argumento)
• Tema 173 TNU: impedimento de longo prazo reconhecido prospectivamente — laudo atual suficiente

SE CESSAR INDEVIDAMENTE:
• 1ª via: CRPS em 30 dias — gratuito e mais ágil
• 2ª via: ação judicial na JF com pedido liminar de restabelecimento
• Retroatividade: parcelas cessadas indevidamente = parcelas atrasadas com correção
• Documentar a cessação indevida como prova de dano material para fins de indenização`;

    case "Aposentadoria por Tempo de Contribuição":
      return `\n═══ MODO ESPECIALIZADO: APOSENTADORIA POR TEMPO DE CONTRIBUIÇÃO ═══
ATENÇÃO: EC 103/2019 EXTINGUIU a aposentadoria por tempo para novos segurados após 13/11/2019.
Verificar se cliente tem direito adquirido (tempo completo antes da EC) ou aplica-se regra de transição.

REGRAS DE TRANSIÇÃO (EC 103/2019) — verificar qual é mais vantajosa:
• PEDÁGIO 50% (art. 17): para quem estava a ≤2 anos de completar o tempo — homens 35 anos, mulheres 30 anos
• PEDÁGIO 100% (art. 20): para quem estava a >2 anos — contribuir 100% do tempo restante + idade mínima
• PONTOS PROGRESSIVOS (art. 19): 97/87 pts (2025), 98/88 (2026), 99/89 (2027), 100/90 (2028+) + tempo mínimo

DIREITO ADQUIRIDO (antes de 13/11/2019):
• Homem com 35 anos de contribuição OU mulher com 30 anos → direito adquirido preservado
• Professor(a): 30 anos (homem) / 25 anos (mulher) de magistério exclusivo
• Verificar CNIS: todo o tempo conta — público + privado + rural (sem contribuição, mas com carência)

CÁLCULO DO BENEFÍCIO (pós-EC 103):
• RMB = média de 100% de todos os salários de contribuição (não mais 80% maiores)
• Alíquota progressiva: começa em 60% + 2% por ano além do mínimo (35/30 anos)
• Fator previdenciário: pode ser aplicado — calcular com e sem para verificar o mais vantajoso
• Teto INSS 2025: R$ 7.786,02

PERÍODOS ESPECIAIS — computar para converter:
• Tempo especial converte com fator 1.4 (15 anos) ou 1.2 (20 anos) em tempo comum
• Tempo rural sem contribuição: conta como tempo e carência (segurado especial)
• Tempo de serviço público: RPPS é separado — verificar se há contagem recíproca (art. 201, §9°, CF)`;

    case "Aposentadoria por Idade":
      return `\n═══ MODO ESPECIALIZADO: APOSENTADORIA POR IDADE ═══
REQUISITOS (art. 201, §7°, CF/88 + EC 103/2019):
• Homem: 65 anos de idade + 20 anos de contribuição (carência)
• Mulher urbana: 62 anos de idade + 15 anos de contribuição
• Segurado especial (rural): homem 60 anos / mulher 55 anos + carência de atividade rural

REGRAS DE TRANSIÇÃO (EC 103/2019):
• Mulher que já tinha 60 anos em 13/11/2019: mantém direito com 15 anos de carência
• Progressão da idade mínima feminina: 60 anos (2019) → 61 (2020) → 62 (2023+)
• Para contribuições iniciadas antes de 13/11/2019: carência pode ser diferente — verificar

CÁLCULO DO BENEFÍCIO:
• RMB = 60% + 2% por ano de contribuição acima de 20 anos (homem) ou 15 anos (mulher)
• Para atingir 100%: precisaria de 40 anos de contribuição (homem) ou 30 anos (mulher)
• Salário de benefício: média de todos os salários desde julho/1994

RURAL / SEGURADO ESPECIAL:
• Regra especial mantida pela EC 103/2019: 60 anos (homem) / 55 anos (mulher)
• Carência: 180 meses de atividade rural (não precisa ser contributiva)
• Documentação: prova material + testemunhos (Súmula 9 TNU) — OBRIGATÓRIA
• Documentos em nome do cônjuge valem (Tema 327 TNU)

ESTRATÉGIA:
• Se não tem carência completa: verificar se há tempo rural complementar
• Se está próximo da idade: orientar sobre contribuições voluntárias para completar carência
• MEI com contribuições em dia: conta para carência da aposentadoria por idade`;

    case "SDR/Qualificação":
      return `\n═══ MODO ESPECIALIZADO: SDR / QUALIFICAÇÃO DE LEAD ═══
OBJETIVO: Qualificar se o potencial cliente tem viabilidade jurídica e calcular ROI do contrato.

ALGORITMO DE QUALIFICAÇÃO (Score 0–10):
1. DOR URGENTE (0–2 pts): Qual a situação que motivou a consulta?
   • Benefício negado/cortado recentemente (+2) | Doença incapacitante ativa (+2) | Dúvida sem urgência (+0)

2. QUALIDADE DE SEGURADO (0–2 pts):
   • Contribuindo ou em período de graça (+2) | Perdeu qualidade — verificar recuperação (+1) | Nunca contribuiu (BPC path) (+1)

3. PROVA RAINHA disponível (0–2 pts):
   • Possui CNIS, CTPS, laudos, PPP ou documentos rurais (+2) | Tem parcial — orientar complemento (+1) | Sem documentos (+0)

4. VIABILIDADE DA TESE (0–2 pts):
   • Tese clara e jurisprudência favorável (+2) | Tese possível mas com risco (+1) | Caso improvável (+0)

5. URGÊNCIA / TIMING (0–2 pts):
   • Prescrição próxima ou DCB vencida (+2) | Dentro do prazo confortável (+1) | Sem urgência (+0)

VEREDITO PELO SCORE:
• 8–10: FECHAR CONTRATO — caso forte, honorários garantidos. Script: "Encontrei sua tese. Posso reverter isso no administrativo rapidamente. Vou precisar de [X documento]. Meu honorário é [Y]. Quando podemos assinar?"
• 5–7: FECHAR COM CAUTELA — caso possível, apresentar risco. Script: "Há uma tese, mas precisa de [documento X]. Se trouxer até [data], podemos entrar com o pedido e aumentar muito as chances."
• 0–4: NÃO FECHAR AGORA — orientar sem assumir caso inviável. Script: "No momento, a documentação não está suficiente para garantir resultado. Recomendo você regularizar [X] e voltar quando tiver [Y]."

IDENTIFICAÇÃO DA "DOR URGENTE":
• Benefício cortado → DCB alert + ação restabelecimento
• Demora no INSS > 45 dias → Avanço Tático (Reabertura de Tarefa / Ouvidoria)
• Demora > 90 dias → Mandado de Segurança (MS)
• Indeferimento recente → Recurso CRPS (30 dias) ou Ação Judicial

FUNGIBILIDADE PRÁTICA — sempre apresentar o caminho alternativo:
• "Principal: Aposentadoria por Incapacidade. Subsidiário: Auxílio-Incapacidade."
• "Principal: BPC/LOAS. Subsidiário: Salário-Maternidade (se segurada)."

ANÁLISE ROI (Honorários):
• Calcular: valor do benefício × 12 meses × % honorário contratado
• Apresentar ao cliente em termos de "recuperação acumulada" para justificar contrato`;

    default:
      return "";
  }
}

// ─── Contexto aprendido ───────────────────────────────────────────────────────

export async function obterContextoCerebro(
  tipoAcao: string,
  area: string,
  opts?: { cid?: string; vara?: string; comarca?: string }
): Promise<string> {
  const [casos, teses, peticoes, casosSimilares] = await Promise.all([
    sql`
      SELECT tipo_acao, resultado_final, argumentos_vencedores, erros_cometidos,
             teses_utilizadas, licao, vara, comarca, motivo_indeferimento
      FROM cerebro_juridico
      WHERE tipo_acao ILIKE ${`%${tipoAcao}%`} OR area = ${area}
      ORDER BY created_at DESC LIMIT 10
    `,
    sql`
      SELECT titulo, tese, base_legal, taxa_sucesso, vezes_venceu, vezes_aplicada
      FROM cerebro_teses
      WHERE (tipo_acao ILIKE ${`%${tipoAcao}%`} OR area = ${area}) AND ativa = true
      ORDER BY taxa_sucesso DESC NULLS LAST, vezes_venceu DESC LIMIT 6
    `,
    sql`
      SELECT titulo, tipo_peticao, texto
      FROM ia_peticoes
      WHERE (area ILIKE ${`%${area}%`} OR tipo_peticao ILIKE ${`%${tipoAcao}%`})
        AND aprovada = true
      ORDER BY vezes_usada DESC LIMIT 2
    `,
    // Casos com CID semelhante ou mesma vara — inteligência cruzada
    opts?.cid || opts?.vara
      ? sql`
          SELECT cj.tipo_acao, cj.resultado_final, cj.licao, cj.argumentos_vencedores,
                 cj.motivo_indeferimento, cj.vara
          FROM cerebro_juridico cj
          WHERE (
            ${opts?.cid ? sql`cj.metadata->>'cid' ILIKE ${`%${opts.cid.substring(0, 3)}%`}` : sql`false`}
            OR ${opts?.vara ? sql`cj.vara ILIKE ${`%${opts.vara}%`}` : sql`false`}
          )
          AND cj.tipo_acao ILIKE ${`%${tipoAcao}%`}
          ORDER BY cj.created_at DESC LIMIT 5
        `.catch(() => [] as Record<string, unknown>[])
      : Promise.resolve([] as Record<string, unknown>[]),
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
        (ctx += `[Ref ${i + 1}] ${p.titulo}\n${String(p.texto || "").substring(0, 500)}...\n\n`)
    );
  }

  // Inteligência cruzada: casos com CID semelhante ou mesma vara
  if (casosSimilares.length > 0) {
    const ganhosSim = casosSimilares.filter(
      (c) => c.resultado_final === "deferido"
    );
    const perdidosSim = casosSimilares.filter(
      (c) => c.resultado_final === "indeferido"
    );
    ctx += `\n🔍 CASOS SEMELHANTES (mesmo CID ou vara):\n`;
    if (ganhosSim.length) {
      ctx += `  ✅ Ganhos (${ganhosSim.length}): `;
      ctx += ganhosSim
        .map((c) => c.licao || (c.argumentos_vencedores as string[])?.[0])
        .filter(Boolean)
        .join(" | ");
      ctx += "\n";
    }
    if (perdidosSim.length) {
      ctx += `  ❌ Perdidos (${perdidosSim.length}): `;
      ctx += perdidosSim
        .map((c) => c.motivo_indeferimento)
        .filter(Boolean)
        .join(" | ");
      ctx += "\n";
    }
  }

  ctx += "════════════════════════════════════════════\n";
  return ctx;
}

// ─── 1. Análise completa do processo ─────────────────────────────────────────

export interface PreparedAnalise {
  /** Conteúdo estático (BASE_LEGAL + modo + contexto) — vai para system com cache */
  systemPrompt: string;
  /** Dados do processo específico — vai para user message (sem cache) */
  userContent: string;
  /** @deprecated use systemPrompt + userContent */
  prompt: string;
  modo: string;
  clientId: string;
  completudePct: number;
  faltantes: DadoFaltante[];
  alertas: AlertaJuridico[];
}

export async function prepararAnalise(
  processoId: string
): Promise<PreparedAnalise> {
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

  const [andamentos, documentos, contexto, docAnalises] = await Promise.all([
    sql`
      SELECT texto, tipo, data_referencia, situacao
      FROM historico_registros
      WHERE processo_id = ${processoId}::uuid
      ORDER BY data_referencia DESC, created_at DESC LIMIT 15
    `.catch(
      () =>
        [] as {
          texto: unknown;
          tipo: unknown;
          data_referencia: unknown;
          situacao: unknown;
        }[]
    ),
    sql`
      SELECT nome, tipo, url FROM documentos
      WHERE entity_type = 'processo' AND entity_id = ${processoId}::uuid
    `.catch(() => [] as { nome: unknown; tipo: unknown; url: unknown }[]),
    obterContextoCerebro(
      processo.tipo_acao || "",
      processo.area || "Previdenciário",
      {
        cid: processo.cid_principal || undefined,
        vara: processo.vara || undefined,
      }
    ).catch(() => ""),
    sql`
      SELECT titulo, analise FROM cerebro_analises
      WHERE processo_id = ${processoId}::uuid AND tipo = 'documento'
      ORDER BY created_at DESC LIMIT 5
    `.catch(() => [] as { titulo: unknown; analise: unknown }[]),
  ]);

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

MÓDULO 1 — CLIENTE:
Nome: ${processo.cliente_nome}
Idade: ${idadeCliente !== null ? `${idadeCliente} anos${idadeCliente < 18 ? " (MENOR DE IDADE)" : ""}` : "Não informada"}
NIS/PIS: ${processo.nis || "Não informado"}
${(() => {
  const p = processo as Record<string, unknown>;
  if (isBPC(p))
    return `⚠️ CASO BPC/LOAS — benefício ASSISTENCIAL: NÃO exige carência, contribuições nem histórico trabalhista.\nCritério: deficiência (impedimento de longo prazo ≥2 anos) + miserabilidade (renda per capita ≤ ¼ SM — relativizável via Tema 995 STF).`;
  if (isPensao(p))
    return `⚠️ PENSÃO POR MORTE — SEM carência (art. 26, I, Lei 8.213/91). Verificar QUALIDADE DE SEGURADO DO FALECIDO na data do óbito e grau de parentesco do dependente.`;
  if (isMaternidade(p))
    return `⚠️ SALÁRIO-MATERNIDADE — carência DISPENSADA após ADI 2.110 (STF, 21/03/2024). Único requisito: qualidade de segurada na data do parto/adoção.\nCategoria da segurada: ${processo.categoria_contribuinte || "Não informada"}`;
  if (isAposentadoria(p))
    return `Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}\nAtividade anterior: ${processo.atividade_anterior || "Não informada"}\nCarência verificada: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}\nNº contribuições / tempo total: ${processo.num_contribuicoes ?? "Não informado"}`;
  return `Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}\nAtividade anterior: ${processo.atividade_anterior || "Não informada"}\nCarência verificada: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}\nNº contribuições: ${processo.num_contribuicoes ?? "Não informado"}`;
})()}

MÓDULO 2 — INCAPACIDADE E DOCUMENTAÇÃO MÉDICA:
${(() => {
  const p = processo as Record<string, unknown>;
  if (isPensao(p) || isMaternidade(p) || isAposentadoria(p) || isOperacional(p))
    return `(Não aplicável para este tipo de caso)`;
  return `CID Principal: ${processo.cid_principal || "Não informado"}\nTipo de incapacidade: ${processo.tipo_incapacidade || "Não informado"}\nData do diagnóstico: ${processo.data_diagnostico || "Não informada"}\nData do afastamento: ${processo.data_afastamento || "Não informada"}`;
})()}

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
${
  docAnalises.length > 0
    ? `\nCONTEÚDO DOS DOCUMENTOS (lidos pelo Dr. Lex):\n${docAnalises
        .map(
          (da) =>
            `\n--- ${da.titulo} ---\n${String(da.analise || "").substring(0, 500)}`
        )
        .join("\n")}`
    : ""
}

DADOS FALTANTES (${faltantes.filter((f) => f.prioridade === "alta").length} críticos):
${faltantes.map((f) => `• [${f.prioridade.toUpperCase()}] ${f.campo}`).join("\n") || "Nenhum — dados completos"}

Data da análise: ${new Date().toLocaleDateString("pt-BR")}
`;

  // Parte ESTÁTICA (cacheável) — BASE_LEGAL + modo + contexto + formato de resposta
  const systemPrompt = `${BASE_LEGAL}
${promptModoEspecializado(modo)}
${contexto}

IMPORTANTE: Considere o conteúdo real dos documentos lidos pelo Dr. Lex ao avaliar probabilidade de êxito e pontos fortes.

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
Uma ação específica e prática para executar AGORA.

## PROBABILIDADE DE ÊXITO: XX%
Justifique com base nos dados disponíveis.

## RISCO GERAL: Alto | Médio | Baixo`;

  // Parte DINÂMICA (por processo) — enviada como mensagem do usuário
  const userContent = `TAREFA: Análise jurídica completa para este caso.

${dadosProcesso}`;

  const prompt = `${systemPrompt}\n\n${userContent}`;

  return {
    systemPrompt,
    userContent,
    prompt,
    modo,
    clientId: String(processo.client_id),
    completudePct,
    faltantes,
    alertas,
  };
}

export async function salvarAnalise(
  processoId: string,
  clientId: string,
  analise: string,
  modo: string,
  completudePct: number,
  faltantes: DadoFaltante[],
  alertas: AlertaJuridico[]
): Promise<{
  risco: string;
  prob: number;
  proximaAcao: string;
  baseLegal: string[];
  tarefaCriada: boolean;
  beneficioProvavel?: string;
  estrategiaRecomendada?: string;
  metadata: MetadadosCerebro;
}> {
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
          ${clientId}::uuid,
          ${proximaAcao.substring(0, 200)},
          ${prioridadeTarefa},
          ${"✅ Criada automaticamente pelo Cérebro Jurídico em " + new Date().toLocaleDateString("pt-BR")}
        )
      `;
      tarefaCriada = true;
    }
  } catch {
    // tarefa é bônus
  }

  const metadata: MetadadosCerebro = {
    completude_pct: completudePct,
    dados_faltantes: faltantes,
    alertas,
    modo_especializado: modo,
    tarefa_criada: tarefaCriada,
    beneficio_provavel: beneficioProvavel,
    estrategia_recomendada: estrategiaRecomendada,
  };

  try {
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
  } catch (err) {
    console.error("[cerebro] Falha ao salvar análise:", err);
  }

  // ── Aprendizado imediato: salva tese principal extraída no banco de teses ──
  // Não espera o caso fechar — cada análise já alimenta a inteligência coletiva
  try {
    const teseMatch = analise.match(
      /## TESE PRINCIPAL RECOMENDADA\n([\s\S]*?)(?=\n##|$)/i
    );
    const pontosFortesMatch = analise.match(
      /## PONTOS FORTES\n([\s\S]*?)(?=\n##|$)/i
    );
    const teseTexto = teseMatch?.[1]?.trim();
    const pontosTexto = pontosFortesMatch?.[1]?.trim();

    if (teseTexto && teseTexto.length > 30) {
      const tituloTese = teseTexto
        .split("\n")[0]
        .replace(/^[•\-\*]\s*/, "")
        .substring(0, 100);
      const teseCompleta = [
        teseTexto,
        pontosTexto ? `\nPontos fortes: ${pontosTexto}` : "",
      ]
        .join("")
        .substring(0, 800);

      const teseSlug60 = teseTexto.substring(0, 60).replace(/[%_]/g, "\\$&");
      const [existeTese] = await sql`
        SELECT id, vezes_aplicada FROM cerebro_teses
        WHERE tipo_acao ILIKE ${`%${modo.replace(/[%_]/g, "\\$&")}%`}
          AND tese ILIKE ${`%${teseSlug60}%`} ESCAPE '\\'
        LIMIT 1
      `;

      if (existeTese) {
        await sql`
          UPDATE cerebro_teses
          SET vezes_aplicada = vezes_aplicada + 1,
              taxa_sucesso = ROUND(
                (vezes_venceu::numeric / GREATEST(vezes_aplicada + 1, 1)) * 100, 1
              )
          WHERE id = ${existeTese.id}::uuid
        `;
      } else {
        await sql`
          INSERT INTO cerebro_teses (titulo, tese, area, tipo_acao, taxa_sucesso, vezes_aplicada, vezes_venceu)
          VALUES (
            ${tituloTese}, ${teseCompleta},
            ${"Previdenciário"}, ${modo},
            0, 1, 0
          )
          ON CONFLICT DO NOTHING
        `;
      }
    }
  } catch {
    // não bloqueia — aprendizado é bônus
  }

  return {
    risco,
    prob,
    proximaAcao,
    baseLegal,
    tarefaCriada,
    beneficioProvavel,
    estrategiaRecomendada,
    metadata,
  };
}

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
    `.catch(
      () =>
        [] as {
          texto: unknown;
          tipo: unknown;
          data_referencia: unknown;
          situacao: unknown;
        }[]
    ),
    sql`
      SELECT nome, tipo FROM documentos
      WHERE entity_type = 'processo' AND entity_id = ${processoId}::uuid
    `.catch(() => [] as { nome: unknown; tipo: unknown }[]),
    obterContextoCerebro(
      processo.tipo_acao || "",
      processo.area || "Previdenciário",
      {
        cid: processo.cid_principal || undefined,
        vara: processo.vara || undefined,
      }
    ).catch(() => ""),
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

MÓDULO 1 — CLIENTE:
Nome: ${processo.cliente_nome}
Idade: ${idadeCliente !== null ? `${idadeCliente} anos${idadeCliente < 18 ? " (MENOR DE IDADE)" : ""}` : "Não informada"}
NIS/PIS: ${processo.nis || "Não informado"}
${(() => {
  const p = processo as Record<string, unknown>;
  if (isBPC(p))
    return `⚠️ CASO BPC/LOAS — benefício ASSISTENCIAL: NÃO exige carência, contribuições nem histórico trabalhista.\nCritério: deficiência (impedimento de longo prazo ≥2 anos) + miserabilidade (renda per capita ≤ ¼ SM — relativizável via Tema 995 STF).`;
  if (isPensao(p))
    return `⚠️ PENSÃO POR MORTE — SEM carência (art. 26, I, Lei 8.213/91). Verificar QUALIDADE DE SEGURADO DO FALECIDO na data do óbito e grau de parentesco do dependente.`;
  if (isMaternidade(p))
    return `⚠️ SALÁRIO-MATERNIDADE — carência DISPENSADA após ADI 2.110 (STF, 21/03/2024). Único requisito: qualidade de segurada na data do parto/adoção.\nCategoria da segurada: ${processo.categoria_contribuinte || "Não informada"}`;
  if (isAposentadoria(p))
    return `Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}\nAtividade anterior: ${processo.atividade_anterior || "Não informada"}\nCarência verificada: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}\nNº contribuições / tempo total: ${processo.num_contribuicoes ?? "Não informado"}`;
  return `Categoria contribuinte: ${processo.categoria_contribuinte || "Não informada"}\nAtividade anterior: ${processo.atividade_anterior || "Não informada"}\nCarência verificada: ${processo.carencia_atingida != null ? (processo.carencia_atingida ? "Sim" : "Não — VERIFICAR") : "Não verificado"}\nNº contribuições: ${processo.num_contribuicoes ?? "Não informado"}`;
})()}

MÓDULO 2 — INCAPACIDADE E DOCUMENTAÇÃO MÉDICA:
${(() => {
  const p = processo as Record<string, unknown>;
  if (isPensao(p) || isMaternidade(p) || isAposentadoria(p) || isOperacional(p))
    return `(Não aplicável para este tipo de caso)`;
  return `CID Principal: ${processo.cid_principal || "Não informado"}\nTipo de incapacidade: ${processo.tipo_incapacidade || "Não informado"}\nData do diagnóstico: ${processo.data_diagnostico || "Não informada"}\nData do afastamento: ${processo.data_afastamento || "Não informada"}`;
})()}

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

  const resp = await getClaudeClient().messages.create({
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

  try {
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
  } catch (insertErr) {
    console.error("[cerebro] Falha ao salvar análise no banco:", insertErr);
    // Retorna a análise mesmo sem salvar no banco
  }

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

  const docUrl = doc.url as string;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const resp =
    docUrl.includes(".private.blob.vercel-storage.com") && blobToken
      ? await fetch(docUrl, {
          headers: { Authorization: `Bearer ${blobToken}` },
        })
      : await fetch(docUrl);
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

  const aiResp = await getClaudeClient().messages.create(
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
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

  const resp = await getClaudeClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
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

  const resp = await getClaudeClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
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
      const teseSlug = String(tese).substring(0, 40).replace(/[%_]/g, "\\$&");
      const [exist] = await sql`
        SELECT id FROM cerebro_teses
        WHERE tipo_acao ILIKE ${`%${(processo.tipo_acao || "").replace(/[%_]/g, "\\$&")}%`}
          AND titulo ILIKE ${`%${teseSlug}%`} ESCAPE '\\'
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

  const [cerebroRows, docRows, contextoAprendido] = await Promise.all([
    sql`
      SELECT analise, risco, probabilidade_sucesso, proxima_acao, base_legal, metadata
      FROM cerebro_analises
      WHERE processo_id = ${processoId}::uuid AND tipo = 'inicial'
      ORDER BY created_at DESC LIMIT 1
    `.catch(() => [] as Record<string, unknown>[]),
    sql`
      SELECT titulo, analise
      FROM cerebro_analises
      WHERE processo_id = ${processoId}::uuid AND tipo = 'documento'
      ORDER BY created_at DESC LIMIT 3
    `.catch(() => [] as Record<string, unknown>[]),
    obterContextoCerebro(
      processo.tipo_acao || tipoPeticao,
      processo.area || "Previdenciário",
      {
        cid: processo.cid_principal || undefined,
        vara: processo.vara || undefined,
      }
    ).catch(() => ""),
  ]);

  const parts: string[] = [];
  if (contextoAprendido) parts.push(contextoAprendido);

  // Diagnóstico completo do Cérebro — extraindo seções chave
  if (cerebroRows.length > 0) {
    const ca = cerebroRows[0];
    const analiseText = String(ca.analise || "");

    const secoes = [
      "## AVALIAÇÃO GERAL",
      "## MÓDULO: BENEFÍCIO MAIS PROVÁVEL",
      "## MÓDULO: ESTRATÉGIA",
      "## PONTOS FORTES",
      "## PONTOS FRACOS E RISCOS",
      "## TESE PRINCIPAL RECOMENDADA",
      "## BASE LEGAL APLICÁVEL",
      "## PRÓXIMA AÇÃO IMEDIATA",
    ];

    let resumoCerebro = "";
    for (const secao of secoes) {
      const escaped = secao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = analiseText.match(
        new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n##|$)`, "i")
      );
      if (match?.[1]?.trim()) {
        resumoCerebro += `${secao}\n${match[1].trim()}\n\n`;
      }
    }

    if (resumoCerebro) {
      parts.push(`
════════════════════════════════════════════
DIAGNÓSTICO DO CÉREBRO JURÍDICO — USE COMO DIRETRIZ DA PETIÇÃO
════════════════════════════════════════════
Probabilidade de êxito: ${ca.probabilidade_sucesso}% | Risco: ${String(ca.risco || "").toUpperCase()}
Próxima ação identificada: ${ca.proxima_acao}

${resumoCerebro.trim()}

⚠️ INSTRUÇÃO CRÍTICA: A TESE PRINCIPAL acima é o eixo central da petição.
Use os PONTOS FORTES e BASE LEGAL como fundamentos jurídicos reais.
NÃO substitua nem invente teses diferentes das indicadas acima.`);
    }
  }

  // Análises de documentos pelo Dr. Lex
  if (docRows.length > 0) {
    let blocoDoc = `
════════════════════════════════════════════
DOCUMENTOS DO CASO — ANALISADOS PELO DR. LEX
════════════════════════════════════════════
Use as informações abaixo como prova material concreta na petição:\n`;
    for (const doc of docRows) {
      blocoDoc += `\n--- ${doc.titulo} ---\n${String(doc.analise || "").substring(0, 700)}\n`;
    }
    blocoDoc +=
      "\n⚠️ Mencione esses documentos especificamente ao fundamentar os pedidos.";
    parts.push(blocoDoc);
  }

  return parts.filter(Boolean).join("\n");
}
