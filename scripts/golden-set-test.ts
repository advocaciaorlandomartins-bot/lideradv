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

async function testarT5NomeDivergente() {
  // T5 do golden-set original: nome do cliente com grafia diferente entre
  // cadastro e documentos. Implementado comparando clients.name com
  // membros_familia[].nome QUANDO O CPF BATE (mesma pessoa provada por
  // CPF, não por similaridade de nome — evita falso positivo comparando
  // pessoas diferentes). Caso real que motivou a regra: "ANTHONY EMANUEL"
  // no cadastro vs "ANTHONY EMANOEL" extraído de documento, mesmo CPF.
  const { avaliarPontosAtencao, listarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const membros = JSON.stringify([
    {
      nome: "ANTHONY EMANOEL SILVA SOARES",
      parentesco: "Filho(a)",
      cpf: "508.612.608-80",
      data_nascimento: "2016-02-10",
    },
  ]);
  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood,
       city, state, status, membros_familia)
    VALUES
      ('PF', 'ANTHONY EMANUEL SILVA SOARES', '508.612.608-80',
       '_teste_golden_t5@teste.local', '00000000000', '00000-000', 'Rua Teste',
       '0', 'Teste', 'Teste', 'AL', 'Ativo', ${membros}::jsonb)
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
    const achou = pontos.find((p) => p.codigo === "nome_divergente");
    if (achou) {
      registrar(
        "T5-nome-divergente",
        "PASS",
        "divergência de grafia detectada via CPF em comum (cadastro × membros_familia)"
      );
    } else {
      registrar(
        "T5-nome-divergente",
        "FAIL",
        "regra nome_divergente não disparou"
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id = ${processo.id}::uuid`;
    await sql`DELETE FROM processos WHERE id = ${processo.id}::uuid`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarCessacaoIndevida() {
  // Regra nova (art. 21, § 5º da LOAS, seedado depois do golden-set
  // original): motivo de indeferimento/resultado administrativo mencionando
  // cessação/suspensão + incapacidade "permanente" no cadastro deve gerar
  // alerta de possível cessação indevida (dispensa de perícia periódica).
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood,
       city, state, status, tipo_incapacidade)
    VALUES
      ('PF', '_TESTE GOLDEN SET cessacao', '555.555.555-55', '_teste6@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL',
       'Ativo', 'permanente')
    RETURNING id::text
  `;
  const [processo] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, motivo_indeferimento)
    VALUES (${cliente.id}::uuid, 'B87 - BPC à pessoa com deficiência', 'Previdenciário',
            'Em andamento', 'Benefício cessado em revisão bienal')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(processo.id);
    const pontos = await listarPontosAtencao(processo.id);
    const achou = pontos.find(
      (p) => p.codigo === "bpc_cessacao_possivelmente_indevida"
    );
    if (achou && achou.baseLegal?.includes("§ 5º")) {
      registrar(
        "cessacao-indevida",
        "PASS",
        `ponto de atenção gerado: [${achou.gravidade}] ${achou.baseLegal}`
      );
    } else {
      registrar(
        "cessacao-indevida",
        "FAIL",
        "regra bpc_cessacao_possivelmente_indevida não disparou"
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id = ${processo.id}::uuid`;
    await sql`DELETE FROM processos WHERE id = ${processo.id}::uuid`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarB80NaoEhBpc() {
  // Bug real achado em produção: B80 é Salário-Maternidade (sem teste de
  // renda), mas o código tratava B80 junto com B87/B88 (BPC) por engano —
  // 2 processos reais de salário-maternidade receberam o alerta
  // "bpc_miserabilidade_dados_faltando" (pedindo renda familiar/grupo
  // familiar, que não tem nada a ver com salário-maternidade). Já corrigi
  // os dados reais; este teste é pra nunca mais regredir.
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
    VALUES
      ('PF', '_TESTE GOLDEN SET B80', '333.333.333-33', '_teste4@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL', 'Ativo')
    RETURNING id::text
  `;
  // Propositalmente SEM renda_familiar_per_capita/membros_familia — se o
  // bug voltar, isso dispararia bpc_miserabilidade_dados_faltando de novo.
  const [processo] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status)
    VALUES (${cliente.id}::uuid, 'B80 - Salário Maternidade', 'Previdenciário', 'Em andamento')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(processo.id);
    const pontos = await listarPontosAtencao(processo.id);
    const algumBpc = pontos.some((p) => p.codigo.startsWith("bpc_"));
    if (!algumBpc) {
      registrar(
        "b80-nao-eh-bpc (regressão)",
        "PASS",
        "processo B80 (salário-maternidade) não recebeu nenhuma regra de BPC"
      );
    } else {
      registrar(
        "b80-nao-eh-bpc (regressão)",
        "FAIL",
        `B80 recebeu regra(s) de BPC indevidamente: ${pontos.map((p) => p.codigo).join(", ")}`
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

async function testarT8DadosInsuficientes() {
  // Até esta correção, essa regra só rodava dentro de cerebroJuridico.ts,
  // que usa "server-only" e não resolve fora do Next — por isso ficava
  // marcada como SKIP (revisão manual de código, não teste de verdade).
  // Extraída a lógica pura pra cerebro-probabilidade.ts (sem "server-only")
  // especificamente pra poder testar isso de verdade.
  const { calcularProbabilidadeComFlag } =
    await import("../src/lib/cerebro-probabilidade");
  const faltante = (prioridade: "alta" | "media" | "baixa") => ({
    campo: "x",
    prioridade,
    impacto: "",
    destino: "processo" as const,
  });

  const com2Criticos = calcularProbabilidadeComFlag(
    [faltante("alta"), faltante("alta"), faltante("baixa")],
    85
  );
  const com1Critico = calcularProbabilidadeComFlag(
    [faltante("alta"), faltante("media")],
    85
  );

  const ok =
    com2Criticos.prob === null &&
    com2Criticos.probabilidadeInsuficiente === true &&
    com1Critico.prob === 85 &&
    com1Critico.probabilidadeInsuficiente === false;

  if (ok) {
    registrar(
      "T8-dados-insuficientes",
      "PASS",
      "2+ dados críticos faltando força prob=null + flag; com só 1 crítico, probabilidade passa normal"
    );
  } else {
    registrar(
      "T8-dados-insuficientes",
      "FAIL",
      `com2Criticos=${JSON.stringify(com2Criticos)} com1Critico=${JSON.stringify(com1Critico)}`
    );
  }
}

async function testarTransicaoEC103() {
  // Regra nova (T12, parcial): aposentadoria (B41/B42/B46) com DER antes de
  // 13/11/2019 deve alertar pra conferir direito adquirido pela regra
  // anterior à EC 103/2019; depois dessa data, e benefícios por
  // incapacidade (B31), não deve disparar.
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
    VALUES
      ('PF', '_TESTE GOLDEN SET ec103', '333.333.333-33', '_teste4@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL', 'Ativo')
    RETURNING id::text
  `;
  const [antes] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, der)
    VALUES (${cliente.id}::uuid, 'B42 - Aposentadoria por Tempo de Contribuição', 'Previdenciário', 'Em andamento', '2018-01-01')
    RETURNING id::text
  `;
  const [depois] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, der)
    VALUES (${cliente.id}::uuid, 'B42 - Aposentadoria por Tempo de Contribuição', 'Previdenciário', 'Em andamento', '2022-01-01')
    RETURNING id::text
  `;
  const [incapacidade] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, der)
    VALUES (${cliente.id}::uuid, 'B31 - Auxílio-doença', 'Previdenciário', 'Em andamento', '2018-01-01')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(antes.id);
    await avaliarPontosAtencao(depois.id);
    await avaliarPontosAtencao(incapacidade.id);
    const codigo = "transicao_ec103_direito_adquirido";
    const disparouAntes = (await listarPontosAtencao(antes.id)).some(
      (p) => p.codigo === codigo
    );
    const naoDisparouDepois = !(await listarPontosAtencao(depois.id)).some(
      (p) => p.codigo === codigo
    );
    const naoDisparouIncapacidade = !(
      await listarPontosAtencao(incapacidade.id)
    ).some((p) => p.codigo === codigo);
    if (disparouAntes && naoDisparouDepois && naoDisparouIncapacidade) {
      registrar(
        "transicao-ec103 (regressão)",
        "PASS",
        "B42 com DER pré-reforma alerta direito adquirido; pós-reforma e B31 não disparam"
      );
    } else {
      registrar(
        "transicao-ec103 (regressão)",
        "FAIL",
        `disparouAntes=${disparouAntes} naoDisparouDepois=${naoDisparouDepois} naoDisparouIncapacidade=${naoDisparouIncapacidade}`
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id IN (${antes.id}::uuid, ${depois.id}::uuid, ${incapacidade.id}::uuid)`;
    await sql`DELETE FROM processos WHERE id IN (${antes.id}::uuid, ${depois.id}::uuid, ${incapacidade.id}::uuid)`;
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

async function testarCitacaoPluralEArtigoComHifen() {
  // 5º e 6º bugs reais achados: "arts. 57 e 58" (plural, sem a palavra
  // "artigo" no singular) não gerava NENHUM match — a citação ficava
  // completamente invisível pro relatório, nem verificada nem não
  // encontrada. E "art. 20-B" (artigo com sufixo de letra, comum: 20-A,
  // 20-B, 27-A...) não achava o fallback ", caput" porque o regex do
  // fallback não previa o hífen antes da letra.
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");

  const rPlural = await verificarCitacoesLegais(
    "Nos termos dos arts. 57 e 58 da Lei 8.213/91, a atividade especial..."
  );
  const achouPlural = rPlural.verificadas.some(
    (c) => c.norma === "Lei 8.213/1991" && c.caminho === "art. 57"
  );

  const rHifen = await verificarCitacoesLegais(
    "O art. 20-B da Lei 8.742/93 trata dos elementos probatórios."
  );
  const achouHifen = rHifen.verificadas.some(
    (c) => c.norma === "Lei 8.742/1993" && c.caminho === "art. 20-B"
  );

  if (achouPlural && achouHifen) {
    registrar(
      "citation-gate-plural-e-hifen (regressão)",
      "PASS",
      "'arts. 57 e 58' (plural) e 'art. 20-B' (hífen+letra) verificados corretamente"
    );
  } else {
    registrar(
      "citation-gate-plural-e-hifen (regressão)",
      "FAIL",
      `achouPlural=${achouPlural} achouHifen=${achouHifen}`
    );
  }
}

async function testarParagrafoUnico() {
  // 7º bug real: "parágrafo único" (forma sem número, usada quando o artigo
  // só tem um parágrafo — ex.: art. 103 da Lei 8.213, prescrição
  // quinquenal) não batia com o regex de parágrafo numerado (\d+) e virava
  // invisível, caindo pro caput do artigo — risco real de "verificar" a
  // citação errada (o caput de um artigo pode ser uma regra totalmente
  // diferente do seu parágrafo único, como é o caso do próprio art. 103:
  // caput = decadência de 10 anos, parágrafo único = prescrição de 5 anos).
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const r = await verificarCitacoesLegais(
    "Nos termos do art. 103, parágrafo único, da Lei 8.213/91, prescreve em cinco anos a ação para haver prestações vencidas."
  );
  const achou = r.verificadas.some(
    (c) =>
      c.norma === "Lei 8.213/1991" && c.caminho === "art. 103, parágrafo único"
  );
  if (achou) {
    registrar(
      "citation-gate-paragrafo-unico (regressão)",
      "PASS",
      "'parágrafo único' distinguido corretamente do caput do artigo"
    );
  } else {
    registrar(
      "citation-gate-paragrafo-unico (regressão)",
      "FAIL",
      `esperado 'art. 103, parágrafo único'; veio verificadas=${JSON.stringify(r.verificadas.map((c) => c.caminho))}`
    );
  }
}

async function testarParagrafoDuploSimbolo() {
  // 8º bug real: "§§ 3º e 11" (dois símbolos de parágrafo, citação de mais
  // de um parágrafo de uma vez — forma comum: "art. 20, §§ 3º e 11, da
  // LOAS") não batia com o regex de § único e a citação inteira ficava
  // invisível, igual o bug do plural "arts." (mesma família de problema:
  // regex não previa a forma plural da referência).
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const r = await verificarCitacoesLegais(
    "O art. 20, §§ 3º e 11, da Lei 8.742/93 tratam da miserabilidade."
  );
  const achou = r.verificadas.some(
    (c) => c.norma === "Lei 8.742/1993" && c.caminho === "art. 20, § 3º"
  );
  if (achou) {
    registrar(
      "citation-gate-paragrafo-duplo-simbolo (regressão)",
      "PASS",
      "'§§ 3º e 11' reconhecido (primeiro parágrafo verificado)"
    );
  } else {
    registrar(
      "citation-gate-paragrafo-duplo-simbolo (regressão)",
      "FAIL",
      `esperado 'art. 20, § 3º' verificado; veio verificadas=${JSON.stringify(r.verificadas.map((c) => c.caminho))}`
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

async function testarAutismoB87Lei12764() {
  // Regressão de dois achados juntos: (1) B87/B88 estavam invertidos em
  // ai-juridico-skills.ts (B87 é deficiência, B88 é idoso — conferido
  // contra new-client-form.tsx, a fonte real); (2) Lei 12.764/2012 (Lei
  // Berenice Piva — TEA é pessoa com deficiência por força de lei) não
  // estava na Base Legal Viva nem no Citation Gate.
  const { verificarCitacoesLegais } = await import("../src/lib/citation-gate");
  const { getBaseLegalParaBeneficio } =
    await import("../src/lib/base-legal-db");

  const r = await verificarCitacoesLegais(
    "Nos termos do art. 1º, § 2º, da Lei 12.764/2012, a pessoa com TEA é considerada pessoa com deficiência para todos os efeitos legais."
  );
  const citacaoOk =
    r.verificadas.some(
      (c) => c.norma === "Lei 12.764/2012" && c.caminho === "art. 1, § 2º"
    ) && r.naoEncontradas.length === 0;

  const dispositivosB87 = await getBaseLegalParaBeneficio("B87");
  const mapeamentoOk = dispositivosB87.some(
    (d) => d.norma === "Lei 12.764/2012"
  );

  if (citacaoOk && mapeamentoOk) {
    registrar(
      "autismo-lei-12764 (regressão)",
      "PASS",
      "Lei 12.764/2012 art. 1º §2º verificada pelo Citation Gate e mapeada pro código B87 (deficiência)"
    );
  } else {
    registrar(
      "autismo-lei-12764 (regressão)",
      "FAIL",
      `citacaoOk=${citacaoOk} mapeamentoOk=${mapeamentoOk}`
    );
  }
}

async function testarPontoAtencaoAutismo() {
  // Regra nova: CID F84 (espectro autista) + B87 (deficiência) deve gerar
  // o ponto de atenção lembrando que TEA já é deficiência por força de lei
  // (Lei 12.764/2012); o mesmo CID num processo B88 (idoso) NÃO deve
  // disparar — a equiparação não tem relação com o critério de idade.
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status, cid_principal)
    VALUES
      ('PF', '_TESTE GOLDEN SET autismo', '444.444.444-44', '_teste5@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL', 'Ativo', 'F84.0')
    RETURNING id::text
  `;
  const [b87] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status)
    VALUES (${cliente.id}::uuid, 'B87 - BPC pessoa com deficiência', 'Previdenciário', 'Em andamento')
    RETURNING id::text
  `;
  const [b88] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status)
    VALUES (${cliente.id}::uuid, 'B88 - BPC pessoa idosa', 'Previdenciário', 'Em andamento')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(b87.id);
    await avaliarPontosAtencao(b88.id);
    const codigo = "bpc_autismo_equiparacao_legal";
    const disparouB87 = (await listarPontosAtencao(b87.id)).some(
      (p) => p.codigo === codigo
    );
    const naoDisparouB88 = !(await listarPontosAtencao(b88.id)).some(
      (p) => p.codigo === codigo
    );
    if (disparouB87 && naoDisparouB88) {
      registrar(
        "ponto-atencao-autismo (regressão)",
        "PASS",
        "CID F84 + B87 gera lembrete da equiparação legal (Lei 12.764/2012); B88 (idoso) não dispara"
      );
    } else {
      registrar(
        "ponto-atencao-autismo (regressão)",
        "FAIL",
        `disparouB87=${disparouB87} naoDisparouB88=${naoDisparouB88}`
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id IN (${b87.id}::uuid, ${b88.id}::uuid)`;
    await sql`DELETE FROM processos WHERE id IN (${b87.id}::uuid, ${b88.id}::uuid)`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarSalarioMaternidadeCarencia() {
  // Regra nova: B80 indeferido citando "carência"/"contribuições
  // insuficientes" deve alertar que isso foi declarado inconstitucional
  // pelo STF (ADIs 2.110/2.111, 21/03/2024) — indeferimento por outro
  // motivo (ex.: documentação) não deve disparar.
  const { listarPontosAtencao, avaliarPontosAtencao } =
    await import("../src/lib/pontos-atencao-db");
  const sqlMod = await import("../src/lib/db");
  const sql = sqlMod.default;

  const [cliente] = await sql`
    INSERT INTO clients
      (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
    VALUES
      ('PF', '_TESTE GOLDEN SET salmat', '555.555.555-55', '_teste6@teste.local',
       '00000000000', '00000-000', 'Rua Teste', '0', 'Teste', 'Teste', 'AL', 'Ativo')
    RETURNING id::text
  `;
  const [comCarencia] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, motivo_indeferimento)
    VALUES (${cliente.id}::uuid, 'B80 - Salário-Maternidade', 'Previdenciário', 'Em andamento', 'Indeferido por não cumprir carência mínima de 10 contribuições')
    RETURNING id::text
  `;
  const [semCarencia] = await sql`
    INSERT INTO processos (client_id, tipo_acao, area, status, motivo_indeferimento)
    VALUES (${cliente.id}::uuid, 'B80 - Salário-Maternidade', 'Previdenciário', 'Em andamento', 'Indeferido por ausência de documentação médica')
    RETURNING id::text
  `;
  try {
    await avaliarPontosAtencao(comCarencia.id);
    await avaliarPontosAtencao(semCarencia.id);
    const codigo = "salario_maternidade_carencia_inconstitucional";
    const disparouComCarencia = (
      await listarPontosAtencao(comCarencia.id)
    ).some((p) => p.codigo === codigo);
    const naoDisparouSemCarencia = !(
      await listarPontosAtencao(semCarencia.id)
    ).some((p) => p.codigo === codigo);
    if (disparouComCarencia && naoDisparouSemCarencia) {
      registrar(
        "salario-maternidade-carencia (regressão)",
        "PASS",
        "indeferimento citando carência alerta ADIs 2.110/2.111; indeferimento por outro motivo não dispara"
      );
    } else {
      registrar(
        "salario-maternidade-carencia (regressão)",
        "FAIL",
        `disparouComCarencia=${disparouComCarencia} naoDisparouSemCarencia=${naoDisparouSemCarencia}`
      );
    }
  } finally {
    await sql`DELETE FROM pontos_atencao WHERE processo_id IN (${comCarencia.id}::uuid, ${semCarencia.id}::uuid)`;
    await sql`DELETE FROM processos WHERE id IN (${comCarencia.id}::uuid, ${semCarencia.id}::uuid)`;
    await sql`DELETE FROM clients WHERE id = ${cliente.id}::uuid`;
  }
}

async function testarT14KillSwitch() {
  const { agentesEstaoAtivos, definirAgentesAtivos } =
    await import("../src/lib/config-agentes-db");
  const estadoOriginal = await agentesEstaoAtivos();
  try {
    await definirAgentesAtivos(false, null);
    const desligado = await agentesEstaoAtivos();
    await definirAgentesAtivos(true, null);
    const ligado = await agentesEstaoAtivos();
    if (desligado === false && ligado === true) {
      registrar(
        "T14-kill-switch",
        "PASS",
        "agentesEstaoAtivos() reflete corretamente false→true após definirAgentesAtivos()"
      );
    } else {
      registrar(
        "T14-kill-switch",
        "FAIL",
        `esperado desligado=false ligado=true; veio desligado=${desligado} ligado=${ligado}`
      );
    }
  } finally {
    // restaura o estado real de produção, não deixa o teste como efeito
    // colateral pausando os agentes de verdade
    await definirAgentesAtivos(estadoOriginal, null);
  }
}

const NAO_IMPLEMENTADOS: [string, string][] = [
  ["T3-contradicao-avaliacao", "Juiz Revisor não existe ainda (Fase 2)"],
  [
    "T4-miserabilidade",
    "jurisprudência (STF/STJ/TNU) ainda não tem base própria (Fase 2)",
  ],
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
    "Parcial: EC 103/2019 tem vigente_de verificado e uma regra própria de Pontos de Atenção (ver teste 'transicao-ec103' acima, PASS) alertando direito adquirido quando DER é anterior à reforma. Auditor Legal genérico por data do fato pra QUALQUER dispositivo da Base Legal Viva não foi implementado — exigiria vigência verificada uma por uma pras ~35 leis que alteraram os outros 3 textos cadastrados (LOAS, Lei 8.213, Lei 13.146), o que é pesquisa jurídica dedicada, não preenchimento de coluna",
  ],
  ["T13-tema-afetado", "Jurisprudência Viva não existe ainda (Fase 2)"],
];

async function main() {
  await testarT1LeiDesatualizada();
  await testarT2Acumulacao();
  await testarB80NaoEhBpc();
  await testarT5NomeDivergente();
  await testarCessacaoIndevida();
  await testarPrescricaoQuinquenal();
  await testarT8DadosInsuficientes();
  await testarTransicaoEC103();
  await testarAutismoB87Lei12764();
  await testarPontoAtencaoAutismo();
  await testarSalarioMaternidadeCarencia();
  await testarT6EquivalenteCitacaoFabricada();
  await testarT7Lacuna();
  await testarCitacaoGateMultiplasNormas();
  await testarCitacaoComIncisoDentroDeParagrafo();
  await testarCitacaoPluralEArtigoComHifen();
  await testarParagrafoUnico();
  await testarParagrafoDuploSimbolo();
  await testarT14KillSwitch();
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
