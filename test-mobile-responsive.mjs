import { chromium, devices } from "playwright";

const SESSION =
  "eyJpZCI6IjEiLCJsb2dpbiI6InRlc3QiLCJjYXRlZ29yaWEiOiJBZG1pbmlzdHJhZG9yKGEpIiwicGVybWlzc29lcyI6e30sImV4cCI6MTc4MDg4MDA0NH0.e6d3f7c6cb3ec3396e642ca89bbe8515816a4844640c8087d208728c12600e24";
const BASE = "http://localhost:3000";

async function injectSession(ctx) {
  await ctx.addCookies([
    {
      name: "adv_session",
      value: SESSION,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function shot(page, name) {
  await page.screenshot({ path: `mob-${name}.png`, fullPage: false });
  console.log(`  📸 mob-${name}.png`);
}

async function runDevice(browser, deviceName, deviceConfig) {
  console.log(`\n=== ${deviceName} ===`);
  const ctx = await browser.newContext({ ...deviceConfig });
  await injectSession(ctx);
  const page = await ctx.newPage();
  const prefix = deviceName.toLowerCase().replace(/\s+/g, "-");

  // 1. Dashboard — verifica hamburger visível, sem nav rows
  console.log("  1. Dashboard");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-1-dashboard`);

  // 2. Abre sidebar via hamburger
  console.log("  2. Hamburger → sidebar");
  const hamburger = page.locator('button[aria-label="Abrir menu"]');
  await hamburger.click();
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-2-sidebar`);

  // Fecha sidebar clicando no botão X
  await page.locator('button[aria-label="Fechar menu"]').click();
  await page.waitForTimeout(300);

  // 3. Financeiro — abas com scroll
  console.log("  3. Financeiro tabs");
  await page.goto(`${BASE}/dashboard/financeiro`, {
    waitUntil: "networkidle",
  });
  await shot(page, `${prefix}-3-financeiro`);

  // Verifica que tab "Contas" está acessível via scroll
  const contasTab = page.locator('a[href="/dashboard/financeiro?tab=contas"]');
  await contasTab.scrollIntoViewIfNeeded();
  await shot(page, `${prefix}-3b-contas-tab`);

  // 4. Processos — sub-nav com scroll
  console.log("  4. Processos sub-nav");
  await page.goto(`${BASE}/dashboard/processos`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-4-processos`);

  // Verifica tab Andamentos acessível
  const andamentosTab = page.locator(
    'a[href="/dashboard/processos/andamentos"]'
  );
  await andamentosTab.scrollIntoViewIfNeeded();
  await shot(page, `${prefix}-4b-andamentos-tab`);

  // 5. Publicações — tabs da página
  console.log("  5. Publicações");
  await page.goto(`${BASE}/dashboard/publicacoes`, {
    waitUntil: "networkidle",
  });
  await shot(page, `${prefix}-5-publicacoes`);

  // 6. Gerenciador — nav tabs
  console.log("  6. Gerenciador");
  await page.goto(`${BASE}/dashboard/gerenciador`, {
    waitUntil: "networkidle",
  });
  await shot(page, `${prefix}-6-gerenciador`);

  // 7. Clientes
  console.log("  7. Clientes");
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-7-clientes`);

  // 8. Controles
  console.log("  8. Controles");
  await page.goto(`${BASE}/dashboard/controles`, { waitUntil: "networkidle" });
  await shot(page, `${prefix}-8-controles`);

  await ctx.close();
}

const browser = await chromium.launch({ headless: true });

// iPhone 14 Pro
await runDevice(browser, "iPhone 14 Pro", {
  ...devices["iPhone 14 Pro"],
});

// Android — Pixel 7
await runDevice(browser, "Pixel 7", {
  ...devices["Pixel 7"],
});

await browser.close();
console.log("\n✅ Todos os screenshots capturados.");
