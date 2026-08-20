// Teste de integração ponta a ponta da comissão automática — cria dados
// descartáveis (client/colaboradores/processo/lançamento marcados "TESTE"),
// exercita gerarComissaoAutomaticaPorPagamento exatamente como as actions
// reais fazem, confere o resultado no banco, e apaga tudo ao final.
import { config } from "dotenv";
config({ path: ".env.local" });

let falhas = 0;
function check(nome: string, ok: boolean, detalhe?: string) {
  if (!ok) falhas++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${nome}${detalhe ? " — " + detalhe : ""}`
  );
}

async function main() {
  const sql = (await import("../src/lib/db")).default;
  const { gerarComissaoAutomaticaPorPagamento } =
    await import("../src/lib/comissao-colaborador");
  const { getMeuFinanceiroInitial } =
    await import("../src/lib/meu-financeiro-db");
  const { getLancamentoKpis } = await import("../src/lib/lancamentos-db");

  let clientId: string | null = null;
  let colabAId: string | null = null;
  let colabBId: string | null = null;
  let processoId: string | null = null;
  let lancamentoId: string | null = null;
  let usuarioBId: string | null = null;

  try {
    // ── Setup ──────────────────────────────────────────────────────────
    const clientRows = await sql`
      INSERT INTO clients (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state)
      VALUES ('PF', 'TESTE COMISSAO AUTOMATICA', '00000000000', 'teste@teste.com', '00000000000',
              '00000000', 'Rua Teste', '1', 'Bairro Teste', 'Cidade Teste', 'AL')
      RETURNING id::text
    `;
    clientId = clientRows[0].id;
    console.log(`  cliente de teste criado: ${clientId}`);

    const colabRows = await sql`
      INSERT INTO colaboradores (nome, cargo, comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct)
      VALUES
        ('TESTE Colaborador A', 'advogado', 20, 15, 25),
        ('TESTE Colaborador B', 'advogado', 20, 15, 25)
      RETURNING id::text, nome
    `;
    colabAId = colabRows.find((r) => r.nome.endsWith("A"))!.id;
    colabBId = colabRows.find((r) => r.nome.endsWith("B"))!.id;
    console.log(
      `  colaboradores de teste criados: A=${colabAId} B=${colabBId}`
    );

    // Cenário: A fez o administrativo (negado), B assumiu e venceu no judicial.
    const processoRows = await sql`
      INSERT INTO processos (
        client_id, tipo_acao, area, status, estagio_producao,
        resultado_administrativo, resultado_judicial,
        responsavel_id, responsavel_administrativo_id, responsavel_judicial_id
      ) VALUES (
        ${clientId}::uuid, 'TESTE BPC', 'Previdenciário', 'ativo', 'judicial',
        'negado', 'procedente',
        ${colabBId}::uuid, ${colabAId}::uuid, ${colabBId}::uuid
      )
      RETURNING id::text
    `;
    processoId = processoRows[0].id;
    console.log(`  processo de teste criado: ${processoId}`);

    const lancRows = await sql`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, client_id, processo_id, status, data_vencimento)
      VALUES ('entrada', 'Honorário', 'TESTE honorário', 1000, ${clientId}::uuid, ${processoId}::uuid, 'pendente', CURRENT_DATE)
      RETURNING id::text
    `;
    lancamentoId = lancRows[0].id;
    console.log(`  lançamento de teste criado: ${lancamentoId} (R$ 1000)`);

    // ── Simula o que markAsPagoAction faz antes de chamar a função ──────
    await sql`UPDATE lancamentos SET status = 'pago', data_pagamento = CURRENT_DATE WHERE id = ${lancamentoId}::uuid`;
    await gerarComissaoAutomaticaPorPagamento(lancamentoId!, processoId, 1000);

    // ── Verificação ───────────────────────────────────────────────────
    const remRows = await sql`
      SELECT colaborador_id::text, valor, status, descricao
      FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid
      ORDER BY valor DESC
    `;
    console.log(`  remunerações geradas: ${remRows.length}`);
    for (const r of remRows) {
      console.log(
        `    - colaborador=${r.colaborador_id} valor=${r.valor} status=${r.status}`
      );
    }

    check(
      "gerou exatamente 1 remuneração (só quem venceu)",
      remRows.length === 1,
      `obtido ${remRows.length}`
    );
    const remB = remRows.find((r) => r.colaborador_id === colabBId);
    check("remuneração é do colaborador B (venceu o judicial)", !!remB);
    check(
      "valor da remuneração = R$150 (15% de 1000)",
      remB != null && Number(remB.valor) === 150,
      remB ? `obtido ${remB.valor}` : "sem linha"
    );
    check(
      "status nasce como 'pendente' (aguarda confirmação)",
      remB?.status === "pendente",
      `obtido ${remB?.status}`
    );
    const remA = remRows.find((r) => r.colaborador_id === colabAId);
    check(
      "colaborador A (perdeu o administrativo) não recebeu nada",
      remA == null
    );

    const lancMirror = await sql`
      SELECT valor, status, categoria FROM lancamentos WHERE remuneracao_id = (
        SELECT id FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid LIMIT 1
      )
    `;
    check(
      "lançamento espelhado (saída) foi criado com o mesmo valor",
      lancMirror.length === 1 && Number(lancMirror[0].valor) === 150
    );

    // ── Idempotência: rodar de novo não deve duplicar ────────────────
    await gerarComissaoAutomaticaPorPagamento(lancamentoId!, processoId, 1000);
    const remRows2 = await sql`
      SELECT id FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid
    `;
    check(
      "rodar de novo pro mesmo lançamento não duplica (idempotente)",
      remRows2.length === remRows.length,
      `obtido ${remRows2.length}, esperado ${remRows.length}`
    );

    // ── Parte 2: dar baixa na comissão e conferir Meu Financeiro ────────
    console.log("\n  Parte 2 — dar baixa na comissão do colaborador B...");
    const usuarioRows = await sql`
      INSERT INTO usuarios (login, nome, categoria, colaborador_id, ativo)
      VALUES ('teste_comissao_baixa', 'TESTE Usuario B', 'Advogado(a)', ${colabBId}::uuid, true)
      RETURNING id::text
    `;
    usuarioBId = usuarioRows[0].id;

    // Antes de dar baixa: confere que a comissão aparece como "a receber"
    const antes = await getMeuFinanceiroInitial(usuarioBId!);
    check(
      "antes da baixa: aparece em 'a receber' (remunerações pendentes)",
      antes.escritorioMes.totalAReceber >= 150,
      `totalAReceber=${antes.escritorioMes.totalAReceber}`
    );
    check(
      "antes da baixa: ainda não conta como recebido no mês",
      antes.escritorioMes.recebidoMes === 0,
      `recebidoMes=${antes.escritorioMes.recebidoMes}`
    );

    // Replica exatamente o que markRemuneracaoPagaAction faz
    await sql`
      UPDATE remuneracoes SET status = 'pago', data_pagamento = CURRENT_DATE, updated_at = NOW()
      WHERE origem_lancamento_id = ${lancamentoId}::uuid
    `;
    await sql`
      UPDATE lancamentos SET status = 'pago', data_pagamento = CURRENT_DATE
      WHERE remuneracao_id = (SELECT id FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid)
    `;

    // Depois de dar baixa: confere "recebido no mês" e "a receber"
    const depois = await getMeuFinanceiroInitial(usuarioBId!);
    check(
      "depois da baixa: entra em 'recebido no mês'",
      depois.escritorioMes.recebidoMes >= 150,
      `recebidoMes=${depois.escritorioMes.recebidoMes}`
    );
    check(
      "depois da baixa: sai de 'a receber' (não conta mais como pendente)",
      depois.escritorioMes.totalAReceber ===
        antes.escritorioMes.totalAReceber - 150,
      `antes=${antes.escritorioMes.totalAReceber} depois=${depois.escritorioMes.totalAReceber}`
    );

    // Confere que também aparece corretamente no Financeiro geral (folha)
    const kpisAntesEDepois = await getLancamentoKpis();
    check(
      "aparece na folha paga do Financeiro geral",
      kpisAntesEDepois.folhaPaga >= 150,
      `folhaPaga=${kpisAntesEDepois.folhaPaga}`
    );
  } finally {
    // ── Limpeza — sempre executa, mesmo se algum check falhar ──────────
    console.log("\n  limpando dados de teste...");
    if (usuarioBId)
      await sql`DELETE FROM usuarios WHERE id = ${usuarioBId}::uuid`;
    if (lancamentoId) {
      await sql`DELETE FROM remuneracoes WHERE origem_lancamento_id = ${lancamentoId}::uuid`;
      await sql`DELETE FROM lancamentos WHERE id = ${lancamentoId}::uuid`;
    }
    if (processoId)
      await sql`DELETE FROM processos WHERE id = ${processoId}::uuid`;
    if (colabAId)
      await sql`DELETE FROM colaboradores WHERE id = ${colabAId}::uuid`;
    if (colabBId)
      await sql`DELETE FROM colaboradores WHERE id = ${colabBId}::uuid`;
    if (clientId) await sql`DELETE FROM clients WHERE id = ${clientId}::uuid`;
    console.log("  limpeza concluída.");
  }

  console.log(
    falhas === 0
      ? "\n✓ Integração funcionando de ponta a ponta."
      : `\n✗ ${falhas} verificação(ões) falharam.`
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("ERRO no teste:", err);
  process.exit(1);
});
