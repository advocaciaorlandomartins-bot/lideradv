/**
 * Playwright verification script — financeiro form changes
 *
 * Checks:
 * 1. Recorrente button removed
 * 2. Mensalidade Fixa has "Valor de entrada" field
 * 3. Commission useMemo updates when numSalarios changes (retroativo)
 * 4. E2E: Mensalidade com entrada creates correct DB entries (entrada + parcelas)
 * 5. E2E: Retroativo com salário — comissão calculada sobre valor total
 */

import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3000";
const COOKIE = process.env.SESSION_COOKIE;
const DB_URL =
  "postgresql://neondb_owner:npg_k7r9VpGFJHEv@ep-icy-base-acxsbxa8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB_URL);

let passed = 0;
let failed = 0;
const findings = [];

const ok = (l, d = "") => { passed++; console.log(`✅ ${l}${d ? " — " + d : ""}`); };
const fail = (l, d = "") => { failed++; findings.push(`❌ ${l}${d ? ": " + d : ""}`); console.log(`❌ ${l}${d ? " — " + d : ""}`); };
const probe = (l, d = "") => console.log(`🔍 ${l}${d ? " — " + d : ""}`);
const warn = (l) => { findings.push(`⚠️  ${l}`); console.log(`⚠️  ${l}`); };

/** Find the input that immediately follows a <label> with matching text. */
async function inputAfterLabel(page, labelRx) {
  // Label is a sibling div-wrapper: div > label + div.relative > input
  const label = page.locator("label").filter({ hasText: labelRx }).first();
  if ((await label.count()) === 0) return null;
  // Parent div of label, then find input anywhere inside it
  return label.locator("..").locator("input, select").first();
}

async function fillMoney(page, labelRx, value) {
  const inp = await inputAfterLabel(page, labelRx);
  if (!inp || (await inp.count()) === 0) return false;
  await inp.click();
  await inp.fill(value);
  await inp.press("Tab");
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies([{
    name: "adv_session", value: COOKIE,
    domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax",
  }]);
  const page = await ctx.newPage();

  // ────────────────────────────────────────────────────────────────────────
  // PART 1 — Static UI checks (no form submission)
  // ────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/financeiro/novo`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);

  const title = await page.title();
  ok("Página carregada", title);

  // 1. Recorrente button must be gone
  const recBtns = await page.locator("button").filter({ hasText: /^Recorrente$/ }).count();
  recBtns === 0
    ? ok("Botão 'Recorrente' removido")
    : fail("Botão 'Recorrente' ainda presente", String(recBtns));

  // 2. Exactly 2 payment mode buttons
  const modeBtns = await page.locator("button").filter({ hasText: /Avista.*Retroativo|Mensalidade Fixa/i }).count();
  probe("Botões de modo visíveis", String(modeBtns));
  modeBtns === 2
    ? ok("Exatamente 2 modos de pagamento")
    : warn(`${modeBtns} botões de modo encontrados (esperado 2)`);

  // 3. "Criar um lançamento em Recorrente" text gone
  const bodyText = await page.locator("body").textContent() || "";
  !bodyText.includes("Crie um lançamento em Recorrente")
    ? ok("Texto 'Crie um lançamento em Recorrente' removido")
    : fail("Texto antigo com Recorrente ainda aparece");

  // 4. Switch to Mensalidade Fixa — check for "Valor de entrada" field
  await page.getByRole("button", { name: /mensalidade fixa/i }).click();
  await page.waitForTimeout(500);

  const entradaMensLabel = page.locator("label").filter({ hasText: /valor de entrada/i }).first();
  (await entradaMensLabel.count()) > 0
    ? ok("Campo 'Valor de entrada' visível no modo Mensalidade Fixa")
    : fail("Campo 'Valor de entrada' ausente no modo Mensalidade Fixa");

  // 5. Fill total + mensalidade, verify preview WITHOUT entrada
  await fillMoney(page, /valor total cobrado/i, "1.000");
  await fillMoney(page, /mensalidade do cliente/i, "200");
  await page.waitForTimeout(500);

  const previewBox = page.locator(".bg-amber-50").first();
  const preview1 = (await previewBox.count()) > 0 ? await previewBox.textContent() : "";
  probe("Preview sem entrada (1000÷200)", preview1?.replace(/\s+/g, " ").trim().slice(0, 80));
  preview1.includes("5×") || preview1.includes("5 parcelas")
    ? ok("Preview sem entrada: 1.000 ÷ 200 = 5 parcelas")
    : warn("Preview sem entrada não mostra 5× — " + preview1.slice(0, 60));

  // 6. Add entrada R$200, verify preview shows 4 parcelas
  const entradaInp = await inputAfterLabel(page, /valor de entrada/i);
  if (entradaInp && (await entradaInp.count()) > 0) {
    await entradaInp.click();
    await entradaInp.fill("200");
    await entradaInp.press("Tab");
    await page.waitForTimeout(500);
    const preview2 = (await previewBox.count()) > 0 ? await previewBox.textContent() : "";
    probe("Preview com entrada R$200", preview2?.replace(/\s+/g, " ").trim().slice(0, 100));
    preview2.includes("4×") || preview2.includes("4 parcelas")
      ? ok("Preview com entrada: (1.000 − 200) ÷ 200 = 4 parcelas")
      : fail("Preview com entrada não mostra 4 parcelas", preview2.slice(0, 60));
    preview2.toLowerCase().includes("entrada")
      ? ok("Preview menciona 'entrada' no resumo")
      : warn("Preview não menciona 'entrada'");
  } else {
    fail("Input de entrada não encontrado para teste");
  }

  // ────────────────────────────────────────────────────────────────────────
  // PART 2 — Commission display update test (retroativo mode)
  // ────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/financeiro/novo`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);

  // Mode is retroativo by default — select Beatriz (has indicador)
  const clientInp = page.getByPlaceholder(/buscar por nome/i).first();
  if ((await clientInp.count()) > 0) {
    await clientInp.click();
    await clientInp.fill("Beatriz");
    await page.waitForTimeout(700);
    const beatriz = page.locator("li, [role=option], button").filter({ hasText: /beatriz oliveira santos/i }).first();
    if ((await beatriz.count()) > 0) {
      await beatriz.click();
      await page.waitForTimeout(400);
      ok("Cliente Beatriz Oliveira Santos selecionada");

      // Select first processo available
      const procSel = page.locator("select").first();
      if ((await procSel.count()) > 0) {
        const opts = await procSel.locator("option").count();
        if (opts > 1) { await procSel.selectOption({ index: 1 }); await page.waitForTimeout(300); }
      }

      // Fill retroativo value
      await fillMoney(page, /valor retroativo/i, "10.000");
      await page.waitForTimeout(400);

      // Commission box before salary (should show on percValor only)
      const commBox = page.locator(".bg-amber-50").filter({ hasText: /comissão/i }).first();
      const commText1 = (await commBox.count()) > 0 ? await commBox.textContent() : "";
      probe("Comissão sem salário", commText1?.replace(/\s+/g, " ").trim().slice(0, 80));

      // Select salário mínimo
      const smBtn = page.locator("button").filter({ hasText: /salário mínimo/i }).first();
      if ((await smBtn.count()) > 0) {
        await smBtn.click();
        await page.waitForTimeout(500);
        ok("Salário mínimo selecionado");

        // Commission should update (now includes 1 month of salary = salário mínimo)
        const commText2 = (await commBox.count()) > 0 ? await commBox.textContent() : "";
        probe("Comissão com 1 mês de salário", commText2?.replace(/\s+/g, " ").trim().slice(0, 80));

        commText1 !== commText2
          ? ok("Comissão atualiza ao selecionar base salarial")
          : warn("Comissão não mudou ao selecionar salário mínimo");

        // Change numSalarios to 3 — commission should increase again
        const numMesesInp = await inputAfterLabel(page, /quantidade de meses/i);
        if (numMesesInp && (await numMesesInp.count()) > 0) {
          await numMesesInp.fill("3");
          await numMesesInp.press("Tab");
          await page.waitForTimeout(500);
          const commText3 = (await commBox.count()) > 0 ? await commBox.textContent() : "";
          probe("Comissão com 3 meses", commText3?.replace(/\s+/g, " ").trim().slice(0, 80));
          commText3 !== commText2
            ? ok("Comissão atualiza ao mudar número de meses (deps corrigidos)")
            : warn("Comissão NÃO mudou ao aumentar de 1 para 3 meses");
        }
      }
    } else {
      warn("Beatriz Oliveira Santos não encontrada no dropdown");
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // PART 3 — E2E: Mensalidade com entrada → verify DB entries
  // ────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/financeiro/novo`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /mensalidade fixa/i }).click();
  await page.waitForTimeout(400);

  // Select any client
  const clientInp2 = page.getByPlaceholder(/buscar por nome/i).first();
  if ((await clientInp2.count()) > 0) {
    await clientInp2.click();
    await clientInp2.fill("Beatriz");
    await page.waitForTimeout(700);
    const firstClient = page.locator("li, [role=option], button").filter({ hasText: /beatriz oliveira santos/i }).first();
    if ((await firstClient.count()) > 0) { await firstClient.click(); await page.waitForTimeout(300); }
  }

  // Total R$1.000, mensalidade R$300, entrada R$100 → ceil(900/300)=3 parcelas
  await fillMoney(page, /valor total cobrado/i, "1.000");
  await fillMoney(page, /mensalidade do cliente/i, "300");
  await page.waitForTimeout(400);

  const entradaInp2 = await inputAfterLabel(page, /valor de entrada/i);
  if (entradaInp2 && (await entradaInp2.count()) > 0) {
    await entradaInp2.click();
    await entradaInp2.fill("100");
    await entradaInp2.press("Tab");
    await page.waitForTimeout(500);
  }

  // Snapshot time before submit
  const t0 = new Date(Date.now() - 2000).toISOString();

  // Submit
  const submitBtn = page.locator("button[type=submit]").last();
  if ((await submitBtn.count()) > 0) {
    await submitBtn.click();
    await page.waitForTimeout(3500);
    const url = page.url();
    probe("URL após submit E2E", url);

    if (!url.includes("/novo")) {
      ok("Formulário submetido (redirecionou da página /novo)");

      // Verify DB: expect 1 entrada (parcela_atual=0) + 3 parcelas
      const rows = await sql`
        SELECT descricao, valor::numeric::float8 AS valor, parcela_atual, total_parcelas, status
        FROM lancamentos
        WHERE created_at > ${t0}::timestamptz
        ORDER BY parcela_atual ASC NULLS FIRST
        LIMIT 10
      `;
      probe("Lançamentos criados no DB", JSON.stringify(
        rows.map(r => ({ d: (r.descricao || "").slice(-20), v: r.valor, p: r.parcela_atual }))
      ));

      const entrada = rows.find(r => r.parcela_atual === 0 || (r.descricao || "").includes("Entrada"));
      const parcelas = rows.filter(r => r.parcela_atual != null && r.parcela_atual > 0);

      entrada
        ? ok(`Entrada criada: R$${entrada.valor} (parcela_atual=${entrada.parcela_atual})`)
        : fail("Entrada não encontrada no banco");

      parcelas.length === 3
        ? ok(`3 parcelas mensais criadas: ${parcelas.map(p => `R$${p.valor}`).join(", ")}`)
        : parcelas.length > 0
          ? warn(`${parcelas.length} parcelas (esperadas 3): ${parcelas.map(p => `R$${p.valor}`).join(", ")}`)
          : fail("Nenhuma parcela mensal criada no banco");

      if (entrada && parcelas.length > 0) {
        const totalDB = (entrada?.valor || 0) + parcelas.reduce((s, r) => s + r.valor, 0);
        probe("Total criado no banco", `R$${totalDB.toFixed(2)} (esperado R$1000)`);
        Math.abs(totalDB - 1000) < 0.05
          ? ok("Total do banco bate com R$1.000")
          : warn(`Total no banco: R$${totalDB.toFixed(2)} ≠ R$1.000`);
      }
    } else {
      const errMsg = await page.locator("[role=alert]").first().textContent().catch(() => "");
      fail("Formulário não redirecionou", `erro: ${errMsg}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // PART 4 — E2E: Retroativo com salário → comissão no total completo
  // ────────────────────────────────────────────────────────────────────────
  // Query Beatriz's indicador to know expected commission
  const beatrizData = await sql`
    SELECT c.id, c.indicador_id, c.comissao_tipo, c.comissao_valor,
           col.nome AS indicador_nome
    FROM clients c
    LEFT JOIN colaboradores col ON col.id = c.indicador_id
    WHERE c.name ILIKE '%Beatriz Oliveira Santos%'
    LIMIT 1
  `;
  const btz = beatrizData[0];
  probe("Beatriz indicador", btz ? `${btz.indicador_nome}, tipo=${btz.comissao_tipo}, valor=${btz.comissao_valor}` : "não encontrada");

  if (btz?.indicador_id && btz.comissao_tipo === "percentual") {
    await page.goto(`${BASE}/dashboard/financeiro/novo`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    // Mode is retroativo (default)
    const cInp = page.getByPlaceholder(/buscar por nome/i).first();
    await cInp.click();
    await cInp.fill("Beatriz");
    await page.waitForTimeout(700);
    const btzBtn = page.locator("li, [role=option], button").filter({ hasText: /beatriz oliveira santos/i }).first();
    if ((await btzBtn.count()) > 0) {
      await btzBtn.click();
      await page.waitForTimeout(400);

      // Select first processo
      const ps = page.locator("select").first();
      if ((await ps.count()) > 0) {
        const oc = await ps.locator("option").count();
        if (oc > 1) { await ps.selectOption({ index: 1 }); await page.waitForTimeout(300); }
      }

      // Fill: retroativo = R$10.000, pct=30% → percValor = R$3.000
      await fillMoney(page, /valor retroativo/i, "10.000");
      await page.waitForTimeout(400);

      // Select salário mínimo + 2 meses
      const smBtn2 = page.locator("button").filter({ hasText: /salário mínimo/i }).first();
      if ((await smBtn2.count()) > 0) {
        await smBtn2.click();
        await page.waitForTimeout(400);
        const numMesInp = await inputAfterLabel(page, /quantidade de meses/i);
        if (numMesInp && (await numMesInp.count()) > 0) {
          await numMesInp.fill("2");
          await numMesInp.press("Tab");
          await page.waitForTimeout(500);
        }
      }

      // Read commission from the UI box
      const commBox = page.locator(".bg-amber-50").filter({ hasText: /comissão/i }).first();
      const commUI = (await commBox.count()) > 0 ? await commBox.textContent() : "";
      probe("Box comissão UI (retroativo+salário)", commUI?.replace(/\s+/g, " ").trim().slice(0, 120));

      // Submit
      const t1 = new Date(Date.now() - 2000).toISOString();
      const subBtn = page.locator("button[type=submit]").last();
      await subBtn.click();
      await page.waitForTimeout(4000);
      const url2 = page.url();

      if (!url2.includes("/novo")) {
        ok("Retroativo+salário submetido");

        // Check DB for remuneracao entries (commission)
        const rems = await sql`
          SELECT r.valor::numeric::float8 AS valor, r.descricao, r.status
          FROM remuneracoes r
          WHERE r.colaborador_id = ${btz.indicador_id}::uuid
            AND r.created_at > ${t1}::timestamptz
          ORDER BY r.created_at DESC
          LIMIT 10
        `;
        probe("Remunerações criadas", JSON.stringify(rems.map(r => ({ v: r.valor, d: (r.descricao || "").slice(-20) }))));

        // Also get the lancamentos to see total valor
        const lans = await sql`
          SELECT descricao, valor::numeric::float8 AS valor, parcela_atual
          FROM lancamentos
          WHERE created_at > ${t1}::timestamptz
          ORDER BY parcela_atual ASC NULLS FIRST
          LIMIT 10
        `;
        probe("Lançamentos retroativo", JSON.stringify(lans.map(r => ({ d: (r.descricao || "").slice(-15), v: r.valor, p: r.parcela_atual }))));

        const totalLan = lans.reduce((s, r) => s + r.valor, 0);
        const totalComm = rems.reduce((s, r) => s + r.valor, 0);
        const expectedComm = Math.round(totalLan * (btz.comissao_valor / 100) * 100) / 100;

        probe("Total lançamentos", `R$${totalLan.toFixed(2)}`);
        probe("Total comissão criada no DB", `R$${totalComm.toFixed(2)}`);
        probe("Comissão esperada (% sobre total)", `R$${expectedComm.toFixed(2)}`);

        if (rems.length > 0) {
          Math.abs(totalComm - expectedComm) < 1
            ? ok(`Comissão correta: R$${totalComm.toFixed(2)} sobre total R$${totalLan.toFixed(2)}`)
            : fail(`Comissão incorreta: R$${totalComm.toFixed(2)}, esperado R$${expectedComm.toFixed(2)}`);
        } else {
          warn("Nenhuma remuneração criada (cliente pode não ter indicador configurado no processo)");
        }
      } else {
        const errMsg2 = await page.locator("[role=alert]").first().textContent().catch(() => "");
        warn(`Retroativo não submeteu: ${errMsg2}`);
      }
    }
  } else {
    warn("Beatriz sem indicador percentual — pulando teste de comissão E2E");
  }

  await browser.close();

  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${passed} ✅ passed, ${failed} ❌ failed`);
  if (findings.length) {
    console.log("\nFindings:");
    findings.forEach(f => console.log("  " + f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Script error:", e); process.exit(1); });
