import sql from "./db";
import { codigoDoTipo } from "./checklist-documentos";

export interface PontoAtencao {
  id: string;
  processoId: string;
  codigo: string;
  gravidade: "impeditivo" | "alto" | "medio" | "baixo";
  descricao: string;
  baseLegal: string | null;
  resolvido: boolean;
  criadoEm: string;
}

interface RegraResultado {
  codigo: string;
  gravidade: PontoAtencao["gravidade"];
  descricao: string;
  baseLegal: string | null;
}

// Benefícios de seguridade social que NÃO estão nas exceções do art. 20, §4º
// da LOAS (assistência médica, pensão especial indenizatória, transferências
// de renda constitucionais) — lista de termos pra detecção por palavra-chave,
// já que `clients.tipo_beneficio` é texto livre. Mantida conservadora de
// propósito: on erro de detecção, o pior caso é não alertar (falso negativo),
// nunca travar o fluxo com um falso positivo forte — por isso a gravidade é
// 'alto', não 'impeditivo': quem decide é sempre o advogado.
const TERMOS_BENEFICIO_ACUMULAVEL = [
  "pensão por morte",
  "pensao por morte",
  "aposentadoria",
  "auxílio-doença",
  "auxilio-doenca",
  "auxílio por incapacidade",
  "auxilio por incapacidade",
  "bpc",
  "loas",
];

const TERMOS_EXCECAO_ACUMULACAO = [
  "assistência médica",
  "assistencia medica",
  "pensão especial indenizatória",
  "pensao especial indenizatoria",
  "bolsa família",
  "bolsa familia",
  "renda cidadã",
  "renda cidada",
];

function contemTermo(texto: string, termos: string[]): boolean {
  const lower = texto.toLowerCase();
  return termos.some((t) => lower.includes(t));
}

/** Regras determinísticas pra processos de BPC/LOAS (B87 deficiência, B88
 * idoso — NÃO inclui B80, que é Salário-Maternidade, benefício totalmente
 * diferente sem teste de renda) — codificadas em código, não em prompt de
 * IA, conforme regra R1/R2 do pacote especialista: cada alerta cita o
 * dispositivo exato da Base Legal Viva que o fundamenta. */
async function avaliarRegrasBpc(
  processoId: string,
  cliente: {
    status_beneficio: string | null;
    tipo_beneficio: string | null;
    tipo_incapacidade: string | null;
    doc: string | null;
    renda_familiar_per_capita: string | null;
    membros_familia: unknown;
  }
): Promise<RegraResultado[]> {
  const resultados: RegraResultado[] = [];

  // 1. Acumulação de benefício (LOAS art. 20, § 4º)
  if (
    cliente.status_beneficio === "ativo" &&
    cliente.tipo_beneficio &&
    contemTermo(cliente.tipo_beneficio, TERMOS_BENEFICIO_ACUMULAVEL) &&
    !contemTermo(cliente.tipo_beneficio, TERMOS_EXCECAO_ACUMULACAO)
  ) {
    resultados.push({
      codigo: "bpc_acumulacao",
      gravidade: "alto",
      descricao: `O cliente tem o benefício "${cliente.tipo_beneficio}" com status ATIVO. A LOAS veda acumular BPC com outro benefício da seguridade social, exceto assistência médica, pensão especial indenizatória e transferências de renda constitucionais. Confira se esse benefício está entre as exceções antes de prosseguir — se não estiver, isso pode inviabilizar o BPC ou exigir estratégia de escolha entre benefícios.`,
      baseLegal: "Lei 8.742/1993, art. 20, § 4º",
    });
  }

  // 2. Impedimento de longo prazo inconsistente com BPC-deficiência
  // (LOAS art. 20, §§ 2º e 10 — mínimo 2 anos de efeitos)
  if (cliente.tipo_incapacidade === "temporaria") {
    resultados.push({
      codigo: "bpc_impedimento_prazo",
      gravidade: "medio",
      descricao: `O cadastro indica incapacidade "temporária", mas o BPC por deficiência exige impedimento de longo prazo (efeitos por no mínimo 2 anos, art. 20 §10) — não incapacidade laborativa temporária. Confirme se o quadro clínico documentado realmente atende ao critério de longo prazo antes de montar a tese; se não atender, pode ser caso de outro benefício (auxílio por incapacidade), não de BPC.`,
      baseLegal: "Lei 8.742/1993, art. 20, §§ 2º e 10",
    });
  }

  // 3. Dado crítico de miserabilidade ausente (LOAS art. 20, §§ 3º/3º-A/11)
  const semRenda =
    !cliente.renda_familiar_per_capita ||
    cliente.renda_familiar_per_capita.trim() === "";
  const semGrupoFamiliar =
    !Array.isArray(cliente.membros_familia) ||
    cliente.membros_familia.length === 0;
  if (semRenda || semGrupoFamiliar) {
    resultados.push({
      codigo: "bpc_miserabilidade_dados_faltando",
      gravidade: "medio",
      descricao: `Falta ${semRenda ? "a renda familiar per capita" : ""}${semRenda && semGrupoFamiliar ? " e " : ""}${semGrupoFamiliar ? "a composição do grupo familiar" : ""} no cadastro do cliente — dados exigidos pra aferir a miserabilidade (critério de 1/4 do salário-mínimo, com possibilidade de ampliação e outros elementos probatórios). Sem isso, o Diagnóstico Estratégico e a Petição ficam sem base concreta pra tese de miserabilidade.`,
      baseLegal: "Lei 8.742/1993, art. 20, §§ 3º, 3º-A e 11",
    });
  }

  // 4. CPF ausente — requisito explícito de concessão (LOAS art. 20, §12)
  if (!cliente.doc || cliente.doc.trim() === "") {
    resultados.push({
      codigo: "bpc_cpf_ausente",
      gravidade: "impeditivo",
      descricao: `O cliente não tem CPF cadastrado. A inscrição no CPF e no CadÚnico é requisito explícito pra concessão, manutenção e revisão do BPC — sem isso o pedido não tem como prosseguir.`,
      baseLegal: "Lei 8.742/1993, art. 20, § 12",
    });
  }

  return resultados;
}

const CINCO_ANOS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

/** Regra genérica (qualquer benefício, não só BPC): DER com mais de 5 anos
 * sinaliza risco de prescrição das parcelas mais antigas — prescrição
 * quinquenal das prestações previdenciárias, com base específica no art.
 * 103, parágrafo único, da Lei 8.213/91 (entendimento pacífico de que não
 * atinge o fundo de direito, só as parcelas vencidas há mais de 5 anos da
 * propositura/requerimento). Gravidade 'medio': é alerta pro advogado
 * conferir o cálculo dos atrasados, não motivo pra travar o processo. */
function avaliarPrescricaoQuinquenal(der: string | null): RegraResultado[] {
  if (!der) return [];
  const dataDer = new Date(der);
  if (Number.isNaN(dataDer.getTime())) return [];
  const anosDesdeDer = (Date.now() - dataDer.getTime()) / CINCO_ANOS_MS;
  if (anosDesdeDer <= 1) return [];
  return [
    {
      codigo: "prescricao_quinquenal",
      gravidade: "medio",
      descricao: `A DER deste processo (${dataDer.toLocaleDateString("pt-BR")}) foi há mais de 5 anos. Parcelas vencidas há mais de 5 anos contados da propositura/requerimento podem estar prescritas (prescrição quinquenal das prestações) — confira o cálculo dos atrasados antes de pedir retroativo ao limite da DER.`,
      baseLegal:
        "Lei 8.213/1991, art. 103, parágrafo único (prescrição quinquenal das prestações)",
    },
  ];
}

/** Roda as regras determinísticas aplicáveis ao processo e grava em
 * pontos_atencao. As regras de BPC só rodam pra B87/B88; a de prescrição
 * roda pra qualquer processo com DER preenchida. Idempotente:
 * um ponto já resolvido manualmente pelo advogado não é reaberto
 * automaticamente — só re-avaliado se ainda não tinha sido resolvido. */
export async function avaliarPontosAtencao(processoId: string): Promise<void> {
  const [processo] = await sql`
    SELECT p.tipo_acao, p.der::text, c.status_beneficio, c.tipo_beneficio,
           c.tipo_incapacidade, c.doc, c.renda_familiar_per_capita,
           c.membros_familia
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${processoId}::uuid
  `;
  if (!processo) return;

  const codigo = processo.tipo_acao ? codigoDoTipo(processo.tipo_acao) : null;
  const ehBpc = codigo === "B87" || codigo === "B88"; // NÃO B80 (Salário-Maternidade, sem teste de renda)

  const resultados = [
    ...(ehBpc
      ? await avaliarRegrasBpc(processoId, {
          status_beneficio: processo.status_beneficio ?? null,
          tipo_beneficio: processo.tipo_beneficio ?? null,
          tipo_incapacidade: processo.tipo_incapacidade ?? null,
          doc: processo.doc ?? null,
          renda_familiar_per_capita: processo.renda_familiar_per_capita ?? null,
          membros_familia: processo.membros_familia,
        })
      : []),
    ...avaliarPrescricaoQuinquenal(processo.der ?? null),
  ];

  for (const r of resultados) {
    await sql`
      INSERT INTO pontos_atencao (processo_id, codigo, gravidade, descricao, base_legal)
      VALUES (${processoId}::uuid, ${r.codigo}, ${r.gravidade}, ${r.descricao}, ${r.baseLegal})
      ON CONFLICT (processo_id, codigo) DO UPDATE SET
        gravidade = EXCLUDED.gravidade,
        descricao = EXCLUDED.descricao,
        base_legal = EXCLUDED.base_legal
      WHERE pontos_atencao.resolvido = false
    `;
  }
}

export async function listarPontosAtencao(
  processoId: string
): Promise<PontoAtencao[]> {
  const rows = await sql`
    SELECT id::text, processo_id::text, codigo, gravidade, descricao,
           base_legal, resolvido, criado_em::text
    FROM pontos_atencao
    WHERE processo_id = ${processoId}::uuid
    ORDER BY
      CASE gravidade WHEN 'impeditivo' THEN 0 WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END,
      criado_em DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processoId: r.processo_id,
    codigo: r.codigo,
    gravidade: r.gravidade,
    descricao: r.descricao,
    baseLegal: r.base_legal,
    resolvido: r.resolvido,
    criadoEm: r.criado_em,
  }));
}

export async function resolverPontoAtencao(
  pontoId: string,
  usuarioId: string
): Promise<void> {
  await sql`
    UPDATE pontos_atencao
    SET resolvido = true, resolvido_por = ${usuarioId}::uuid, resolvido_em = NOW()
    WHERE id = ${pontoId}::uuid
  `;
}
