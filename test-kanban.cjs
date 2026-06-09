const { chromium } = require("playwright");

const BASE = "http://localhost:3000";

const IPHONE = {
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  hasTouch: true,
  isMobile: true,
};

async function login(page) {
  await page.goto(BASE + "/");
  await page.fill('input[name="login"]', "admin");
  await page.fill('input[name="senha"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── MOBILE ──────────────────────────────────────────
  const mCtx = await browser.newContext(IPHONE);
  const mPage = await mCtx.newPage();
  await login(mPage);
  await mPage.goto(BASE + "/dashboard/minhas-tarefas");
  await mPage.waitForLoadState("networkidle");
  await mPage.screenshot({ path: "/tmp/k-m1-inicial.png", fullPage: true });
  console.log("M1: kanban mobile inicial");

  const darBaixaCount = await mPage.locator("button", { hasText: "Dar baixa" }).count();
  const colunas = await mPage.locator("h2").allTextContents();
  console.log("Colunas:", colunas.filter(t => t.trim()));
  console.log("Botões Dar baixa:", darBaixaCount);

  if (darBaixaCount > 0) {
    const btn = mPage.locator("button", { hasText: "Dar baixa" }).first();
    const box = await btn.boundingBox();
    console.log("Botão bounding box:", JSON.stringify(box));
    await btn.scrollIntoViewIfNeeded();
    await mPage.screenshot({ path: "/tmp/k-m2-botao.png", fullPage: false });
    console.log("M2: botão visível");

    await btn.tap();
    await mPage.waitForTimeout(2500);
    await mPage.screenshot({ path: "/tmp/k-m3-pos-baixa.png", fullPage: true });
    console.log("M3: após dar baixa");

    const arquivadosBtn = await mPage.locator("button", { hasText: /Ver.*arquivado/i }).count();
    console.log("Botão arquivados visível:", arquivadosBtn);
    if (arquivadosBtn > 0) {
      await mPage.locator("button", { hasText: /Ver.*arquivado/i }).first().tap();
      await mPage.waitForTimeout(800);
      await mPage.screenshot({ path: "/tmp/k-m4-arquivados.png", fullPage: true });
      console.log("M4: arquivados abertos");
    }
  }

  // ── DESKTOP ──────────────────────────────────────────
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await dCtx.newPage();
  await login(dPage);
  await dPage.goto(BASE + "/dashboard/minhas-tarefas");
  await dPage.waitForLoadState("networkidle");
  await dPage.screenshot({ path: "/tmp/k-d1-inicial.png", fullPage: true });
  console.log("D1: kanban desktop inicial");

  const dDarBaixa = await dPage.locator("button", { hasText: "Dar baixa" }).count();
  if (dDarBaixa > 0) {
    await dPage.locator("button", { hasText: "Dar baixa" }).first().click();
    await dPage.waitForTimeout(2500);
    await dPage.screenshot({ path: "/tmp/k-d2-pos-baixa.png", fullPage: true });
    console.log("D2: desktop após dar baixa");
    const arquivadosBtn = await dPage.locator("button", { hasText: /Ver.*arquivado/i }).count();
    if (arquivadosBtn > 0) {
      await dPage.locator("button", { hasText: /Ver.*arquivado/i }).first().click();
      await dPage.waitForTimeout(800);
      await dPage.screenshot({ path: "/tmp/k-d3-arquivados.png", fullPage: true });
      console.log("D3: desktop arquivados abertos");
    }
  }

  await browser.close();
  console.log("DONE");
})();
