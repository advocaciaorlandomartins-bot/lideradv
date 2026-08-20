// Teste puro (sem tocar dados reais) da lógica de resolução de comissão por
// fase/êxito. Roda os cenários discutidos com o Orlando e falha alto se
// algum não bater. Define um DATABASE_URL dummy antes do import (o módulo
// importa ./db, que só constrói o client — não faz nenhuma query aqui).
process.env.DATABASE_URL ||= "postgres://test:test@localhost/test";

async function main() {
  const { resolveComissaoPctParaColaborador } =
    await import("../src/lib/comissao-colaborador");

  const CONFIG_A = {
    comissao_administrativo_pct: 20,
    comissao_judicial_pct: 15,
    comissao_ambos_pct: 25,
  };

  let falhas = 0;
  function check(nome: string, got: number | null, expected: number | null) {
    const ok = got === expected;
    if (!ok) falhas++;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${nome} — esperado ${expected}, obtido ${got}`
    );
  }

  // 1) Mesma pessoa (A) fez tudo, administrativo concedido → só A, pelo admin_pct
  check(
    "1) concedido, mesma pessoa",
    resolveComissaoPctParaColaborador("A", CONFIG_A, {
      estagio_producao: "administrativo",
      resultado_administrativo: "concedido",
      resultado_judicial: null,
      responsavel_id: "A",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: null,
    }),
    20
  );

  // 2) Mesma pessoa (A), negado → foi pra judicial → procedente → A recebe "ambos"
  check(
    "2) negado→procedente, mesma pessoa",
    resolveComissaoPctParaColaborador("A", CONFIG_A, {
      estagio_producao: "judicial",
      resultado_administrativo: "negado",
      resultado_judicial: "procedente",
      responsavel_id: "A",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: "A",
    }),
    25
  );

  // 3) Cenário do Orlando: A fez administrativo (negado), B assumiu o judicial (procedente)
  //    → A recebe 0 (perdeu a fase dele), B recebe só o judicial_pct dele
  check(
    "3a) fases divididas, A (perdeu adm) recebe 0",
    resolveComissaoPctParaColaborador("A", CONFIG_A, {
      estagio_producao: "judicial",
      resultado_administrativo: "negado",
      resultado_judicial: "procedente",
      responsavel_id: "B",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: "B",
    }),
    0
  );
  check(
    "3b) fases divididas, B (venceu jud) recebe judicial_pct",
    resolveComissaoPctParaColaborador("B", CONFIG_A, {
      estagio_producao: "judicial",
      resultado_administrativo: "negado",
      resultado_judicial: "procedente",
      responsavel_id: "B",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: "B",
    }),
    15
  );

  // 4) Administrativo negado, judicial IMPROCEDENTE → ninguém recebe nada
  check(
    "4) negado→improcedente, ninguém recebe",
    resolveComissaoPctParaColaborador("A", CONFIG_A, {
      estagio_producao: "judicial",
      resultado_administrativo: "negado",
      resultado_judicial: "improcedente",
      responsavel_id: "A",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: "A",
    }),
    0
  );

  // 5) Administrativo negado, judicial AINDA sem resultado, modo "pagamento"
  //    → nada a pagar ainda (mesmo sendo a mesma pessoa)
  check(
    "5) negado, judicial pendente, modo pagamento → 0",
    resolveComissaoPctParaColaborador(
      "A",
      CONFIG_A,
      {
        estagio_producao: "judicial",
        resultado_administrativo: "negado",
        resultado_judicial: null,
        responsavel_id: "A",
        responsavel_administrativo_id: "A",
        responsavel_judicial_id: "A",
      },
      "pagamento"
    ),
    0
  );

  // 6) Mesmo cenário 5, mas modo "estimativa" → mostra expectativa otimista pro
  //    dono do judicial
  check(
    "6) negado, judicial pendente, modo estimativa → otimista",
    resolveComissaoPctParaColaborador(
      "A",
      CONFIG_A,
      {
        estagio_producao: "judicial",
        resultado_administrativo: "negado",
        resultado_judicial: null,
        responsavel_id: "A",
        responsavel_administrativo_id: "A",
        responsavel_judicial_id: "A",
      },
      "estimativa"
    ),
    15
  );

  // 7) Foi direto pro judicial (sem nunca passar por administrativo), venceu
  check(
    "7) direto pro judicial, procedente",
    resolveComissaoPctParaColaborador("C", CONFIG_A, {
      estagio_producao: "judicial",
      resultado_administrativo: null,
      resultado_judicial: "procedente",
      responsavel_id: "C",
      responsavel_administrativo_id: null,
      responsavel_judicial_id: "C",
    }),
    15
  );

  // 8) Comissão não configurada pro colaborador (config null) → null, não 0
  //    (null = "não configurado", diferente de "não tem direito")
  check(
    "8) sem config → null",
    resolveComissaoPctParaColaborador("A", null, {
      estagio_producao: "administrativo",
      resultado_administrativo: "concedido",
      resultado_judicial: null,
      responsavel_id: "A",
      responsavel_administrativo_id: "A",
      responsavel_judicial_id: null,
    }),
    null
  );

  console.log(
    falhas === 0
      ? `\n✓ Todos os ${8} cenários passaram.`
      : `\n✗ ${falhas} cenário(s) falharam.`
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main();
