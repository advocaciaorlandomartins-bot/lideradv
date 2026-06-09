import { chromium } from "playwright";

const TOKEN =
  "eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImxvZ2luIjoiYWRtaW4iLCJjYXRlZ29yaWEiOiJhZG1pbiIsInBlcm1pc3NvZXMiOnsiY2xpZW50ZXMiOlsidmVyIiwiZWRpdGFyIiwiY3JpYXIiLCJleGNsdWlyIl0sInByb2Nlc3NvcyI6WyJ2ZXIiLCJlZGl0YXIiLCJjcmlhciIsImV4Y2x1aXIiXSwiZmluYW5jZWlybyI6WyJ2ZXIiLCJlZGl0YXIiLCJjcmlhciIsImV4Y2x1aXIiXSwicHVibGljYWNvZXMiOlsidmVyIiwiZWRpdGFyIiwiY3JpYXIiLCJleGNsdWlyIl0sImNvbGFib3JhZG9yZXMiOlsidmVyIiwiZWRpdGFyIiwiY3JpYXIiLCJleGNsdWlyIl0sInJlbGF0b3Jpb3MiOlsidmVyIl0sImNvbmZpZ3VyYWNvZXMiOlsidmVyIiwiZWRpdGFyIl19LCJleHAiOjE3ODA5MDMwNTl9.a56fead15b7d40363ea5c60f05ec539e34dd2deea2289c9c6465329d19bc836d";
const SS = "C:/Users/Orlando/Documents/Teste/screenshots";

const browser = await chromium.launch({ headless: false, slowMo: 100 });

async function mkPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: "pt-BR" });
  await ctx.addCookies([{ name: "adv_session", value: TOKEN, domain: "localhost", path: "/" }]);
  return ctx.newPage();
}

// ── FINANCEIRO ────────────────────────────────────────────────────────────────
console.log("\n══ FINANCEIRO ══");
{
  const page = await mkPage();
  await page.goto("http://localhost:3000/dashboard/financeiro", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/fin-inicio.png` });

  // Verificar quais KPI cards são botões vs divs
  const kpiButtons = await page.$$eval(
    ".grid button, .grid [onclick]",
    (els) => els.map((e) => ({ tag: e.tagName, text: e.textContent?.trim().slice(0, 30) }))
  );
  console.log("KPI como <button>:", kpiButtons.length);

  // Verificar se os KPI cards são clicáveis
  const kpiCards = await page.$$(".grid.lg\\:grid-cols-5 > *");
  console.log("Total de KPI cards:", kpiCards.length);
  for (const card of kpiCards) {
    const tag = await card.evaluate((el) => el.tagName);
    const label = await card.evaluate((el) => el.querySelector("p")?.textContent?.trim() ?? "?");
    const hasCursor = await card.evaluate((el) => window.getComputedStyle(el).cursor);
    console.log(`  [${tag}] "${label}" cursor=${hasCursor}`);
  }

  // Tentar clicar no "A Pagar"
  const aPagarBtn = await page.$("button:has-text('A Pagar')");
  if (aPagarBtn) {
    console.log("  ✅ 'A Pagar' é um <button> — clicando...");
    await aPagarBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/fin-apos-clicar-apagar.png` });
    const tabAtiva = await page.$(".bg-primary.text-white");
    const tabTexto = tabAtiva ? await tabAtiva.textContent() : "não encontrado";
    console.log("  Tab ativa após click:", tabTexto?.trim().slice(0, 30));
  } else {
    console.log("  ❌ 'A Pagar' NÃO é um <button>");
    // Ver o que é
    const aPagarDiv = await page.$("*:has-text('A Pagar')");
    const tag = aPagarDiv ? await aPagarDiv.evaluate((el) => el.tagName) : "não encontrado";
    console.log("  Tag do 'A Pagar':", tag);
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/fin-mobile.png`, fullPage: false });

  // Testar click no mobile
  const aPagarMobile = await page.$("button:has-text('A Pagar')");
  if (aPagarMobile) {
    await aPagarMobile.tap();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/fin-mobile-apos-tap.png` });
    console.log("  ✅ Tap em 'A Pagar' no mobile funcionou");
  }
  await page.context().close();
}

// ── REMUNERAÇÕES ───────────────────────────────────────────────────────────────
console.log("\n══ REMUNERAÇÕES ══");
{
  const page = await mkPage();
  await page.goto("http://localhost:3000/dashboard/remuneracoes", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/rem-inicio.png` });

  const kpiCards = await page.$$(".grid.lg\\:grid-cols-5 > *, .grid.sm\\:grid-cols-3 > *");
  console.log("KPI cards encontrados:", kpiCards.length);
  for (const card of kpiCards) {
    const tag = await card.evaluate((el) => el.tagName);
    const label = await card.evaluate((el) => el.querySelector("p")?.textContent?.trim() ?? "?");
    const hasCursor = await card.evaluate((el) => window.getComputedStyle(el).cursor);
    console.log(`  [${tag}] "${label}" cursor=${hasCursor}`);
  }
  await page.context().close();
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────
console.log("\n══ CLIENTES ══");
{
  const page = await mkPage();
  await page.goto("http://localhost:3000/dashboard/clientes", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/cli-inicio.png` });

  // Os botões de filtro rápido (Total, PF, PJ etc.)
  const statCards = await page.$$("button[class*='rounded']");
  console.log("Botões clicáveis na página:", statCards.length);

  // Verificar botão de filtro
  const totalBtn = await page.$("button:has-text('Total')");
  if (totalBtn) {
    const cursor = await totalBtn.evaluate((el) => window.getComputedStyle(el).cursor);
    console.log(`  'Total' é button, cursor=${cursor}`);
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/cli-mobile.png`, fullPage: false });

  // Testar tap em filtro rápido
  const filtroBtn = await page.$("button:has-text('Total')");
  if (filtroBtn) {
    await filtroBtn.tap();
    await page.waitForTimeout(500);
    console.log("  ✅ Tap em 'Total' (clientes) no mobile OK");
  }
  await page.context().close();
}

// ── PROCESSOS ────────────────────────────────────────────────────────────────
console.log("\n══ PROCESSOS ══");
{
  const page = await mkPage();
  await page.goto("http://localhost:3000/dashboard/processos", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SS}/proc-inicio.png` });

  const filtros = await page.$$("button:has-text('Todos'), button:has-text('Ativo'), button:has-text('Arquivado')");
  console.log("Botões de filtro em processos:", filtros.length);
  await page.context().close();
}

console.log("\n══ TESTES CONCLUÍDOS ══");
await browser.close();
