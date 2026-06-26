import { chromium } from "playwright";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Login
  await page.goto("http://localhost:3000");
  await page.fill('input[name="login"]', "lideradv");
  await page.fill('input[name="senha"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 10000 });

  // ── 1. Fonte ──
  const fontHeading = await page.evaluate(() => {
    const el = document.querySelector("h1");
    return el ? getComputedStyle(el).fontFamily : "não encontrado";
  });
  const fontBody = await page.evaluate(() => {
    const el = document.querySelector("p, span");
    return el ? getComputedStyle(el).fontFamily : "não encontrado";
  });
  console.log("1. FONTE");
  console.log(`   Heading: ${fontHeading.slice(0, 60)}`);
  console.log(`   Body:    ${fontBody.slice(0, 60)}`);
  const fonteOk = fontHeading.toLowerCase().includes("jakarta") || fontHeading.toLowerCase().includes("inter");
  console.log(`   ${fonteOk ? "✓" : "⚠"} ${fonteOk ? "Plus Jakarta Sans / Inter detectadas" : "verifique fonte"}`);

  // Screenshot dashboard
  await page.screenshot({ path: path.join(__dirname, "ss-1-dashboard.png"), fullPage: false });
  console.log("   → ss-1-dashboard.png");

  // ── 2. Sidebar glass ──
  console.log("\n2. SIDEBAR GLASS");
  const sidebarBg = await page.evaluate(() => {
    const el = document.querySelector("aside");
    return el ? getComputedStyle(el).background : "não encontrado";
  });
  const hasBlur = await page.evaluate(() => {
    const el = document.querySelector("aside");
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.backdropFilter?.includes("blur") || style.webkitBackdropFilter?.includes("blur");
  });
  console.log(`   Background: ${sidebarBg.slice(0, 80)}`);
  console.log(`   Blur: ${hasBlur ? "✓ backdrop-filter: blur ativo" : "⚠ blur não detectado via JS (normal em alguns browsers)"}`);
  // Screenshot sidebar
  await page.screenshot({ path: path.join(__dirname, "ss-2-sidebar.png"), fullPage: false });
  console.log("   → ss-2-sidebar.png");

  // ── 3. Loading Controles ──
  console.log("\n3. LOADING CONTROLES");
  // Navega e captura o skeleton antes do conteúdo carregar
  await page.goto("http://localhost:3000/dashboard/controles", { waitUntil: "commit" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, "ss-3-controles-loading.png"), fullPage: false });
  console.log("   → ss-3-controles-loading.png (captura imediata — skeleton)");

  // Aguarda carregar completamente
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(__dirname, "ss-4-controles-loaded.png"), fullPage: false });
  const hasTable = await page.isVisible("table, [role=table], .divide-y");
  const hasAnimate = await page.isVisible(".animate-pulse");
  console.log(`   Conteúdo carregado: ${hasTable ? "✓" : "—"}`);
  console.log(`   Skeleton sumiu:     ${!hasAnimate ? "✓" : "⚠ ainda visível"}`);
  console.log("   → ss-4-controles-loaded.png");

  await browser.close();
  console.log("\n✓ Teste concluído.");
})();
