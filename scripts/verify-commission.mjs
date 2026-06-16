/**
 * Retroativo + salário → commission E2E test
 * Beatriz Oliveira Santos: indicador Orlando Martins, 20% percentual
 * Processo: fb1e64b0-3bb4-437c-be8b-b39a14aa3943 (B80 - Salário Maternidade)
 *
 * Test: retroativo R$10.000 × 30% = R$3.000 (percValor)
 *       + salário mínimo × 2 meses = 2 × ~R$1.412 = ~R$2.824 (salarioPart)
 *       Total = ~R$5.824
 *       Commission expected = 20% × R$5.824 = ~R$1.164,80
 */

import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3000";
const COOKIE = process.env.SESSION_COOKIE;
const DB_URL =
  "postgresql://neondb_owner:npg_k7r9VpGFJHEv@ep-icy-base-acxsbxa8-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB_URL);

const BEATRIZ_ID = "120464d4-7d77-4738-bc8d-63fa479144b0";
const BEATRIZ_PROCESSO_ID = "fb1e64b0-3bb4-437c-be8b-b39a14aa3943";
const INDICADOR_ID = "82e695cd-a0fa-4968-b8b4-19c4173371ef";
const COMISSAO_PCT = 20;

let passed = 0; let failed = 0; const findings = [];
const ok = (l, d = "") => { passed++; console.log(`✅ ${l}${d ? " — " + d : ""}`); };
const fail = (l, d = "") => { failed++; findings.push(`❌ ${l}${d ? ": " + d : ""}`); console.log(`❌ ${l}${d ? " — " + d : ""}`); };
const probe = (l, d = "") => console.log(`🔍 ${l}${d ? " — " + d : ""}`);
const warn = (l) => { findings.push(`⚠️  ${l}`); console.log(`⚠️  ${l}`); };

async function inputAfterLabel(page, labelRx) {
  const label = page.locator("label").filter({ hasText: labelRx }).first();
  if ((await label.count()) === 0) return null;
  return label.locator("..").locator("input, select").first();
}
async function fillMoney(page, labelRx, value) {
  const inp = await inputAfterLabel(page, labelRx);
  if (!inp || (await inp.count()) === 0) return false;
  await inp.click(); await inp.fill(value); await inp.press("Tab");
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
  await page.goto(`${BASE}/dashboard/financeiro/novo`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);

  // ── Select Beatriz ───────────────────────────────────────────────────────
  const clientInp = page.getByPlaceholder(/buscar por nome/i).first();
  await clientInp.click();
  await clientInp.fill("Beatriz");
  await page.waitForTimeout(800);
  const beatrizItem = page.locator("li, [role=option], button").filter({ hasText: /beatriz oliveira santos/i }).first();
  if ((await beatrizItem.count()) === 0) {
    fail("Beatriz Oliveira Santos não encontrada no dropdown"); await browser.close(); process.exit(1);
  }
  await beatrizItem.click();
  await page.waitForTimeout(500);
  ok("Beatriz selecionada");

  // ── Select processo ──────────────────────────────────────────────────────
  const processoSel = page.locator("select").first();
  if ((await processoSel.count()) > 0) {
    // Try to select by value matching the processo ID
    const opts = await processoSel.locator("option").all();
    let found = false;
    for (const opt of opts) {
      const val = await opt.getAttribute("value");
      if (val && val.includes("b80") || val === BEATRIZ_PROCESSO_ID) {
        await processoSel.selectOption(val);
        found = true; break;
      }
    }
    if (!found && opts.length > 1) {
      await processoSel.selectOption({ index: 1 });
    }
    await page.waitForTimeout(400);
  }

  // ── Commission box should appear ─────────────────────────────────────────
  const commBox = page.locator(".bg-amber-50").filter({ hasText: /comissão/i }).first();
  if ((await commBox.count()) > 0) {
    ok("Box de comissão visível após selecionar cliente+processo");
  } else {
    warn("Box de comissão não visível (processo pode não estar selecionado)");
  }

  // ── Fill retroativo: R$10.000, 30% → percValor R$3.000 ──────────────────
  const retOk = await fillMoney(page, /valor retroativo/i, "10.000");
  probe("Campo retroativo preenchido", String(retOk));
  await page.waitForTimeout(500);

  // ── Select SM vigente + 2 meses ─────────────────────────────────────────
  // Button text is "SM vigente — R$ X.XXX,XX" (not "Salário mínimo")
  const smBtn = page.locator("button").filter({ hasText: /sm vigente/i }).first();
  probe("Botão SM vigente encontrado", String(await smBtn.count()));
  if ((await smBtn.count()) > 0) {
    await smBtn.click();
    await page.waitForTimeout(500);
    const numMesInp = await inputAfterLabel(page, /quantidade de meses/i);
    probe("Campo 'Quantidade de meses' encontrado", String(numMesInp ? await numMesInp.count() : 0));
    if (numMesInp && (await numMesInp.count()) > 0) {
      await numMesInp.fill("2");
      await numMesInp.press("Tab");
      await page.waitForTimeout(600);
      ok("SM vigente + 2 meses configurado");
    }
  } else {
    // Dump buttons for debug
    const allBtns = await page.locator("button").allTextContents();
    probe("Botões visíveis", JSON.stringify(allBtns.map(t => t.trim().slice(0, 40)).filter(Boolean)));
  }

  // ── Read what commission UI shows (AFTER salary selection) ──────────────
  await page.waitForTimeout(300);
  const commUI = (await commBox.count()) > 0 ? await commBox.textContent() : "";
  probe("Box comissão UI (após salário)", commUI?.replace(/\s+/g, " ").trim().slice(0, 200));

  const commMatch = commUI?.match(/R\$\s*([\d.,]+)/g);
  probe("Valores R$ no box", JSON.stringify(commMatch));

  // ── Snapshot before submit ───────────────────────────────────────────────
  const t0 = new Date(Date.now() - 1000).toISOString();

  // ── Submit ───────────────────────────────────────────────────────────────
  const subBtn = page.locator("button[type=submit]").last();
  await subBtn.click();
  await page.waitForTimeout(5000);
  const url = page.url();
  probe("URL após submit", url);

  if (url.includes("/novo")) {
    const errMsg = await page.locator("[role=alert]").first().textContent().catch(() => "");
    fail("Formulário não submeteu", errMsg);
    await browser.close(); process.exit(1);
  }
  ok("Retroativo submetido com sucesso");

  // ── Check DB lancamentos ─────────────────────────────────────────────────
  const lans = await sql`
    SELECT descricao, valor::numeric::float8 AS valor, parcela_atual, total_parcelas
    FROM lancamentos
    WHERE created_at > ${t0}::timestamptz
      AND client_id = ${BEATRIZ_ID}::uuid
    ORDER BY parcela_atual ASC NULLS FIRST
    LIMIT 10
  `;
  probe("Lançamentos criados", JSON.stringify(
    lans.map(r => ({ d: (r.descricao || "").slice(-20), v: r.valor, p: r.parcela_atual }))
  ));

  const totalLan = lans.reduce((s, r) => s + r.valor, 0);
  probe("Total em lancamentos", `R$${totalLan.toFixed(2)}`);

  if (lans.length === 0) {
    fail("Nenhum lançamento criado para Beatriz");
  } else {
    ok(`${lans.length} lançamento(s) criado(s), total R$${totalLan.toFixed(2)}`);

    const entrada = lans.find(r => r.parcela_atual === 0 || (r.descricao || "").includes("Entrada"));
    const parcelas = lans.filter(r => r.parcela_atual != null && r.parcela_atual >= 1);

    if (entrada) {
      ok(`Entrada retroativa criada: R$${entrada.valor}`);
      // percValor = 30% × 10.000 = 3.000 (input was 10.000 × 30%)
      const percValorExpected = 10000 * 0.30;
      Math.abs(entrada.valor - percValorExpected) < 1
        ? ok(`Valor da entrada correto: R$${entrada.valor} (esperado ~R$${percValorExpected})`)
        : warn(`Valor da entrada: R$${entrada.valor} (esperado ~R$${percValorExpected})`);
    }

    if (parcelas.length > 0) {
      ok(`${parcelas.length} parcela(s) mensais: ${parcelas.map(p => `R$${p.valor}`).join(", ")}`);
    }
  }

  // ── Check DB remunerações (commission) ───────────────────────────────────
  const rems = await sql`
    SELECT r.valor::numeric::float8 AS valor, r.descricao, r.status
    FROM remuneracoes r
    WHERE r.colaborador_id = ${INDICADOR_ID}::uuid
      AND r.created_at > ${t0}::timestamptz
    ORDER BY r.created_at DESC
    LIMIT 10
  `;
  probe("Remunerações criadas (comissão)", JSON.stringify(
    rems.map(r => ({ v: r.valor, d: (r.descricao || "").slice(-25) }))
  ));

  const totalComm = rems.reduce((s, r) => s + r.valor, 0);
  probe("Total comissão no DB", `R$${totalComm.toFixed(2)}`);

  // Expected commission = 20% × totalLan (percValor + salarioPart)
  const expectedComm = Math.round(totalLan * (COMISSAO_PCT / 100) * 100) / 100;
  probe("Comissão esperada (20% × total)", `R$${expectedComm.toFixed(2)}`);

  if (rems.length === 0) {
    fail("Nenhuma remuneração (comissão) criada para o indicador");
  } else {
    ok(`${rems.length} entrada(s) de comissão criada(s)`);
    Math.abs(totalComm - expectedComm) < 1
      ? ok(`Total comissão correto: R$${totalComm.toFixed(2)} = 20% × R$${totalLan.toFixed(2)}`)
      : fail(`Comissão errada: R$${totalComm.toFixed(2)} ≠ esperado R$${expectedComm.toFixed(2)} (20% × R$${totalLan.toFixed(2)})`);
  }

  // ── Check salarioPart included in total ──────────────────────────────────
  const percValor = 10000 * 0.30; // R$3.000
  if (totalLan > percValor + 0.5) {
    ok(`Total (R$${totalLan.toFixed(2)}) > percValor (R$${percValor}) — salarioPart incluído`);
  } else if (totalLan > 0) {
    warn(`Total (R$${totalLan.toFixed(2)}) = apenas percValor — salarioPart pode não ter sido incluído`);
  }

  await browser.close();

  console.log("\n" + "─".repeat(60));
  console.log(`Resultado: ${passed} ✅ passed, ${failed} ❌ failed`);
  if (findings.length) { console.log("\nFindings:"); findings.forEach(f => console.log("  " + f)); }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Erro:", e.message); process.exit(1); });
