import { chromium } from "playwright";

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
  await page.screenshot({ path: `desk-${name}.png`, fullPage: false });
  console.log(`  📸 desk-${name}.png`);
}

const browser = await chromium.launch({ headless: true });

// ── 1920×1080 (Full HD) ────────────────────────────────────────────────────
console.log("\n=== Desktop 1920×1080 ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await injectSession(ctx);
  const page = await ctx.newPage();

  console.log("  1. Dashboard");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "fhd-1-dashboard");

  // Verifica nav bar visível e hambúrguer ausente
  const hamburger = page.locator('button[aria-label="Abrir menu"]');
  const hamburgerVisible = await hamburger.isVisible();
  console.log(`     hambúrguer visível: ${hamburgerVisible} (esperado: false)`);

  const nav = page.locator("nav[aria-label='Menu principal']").first();
  const navVisible = await nav.isVisible();
  console.log(`     nav principal visível: ${navVisible} (esperado: true)`);

  console.log("  2. Financeiro");
  await page.goto(`${BASE}/dashboard/financeiro`, { waitUntil: "networkidle" });
  await shot(page, "fhd-2-financeiro");

  console.log("  3. Processos");
  await page.goto(`${BASE}/dashboard/processos`, { waitUntil: "networkidle" });
  await shot(page, "fhd-3-processos");

  console.log("  4. Clientes");
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await shot(page, "fhd-4-clientes");

  console.log("  5. Controles");
  await page.goto(`${BASE}/dashboard/controles`, { waitUntil: "networkidle" });
  await shot(page, "fhd-5-controles");

  console.log("  6. Gerenciador");
  await page.goto(`${BASE}/dashboard/gerenciador`, { waitUntil: "networkidle" });
  await shot(page, "fhd-6-gerenciador");

  console.log("  7. Publicações");
  await page.goto(`${BASE}/dashboard/publicacoes`, { waitUntil: "networkidle" });
  await shot(page, "fhd-7-publicacoes");

  console.log("  8. Gerenciador dropdown");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button", { hasText: "Gerenciador" }).click();
  await page.waitForTimeout(300);
  await shot(page, "fhd-8-gerenciador-dropdown");

  await ctx.close();
}

// ── 1366×768 (Laptop comum) ────────────────────────────────────────────────
console.log("\n=== Laptop 1366×768 ===");
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await injectSession(ctx);
  const page = await ctx.newPage();

  console.log("  1. Dashboard");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "laptop-1-dashboard");

  console.log("  2. Financeiro");
  await page.goto(`${BASE}/dashboard/financeiro`, { waitUntil: "networkidle" });
  await shot(page, "laptop-2-financeiro");

  console.log("  3. Clientes — lista");
  await page.goto(`${BASE}/dashboard/clientes`, { waitUntil: "networkidle" });
  await shot(page, "laptop-3-clientes");

  await ctx.close();
}

await browser.close();
console.log("\n✅ Todos os screenshots desktop capturados.");
