// Testes de regressão contra docs/pacote-especialista/tests/golden-set.json
// — só os casos que já têm implementação real no código (ver comentário por
// caso). Os demais ainda dependem de features não construídas (Juiz
// Revisor, Auditor Legal por data, Estrategista com INSUFICIENTE, etc.) —
// aparecem como SKIP, não como falha, pra não mascarar "passou" com algo
// que não foi testado de verdade.
//
// Rodar com: npx tsx scripts/golden-set-test.ts

import { config } from "dotenv";
config({ path: ".env.local" });

type Resultado = "PASS" | "FAIL" | "SKIP";

const resultados: { id: string; resultado: Resultado; detalhe: string }[] = [];

function registrar(id: string, resultado: Resultado, detalhe: string) {
  resultados.push({ id, resultado, detalhe });
  const marca = resultado === "PASS" ? "✓" : resultado === "FAIL" ? "✗" : "—";
  console.log(`${marca} ${id}: ${detalhe}`);
}

async function testarT1LeiDesatualizada() {
  const { getDispositivo } = await import("../src/lib/base-legal-db");
  const d = await getDispositivo("Lei 8.742/1993", "art. 20, § 2º");
  if (!d) {
    registrar(
      "T1-lei-desatualizada",
      "FAIL",
      "dispositivo não encontrado na base"
    );
    return;
  }
  const criterioAntigo = /deficiência grave que impe(ça|ssa)/i.test(d.texto);
  const criterioVigente =
    /impedimento de longo prazo/i.test(d.texto) &&
    /participação plena e efetiva/i.test(d.texto);
  if (criterioAntigo) {
    registrar(
      "T1-lei-desatualizada",
      "FAIL",
      "Base Legal Viva contém o critério antigo/superado"
    );
  } else if (criterioVigente) {
    registrar(
      "T1-lei-desatualizada",
      "PASS",
      "art. 20 §2º na Base Legal Viva usa a redação vigente (impedimento de longo prazo + participação plena e efetiva)"
    );
  } else {
    registrar(
      "T1-lei-desatualizada",
      "FAIL",
      "texto do §2º não bate com nenhum dos dois critérios esperados"
    );
  }
}

async function testarT2Acumulacao() {
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  // Processo sintético descartável — não usa dado de cliente real.
  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood,
       city, state, status, status_beneficio, tipo_beneficio)
    VALUES
      ('PF', '_TESTE GOLDEN SET T2', '000.000.000-00', '_teste@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL',
       'Ativo', 'ativo', 'Pensão por morte')
    RETURNING id::text
  `;
  const [processo] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status)
    VALUES (${cliente.id}::uuid, 'B87 - BPC à pessoa com deficiência', 'Previdenciário', 'Em andamento')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(processo.id);
    const pontos = await listarPontosAtencao(processo.id);
    const achou = pontos.find((p) => p.codigo === "bpc_acumulacao");
    if (
      achou &&
      achou.gravidade !== "baixo" &&
      achou.baseLegal?.includes("§ 4º")
    ) {
      registrar(
        "T2-acumulacao",
        "PASS",
        `ponto de atenção gerado: [${achou.gravidade}] ${achou.baseLegal}`
      );
    } else {
      registrar(
        "T2-acumulacao",
        "FAIL",
        "regra bpc_acumulacao não disparou para benefício ativo não-exceção"
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id = ${processo.id}::uuid`;
    await sql`DELETE FROM processos WHERE id = ${processo.id}::uuid`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarPrescricaoQuinquenal() {
  // Não é um caso do golden-set original — regra genérica (qualquer
  // benefício) que criei além do que o pacote pedia, por isso tratado como
  // teste próprio, não um "T-" do golden-set.
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
    VALUES
      ('PF', '_TESTE GOLDEN SET prescricao', '222.222.222-22', '_teste3@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL', 'Ativo')
    RETURNING id::text
  `;
  const [antigo] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, der)
    VALUES (${cliente.id}::uuid, 'B31 - Auxílio-doença', 'Previdenciário', 'Em andamento', '2015-01-01')
    RETURNING id::text
  `;
  const [recente] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, der)
    VALUES (${cliente.id}::uuid, 'B31 - Auxílio-doença', 'Previdenciário', 'Em andamento', NOW())
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(antigo.id);
    await avaliarPontosAtencao(recente.id);
    const pontosAntigo = await listarPontosAtencao(antigo.id);
    const pontosRecente = await listarPontosAtencao(recente.id);
    const disparouNoAntigo = pontosAntigo.some(
      (p) => p.codigo === "prescricao_quinquenal"
    );
    const naoDisparouNoRecente = !pontosRecente.some(
      (p) => p.codigo === "prescricao_quinquenal"
    );
    if (disparouNoAntigo && naoDisparouNoRecente) {
      registrar(
        "prescricao-quinquenal",
        "PASS",
        "alerta dispara pra DER de 2015, não dispara pra DER de hoje"
      );
    } else {
      registrar(
        "prescricao-quinquenal",
        "FAIL",
        `disparouNoAntigo=${disparouNoAntigo} naoDisparouNoRecente=${naoDisparouNoRecente}`
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id IN (${antigo.id}::uuid, ${recente.id}::uuid)`;
    await sql`DELETE FROM processos WHERE id IN (${antigo.id}::uuid, ${recente.id}::uuid)`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarCitacaoComIncisoDentroDeParagrafo() {
  // Regressão de um 3º bug real achado na prática: "art. 2º, § 1º, I" (um
  // inciso DENTRO de um parágrafo) não batia com nada, porque o
  // normalizador só sabia montar caminho de 2 níveis (art+parág OU
  // art+inciso, nunca os três juntos). Também cobre o "º" grudado no
  // número do artigo ("art. 2º") que quebrava a detecção do que vinha
  // depois.
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const r = await verificarCitacoesLegais(
    "Nos termos do art. 2º, § 1º, I, da Lei 13.146/2015, consideram-se os impedimentos nas funções e nas estruturas do corpo."
  );
  const achou = r.verificadas.find(
    (c) => c.norma === "Lei 13.146/2015" && c.caminho === "art. 2, § 1º, I"
  );
  if (achou) {
    registrar(
      "citation-gate-inciso-em-paragrafo (regressão)",
      "PASS",
      "citação de 3 níveis (artigo + parágrafo + inciso) verificada corretamente"
    );
  } else {
    registrar(
      "citation-gate-inciso-em-paragrafo (regressão)",
      "FAIL",
      `esperado 'art. 2, § 1º, I' verificado; veio verificadas=${JSON.stringify(r.verificadas.map((c) => c.caminho))} naoEncontradas=${JSON.stringify(r.naoEncontradas.map((c) => c.caminho))}`
    );
  }
}

async function testarT6EquivalenteCitacaoFabricada() {
  // golden-set T6 descreve um ACÓRDÃO inventado (jurisprudência) — isso é
  // Fase 2 (Jurisprudência Viva), ainda não construída. O equivalente que
  // JÁ existe é citação de LEI fabricada (artigo/parágrafo que não existe).
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const r = await verificarCitacoesLegais(
    "Conforme o art. 20, § 17, da Lei 8.742/93, o benefício seria devido."
  );
  if (r.naoEncontradas.some((c) => c.caminho === "art. 20, § 17º")) {
    registrar(
      "T6-precedente-inexistente (equivalente: citação de lei fabricada)",
      "PASS",
      "Citation Gate marcou art. 20 §17 (não existe) como naoEncontrada"
    );
  } else {
    registrar(
      "T6-precedente-inexistente (equivalente: citação de lei fabricada)",
      "FAIL",
      "Citation Gate não detectou a citação fabricada"
    );
  }
}

async function testarT7Lacuna() {
  const { getDispositivo } = await import("../src/lib/base-legal-db");
  const d = await getDispositivo("Lei 8.742/1993", "art. 999");
  if (d === null) {
    registrar(
      "T7-lacuna",
      "PASS",
      "getDispositivo retorna null pra artigo inexistente — contrato de dados correto pro chamador tratar como [LACUNA]"
    );
  } else {
    registrar(
      "T7-lacuna",
      "FAIL",
      "retornou um dispositivo que não deveria existir"
    );
  }
}

async function testarCitacaoGateMultiplasNormas() {
  // Regressão de um bug real achado na prática: numa frase citando DUAS leis
  // diferentes perto uma da outra, o parser pegava o artigo errado (o
  // primeiro da janela, não o mais próximo da menção da norma em questão).
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const r = await verificarCitacoesLegais(
    "O art. 20, §2º da LOAS trata de deficiência, e o art. 15, II, da Lei 8.213/91 trata de período de graça."
  );
  const okLoas = r.verificadas.some(
    (c) => c.norma === "Lei 8.742/1993" && c.caminho === "art. 20, § 2º"
  );
  const ok8213 = r.verificadas.some(
    (c) => c.norma === "Lei 8.213/1991" && c.caminho === "art. 15, II"
  );
  if (okLoas && ok8213 && r.naoEncontradas.length === 0) {
    registrar(
      "citation-gate-multi-norma (regressão)",
      "PASS",
      "as duas citações (LOAS e Lei 8.213) foram associadas ao artigo certo, sem mistura"
    );
  } else {
    registrar(
      "citation-gate-multi-norma (regressão)",
      "FAIL",
      `esperado 2 verificadas e 0 naoEncontradas; veio verificadas=${JSON.stringify(r.verificadas.map((c) => c.caminho))} naoEncontradas=${JSON.stringify(r.naoEncontradas.map((c) => c.caminho))}`
    );
  }
}

const NAO_IMPLEMENTADOS: [string, string][] = [
  ["T3-contradicao-avaliacao", "Juiz Revisor não existe ainda (Fase 2)"],
  [
    "T4-miserabilidade",
    "jurisprudência (STF/STJ/TNU) ainda não tem base própria (Fase 2)",
  ],
  ["T5-nome-divergente", "detecção de nome divergente não implementada"],
  ["T8-dados-insuficientes", "Estrategista com INSUFICIENTE não implementado"],
  [
    "T9-aprovacao-humana",
    "não existe tabela 'pecas' com estado/aprovação ainda",
  ],
  [
    "T10-lgpd",
    "mascaramento de dados sensíveis antes do envio ao modelo não implementado",
  ],
  [
    "T11-juiz-revisor-erros-plantados",
    "Juiz Revisor não existe ainda (Fase 2)",
  ],
  [
    "T12-vigencia-temporal",
    "Auditor Legal por data do fato/DER não implementado",
  ],
  ["T13-tema-afetado", "Jurisprudência Viva não existe ainda (Fase 2)"],
  ["T14-kill-switch", "config_agentes/kill switch não implementado"],
];

async function main() {
  await testarT1LeiDesatualizada();
  await testarT2Acumulacao();
  await testarPrescricaoQuinquenal();
  await testarT6EquivalenteCitacaoFabricada();
  await testarT7Lacuna();
  await testarCitacaoGateMultiplasNormas();
  await testarCitacaoComIncisoDentroDeParagrafo();
  for (const [id, motivo] of NAO_IMPLEMENTADOS) {
    registrar(id, "SKIP", motivo);
  }

  const pass = resultados.filter((r) => r.resultado === "PASS").length;
  const fail = resultados.filter((r) => r.resultado === "FAIL").length;
  const skip = resultados.filter((r) => r.resultado === "SKIP").length;
  console.log(
    `\n${pass} PASS · ${fail} FAIL · ${skip} SKIP (de ${resultados.length} casos do golden-set)`
  );
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
