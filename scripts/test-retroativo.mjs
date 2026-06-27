import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "advocaciaorlandomartins@gmail.com";
const PASS = "Orlando@123";

async function fmt(n) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const log = (...args) => console.log("[TEST]", ...args);
  const fail = (...args) => { console.error("[FAIL]", ...args); };

  // Login
  log("Fazendo login...");
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => {
    const p = window.location.pathname;
    return !p.includes("login") && p !== "/";
  }, { timeout: 15000 });
  log("Login OK, pathname:", page.url());

  // Navigate to financeiro
  await page.goto(`${BASE}/dashboard/financeiro`);
  await page.waitForLoadState("networkidle");
  log("Em:", page.url());

  // Open Nova Receita
  const novaBtn = page.locator('button, a').filter({ hasText: /nova receita/i }).first();
  await novaBtn.waitFor({ timeout: 5000 });
  await novaBtn.click();
  await page.waitForLoadState("networkidle");
  log("Formulário aberto");

  // --- SELECT CLIENT ---
  // Find client input and select first client
  const clientInput = page.locator('input[placeholder*="liente"], input[placeholder*="cliente"]').first();
  if (await clientInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await clientInput.click();
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"], li').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
      log("Cliente selecionado");
    }
  }

  // --- SELECT RETROATIVO MODE ---
  const retroBtn = page.locator('button, label').filter({ hasText: /retroativo/i }).first();
  await retroBtn.waitFor({ timeout: 5000 });
  await retroBtn.click();
  log("Modo retroativo selecionado");
  await page.waitForTimeout(300);

  // --- VERIFICAR CAMPO VALOR RETROATIVO NÃO OBRIGATÓRIO ---
  const valorRetroInput = page.locator('input[name="valor_retroativo"], input[placeholder*="etroativo"]').first();
  const isRequired = await valorRetroInput.getAttribute("required").catch(() => null);
  if (isRequired === null) {
    log("✅ PASS: Campo 'Valor retroativo' NÃO é obrigatório");
  } else {
    fail("❌ Campo 'Valor retroativo' ainda está obrigatório");
  }

  // --- PREENCHENDO VALORES ---
  // Valor retroativo = R$ 10.000,00
  if (await valorRetroInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await valorRetroInput.fill("10000");
    log("Valor retroativo preenchido: 10000");
  }

  // Percentual do honorário = 30%
  const percAdvInput = page.locator('input[name="percentual_adv"], input').filter({ hasText: "" }).nth(1);

  // --- TIPO ENTRADA ---
  const tipoEntradaBtn = page.locator('button, label').filter({ hasText: /entrada/i }).first();
  if (await tipoEntradaBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tipoEntradaBtn.click();
    log("Tipo 'Entrada' selecionado");
    await page.waitForTimeout(300);
  }

  // --- SELECIONAR SALÁRIO MÍNIMO ---
  const salarioMinimoBtn = page.locator('button').filter({ hasText: /SM vigente|salário mínimo|mínimo/i }).first();
  if (await salarioMinimoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await salarioMinimoBtn.click();
    log("Salário mínimo selecionado");
    await page.waitForTimeout(500);
  } else {
    // Try clicking the salary section
    const sectionBtns = page.locator('button').filter({ hasText: /SM|mínimo|salário/i });
    const count = await sectionBtns.count();
    log(`Botões de salário encontrados: ${count}`);
    if (count > 0) {
      await sectionBtns.first().click();
      await page.waitForTimeout(500);
    }
  }

  // Check percentual salary field appears
  const pctSalarioField = page.locator('input[placeholder*="ercentual"], input').filter({ hasText: /percentual/i });
  const pctSalarioInput = page.locator('input').nth(5); // approximate

  // --- PREENCHER PERCENTUAL SALÁRIO ---
  const percSalInput = page.locator('input[type="number"]').filter({ hasText: "" });

  // --- QUANTIDADE DE MESES ---
  const qtyMesesLabel = page.locator('text=Quantidade de meses');
  if (await qtyMesesLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    log("✅ PASS: Label 'Quantidade de meses' visível no modo retroativo");
  } else {
    fail("❌ Label 'Quantidade de meses' não encontrada");
  }

  // Fill numMeses = 12
  const numMesesInput = page.locator('input[name="num_salarios"], input').filter({ hasText: "" }).first();
  // Find by nearby label
  const mesesLabel = page.locator('label').filter({ hasText: /quantidade de meses/i });
  if (await mesesLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const mesesInput = mesesLabel.locator("..").locator("input, + input");
    if (await mesesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mesesInput.fill("12");
      log("Quantidade de meses: 12");
    }
  }

  // Fill numParcelas = 3
  const parcelasLabel = page.locator('label').filter({ hasText: /número de parcelas/i });
  if (await parcelasLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const parcelasInput = parcelasLabel.locator("..").locator("input");
    const parcelasVal = await parcelasInput.inputValue();
    if (parcelasVal === "1") {
      log("✅ PASS: Número de parcelas começa com 1");
    } else {
      log(`Número de parcelas = ${parcelasVal} (esperado 1)`);
    }
    await parcelasInput.fill("3");
    log("Número de parcelas: 3");
  }

  // Take screenshot to see current state
  await page.screenshot({ path: "C:\\Users\\Orlando\\Documents\\Teste\\test-retroativo-state.png", fullPage: true });
  log("Screenshot salvo: test-retroativo-state.png");

  // --- CHECK RESUMO DE RECEBIMENTO ---
  const resumoText = await page.locator('text=Resumo de recebimento').isVisible({ timeout: 2000 }).catch(() => false);
  if (resumoText) {
    log("✅ PASS: 'Resumo de recebimento' visível");
  } else {
    log("INFO: 'Resumo de recebimento' não visível ainda (pode precisar de valores)");
  }

  // --- CHECK AMBER BOX ---
  const amberBox = page.locator('.bg-amber-50, [class*="amber"]').first();
  if (await amberBox.isVisible({ timeout: 2000 }).catch(() => false)) {
    const amberText = await amberBox.textContent();
    log("✅ PASS: Box âmbar visível:", amberText?.substring(0, 80));
  } else {
    log("INFO: Box âmbar não visível ainda");
  }

  // --- PRINT FULL PAGE TEXT FOR DEBUGGING ---
  const bodyText = await page.locator("body").textContent();
  const relevant = bodyText?.substring(0, 3000);
  log("Texto da página (trecho):", relevant);

  await browser.close();
  log("Teste concluído");
}

main().catch(e => { console.error("[ERROR]", e); process.exit(1); });
