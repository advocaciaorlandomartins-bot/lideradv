import { chromium } from "playwright";
import crypto from "crypto";

const SECRET = "19ffd8d4a3a21dad52beec6bdc981735f25c5ee8d27dcb5f4bad75c97495db28";
const exp = Math.floor(Date.now() / 1000) + 28800;
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  login: "admin",
  categoria: "admin",
  permissoes: {
    clientes: ["ver","editar","criar","excluir"],
    processos: ["ver","editar","criar","excluir"],
    financeiro: ["ver","editar","criar","excluir"],
    publicacoes: ["ver","editar","criar","excluir"],
    colaboradores: ["ver","editar","criar","excluir"],
    remuneracoes: ["ver","editar","criar","excluir"],
    relatorios: ["ver"],
    configuracoes: ["ver","editar"]
  },
  exp
};
const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
const TOKEN = payload + "." + sig;

const SS = "C:/Users/Orlando/Documents/Teste/screenshots";

async function mkCtx(browser, viewport = { width: 1280, height: 900 }, touch = false) {
  const ctx = await browser.newContext({ viewport, locale: "pt-BR", hasTouch: touch });
  await ctx.addCookies([{ name: "adv_session", value: TOKEN, domain: "localhost", path: "/" }]);
  return ctx;
}

const browser = await chromium.launch({ headless: true, slowMo: 100 });

// ══ 1. FINANCEIRO — aba Remunerações (?tab=remuneracoes) ═════════════════════
console.log("\n══ 1. FINANCEIRO / tab=remuneracoes ══");
{
  const ctx = await mkCtx(browser);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/dashboard/financeiro?tab=remuneracoes", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/rem-aba-inicio.png` });

  // Verificar se KPI cards são botões
  const kpiInfo = await page.$$eval(
    "button[class*='rounded-xl'], div[class*='rounded-xl']",
    (els) => els.slice(0, 15).map((e) => ({
      tag: e.tagName,
      label: e.querySelector("p")?.textContent?.trim().slice(0, 25) ?? e.textContent?.trim().slice(0, 25) ?? "?",
      cursor: window.getComputedStyle(e).cursor,
    }))
  );
  console.log("Cards na aba Remuneracoes:");
  for (const k of kpiInfo) {
    const ok = k.tag === "BUTTON" || k.cursor === "pointer";
    console.log(`  ${ok ? "OK" : "FAIL"} [${k.tag}] "${k.label}" cursor=${k.cursor}`);
  }

  // Testar "A Pagar" — click e toggle
  const aPagarEl = page.locator('text="A Pagar"').first();
  const aPagarCount = await aPagarEl.count();
  if (aPagarCount > 0) {
    const tag = await aPagarEl.evaluate((el) => el.closest("button") ? "BUTTON" : el.tagName);
    console.log(`\n  'A Pagar' encapsulado em: ${tag}`);

    if (tag === "BUTTON") {
      await aPagarEl.click();
      await page.waitForTimeout(600);
      const ringAtivo = await page.$("[class*='ring-2']");
      console.log("  " + (ringAtivo ? "OK" : "FAIL") + " Ring de filtro ativo apareceu");
      await page.screenshot({ path: `${SS}/rem-kpi-apagar-ativo.png` });

      // Toggle off
      await aPagarEl.click();
      await page.waitForTimeout(600);
      const ringDepois = await page.$("[class*='ring-2']");
      console.log("  " + (!ringDepois ? "OK" : "FAIL") + " Toggle: ring sumiu ao re-clicar");
    }
  } else {
    console.log("  WARN 'A Pagar' nao encontrado na pagina");
  }

  // Testar "Salarios"
  const salariosEl = page.locator('text="Salarios"').or(page.locator('text="Salários"')).first();
  if (await salariosEl.count() > 0) {
    const tag = await salariosEl.evaluate((el) => el.closest("button") ? "BUTTON" : el.tagName);
    console.log(`\n  'Salarios' encapsulado em: ${tag}`);
    if (tag === "BUTTON") {
      await salariosEl.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SS}/rem-kpi-salarios-ativo.png` });
      console.log("  OK 'Salarios' clicado");
    }
  }

  await ctx.close();
}

// ══ 2. FINANCEIRO — aba Contas (?tab=contas) ══════════════════════════════════
console.log("\n══ 2. FINANCEIRO / tab=contas ══");
{
  const ctx = await mkCtx(browser);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/dashboard/financeiro?tab=contas", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/contas-inicio.png` });

  const cobrarEl = page.locator('text="Total a Cobrar"').first();
  const pagarEl  = page.locator('text="Total a Pagar"').first();

  const cobrarTag = await cobrarEl.evaluate((el) => el.closest("button") ? "BUTTON" : el.tagName);
  const pagarTag  = await pagarEl.evaluate((el) => el.closest("button") ? "BUTTON" : el.tagName);
  console.log(`  'Total a Cobrar' -> ${cobrarTag === "BUTTON" ? "OK BUTTON" : "FAIL " + cobrarTag}`);
  console.log(`  'Total a Pagar'  -> ${pagarTag  === "BUTTON" ? "OK BUTTON" : "FAIL " + pagarTag}`);

  if (pagarTag === "BUTTON") {
    await pagarEl.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/contas-apagar-ativo.png` });
    const ring = await page.$("[class*='ring-2']");
    console.log("  " + (ring ? "OK" : "FAIL") + " Ring ativo em 'Total a Pagar'");
  }

  if (cobrarTag === "BUTTON") {
    await cobrarEl.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/contas-cobrar-ativo.png` });
    const ring = await page.$("[class*='ring-2']");
    console.log("  " + (ring ? "OK" : "FAIL") + " Ring ativo em 'Total a Cobrar'");
  }

  await ctx.close();
}

// ══ 3. MOBILE 390px — Remuneracoes ══════════════════════════════════════════
console.log("\n══ 3. MOBILE (390px) — tab=remuneracoes ══");
{
  const ctx = await mkCtx(browser, { width: 390, height: 844 }, true);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/dashboard/financeiro?tab=remuneracoes", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/rem-mobile-inicio.png`, fullPage: false });

  const salariosEl = page.locator('text="Salários"').first();
  if (await salariosEl.count() > 0) {
    const tag = await salariosEl.evaluate((el) => el.closest("button") ? "BUTTON" : el.tagName);
    if (tag === "BUTTON") {
      await salariosEl.tap();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SS}/rem-mobile-salarios-ativo.png`, fullPage: false });
      const ring = await page.$("[class*='ring-2']");
      console.log("  " + (ring ? "OK" : "FAIL") + " Tap em 'Salarios' no mobile OK, ring=" + !!ring);
    } else {
      console.log(`  FAIL 'Salarios' e ${tag} no mobile`);
    }
  } else {
    console.log("  WARN 'Salarios' nao visivel no mobile");
    await page.screenshot({ path: `${SS}/rem-mobile-salarios-ativo.png`, fullPage: true });
  }

  await ctx.close();
}

console.log("\n== TESTES CONCLUIDOS ==");
await browser.close();
