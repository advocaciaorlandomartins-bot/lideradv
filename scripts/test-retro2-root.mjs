import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "advocaciaorlandomartins@gmail.com";
const PASS = "Orlando@123";
const SHOT = (n) => `C:\\Users\\Orlando\\Documents\\Teste\\shot-${n}.png`;

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const log = (...a) => console.log("[T]", ...a);

  // Login
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForFunction(() => !location.pathname.includes("login") && location.pathname !== "/", { timeout: 15000 });
  log("Login OK");

  // ──────────────────────────────────────────
  // 1. Ir para Nova Receita
  // ──────────────────────────────────────────
  await p.goto(`${BASE}/dashboard/financeiro`);
  await p.waitForLoadState("networkidle");
  await p.screenshot({ path: SHOT("01-financeiro"), fullPage: false });

  // Clicar em "Nova Receita"
  const novaBtn = p.getByRole("button", { name: /nova receita/i }).first();
  const novaLink = p.getByRole("link", { name: /nova receita/i }).first();
  if (await novaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await novaBtn.click();
  } else if (await novaLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await novaLink.click();
  } else {
    // Try any element with the text
    await p.locator("text=Nova Receita").first().click();
  }
  await p.waitForLoadState("networkidle");
  await p.screenshot({ path: SHOT("02-nova-receita"), fullPage: true });
  log("Página Nova Receita:", p.url());

  // ──────────────────────────────────────────
  // 2. Selecionar cliente
  // ──────────────────────────────────────────
  // Find client combobox
  const clientCombo = p.locator('input[placeholder*="liente"], button').filter({ hasText: /selecione|cliente/i }).first();
  if (await clientCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
    await clientCombo.click();
    await p.waitForTimeout(400);
    // Pick first option
    const firstOption = p.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      const clientName = await firstOption.textContent();
      await firstOption.click();
      log("Cliente selecionado:", clientName?.trim());
    }
  }
  await p.waitForTimeout(300);

  // ──────────────────────────────────────────
  // 3. Selecionar modo Retroativo
  // ──────────────────────────────────────────
  // Look for payment mode buttons
  const retroBtn = p.locator('button').filter({ hasText: /retroativo/i }).first();
  if (await retroBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await retroBtn.click();
    log("Modo Retroativo selecionado");
    await p.waitForTimeout(400);
  } else {
    log("WARN: Botão retroativo não encontrado, tentando por texto");
    await p.locator("text=Retroativo").first().click();
  }
  await p.screenshot({ path: SHOT("03-modo-retroativo"), fullPage: true });

  // ──────────────────────────────────────────
  // 4. Verificar que Valor retroativo NÃO é required
  // ──────────────────────────────────────────
  const inputs = p.locator("input");
  const count = await inputs.count();
  let valorRetroInput = null;
  for (let i = 0; i < count; i++) {
    const inp = inputs.nth(i);
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    if (placeholder && placeholder.toLowerCase().includes("retroativo")) {
      valorRetroInput = inp;
      break;
    }
  }
  // Also try finding by nearby label text
  const retrolabel = p.locator("label, span").filter({ hasText: /retroativo a receber/i }).first();
  if (!valorRetroInput && await retrolabel.isVisible({ timeout: 1000 }).catch(() => false)) {
    const parent = retrolabel.locator("..");
    valorRetroInput = parent.locator("input").first();
  }

  if (valorRetroInput && await valorRetroInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    const req = await valorRetroInput.getAttribute("required");
    if (req === null) {
      log("✅ PASS: 'Valor retroativo' NÃO é required");
    } else {
      log("❌ FAIL: 'Valor retroativo' ainda é required");
    }
    // Preencher R$10.000
    await valorRetroInput.fill("10000");
    log("Valor retroativo: 10000");
  } else {
    log("WARN: Input retroativo não encontrado pelo placeholder");
  }

  // ──────────────────────────────────────────
  // 5. Preencher percentual do adv (30%)
  // ──────────────────────────────────────────
  const percAdvLabel = p.locator("label, span").filter({ hasText: /percentual.*honorário|percentual.*adv/i }).first();
  if (await percAdvLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const percInput = percAdvLabel.locator("..").locator("input");
    if (await percInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const val = await percInput.inputValue();
      log("Percentual adv atual:", val, "(esperado 30)");
    }
  }

  // ──────────────────────────────────────────
  // 6. Tipo = Entrada
  // ──────────────────────────────────────────
  const tipoEntradaBtn = p.locator('button').filter({ hasText: /^entrada$/i }).first();
  if (await tipoEntradaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tipoEntradaBtn.click();
    log("Tipo 'Entrada' selecionado");
    await p.waitForTimeout(300);
  }

  // ──────────────────────────────────────────
  // 7. Selecionar SM vigente como salário base
  // ──────────────────────────────────────────
  const smBtn = p.locator("button").filter({ hasText: /SM vigente|salário mínimo/i }).first();
  if (await smBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await smBtn.click();
    log("Salário: SM vigente selecionado");
    await p.waitForTimeout(500);
  } else {
    // Alternativa
    const smBtn2 = p.locator("button").filter({ hasText: /SM/i }).first();
    if (await smBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await smBtn2.click();
      log("Salário: SM selecionado (alternativa)");
      await p.waitForTimeout(500);
    }
  }

  await p.screenshot({ path: SHOT("04-salario-selecionado"), fullPage: true });

  // ──────────────────────────────────────────
  // 8. Verificar label "Quantidade de meses"
  // ──────────────────────────────────────────
  const qtyMesesLabel = p.locator("label, span, p").filter({ hasText: /quantidade de meses/i }).first();
  if (await qtyMesesLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    log("✅ PASS: 'Quantidade de meses' visível");
  } else {
    log("❌ FAIL: 'Quantidade de meses' não encontrado");
  }

  // ──────────────────────────────────────────
  // 9. Preencher quantidade de meses = 12
  // ──────────────────────────────────────────
  if (await qtyMesesLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Find input relative to this label
    const mesesSection = qtyMesesLabel.locator("../../..");
    const mesesInput = mesesSection.locator("input").first();
    if (await mesesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mesesInput.fill("12");
      log("Quantidade de meses: 12");
    } else {
      // Try parent approach
      const allInputs = p.locator("input[type='text'][inputmode='numeric'], input[type='number']");
      const cnt = await allInputs.count();
      log("Inputs numéricos encontrados:", cnt);
    }
  }

  await p.waitForTimeout(400);
  await p.screenshot({ path: SHOT("05-pos-meses"), fullPage: true });

  // ──────────────────────────────────────────
  // 10. Verificar box âmbar (honorário mensal)
  // ──────────────────────────────────────────
  const amberBox = p.locator(".bg-amber-50, .border-amber-200").first();
  if (await amberBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    const txt = await amberBox.textContent();
    log("✅ PASS: Box âmbar visível:", txt?.replace(/\s+/g, " ").trim().substring(0, 100));
  } else {
    log("WARN: Box âmbar não visível (pode precisar preencher meses)");
  }

  // ──────────────────────────────────────────
  // 11. Verificar "Número de parcelas" começa com 1
  // ──────────────────────────────────────────
  const parcelasLabel = p.locator("label, span").filter({ hasText: /número de parcelas/i }).first();
  let parcelasInput = null;
  if (await parcelasLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    parcelasInput = parcelasLabel.locator("..").locator("input").first();
    if (!await parcelasInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      parcelasInput = parcelasLabel.locator("../..").locator("input").first();
    }
    if (await parcelasInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const pVal = await parcelasInput.inputValue();
      if (pVal === "1") {
        log("✅ PASS: Número de parcelas começa com 1");
      } else {
        log("❌ FAIL: Número de parcelas =", pVal, "(esperado 1)");
      }
      await parcelasInput.fill("3");
      log("Número de parcelas: 3");
    }
  } else {
    log("WARN: Label 'Número de parcelas' não encontrado");
  }

  // ──────────────────────────────────────────
  // 12. Preencher valor de entrada
  // ──────────────────────────────────────────
  const entradaLabel = p.locator("label, span").filter({ hasText: /valor de entrada/i }).first();
  if (await entradaLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const entInput = entradaLabel.locator("..").locator("input").first();
    if (await entInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await entInput.fill("500");
      await entInput.press("Tab");
      log("Valor de entrada: 500");
    }
  }

  await p.waitForTimeout(500);
  await p.screenshot({ path: SHOT("06-pos-entrada-parcelas"), fullPage: true });

  // ──────────────────────────────────────────
  // 13. Verificar Resumo de Recebimento
  // ──────────────────────────────────────────
  const resumoLabel = p.locator("text=Resumo de recebimento").first();
  if (await resumoLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    log("✅ PASS: 'Resumo de recebimento' visível");
    const resumoBox = resumoLabel.locator("../../..");
    const resumoText = await resumoBox.textContent();
    log("Resumo texto:", resumoText?.replace(/\s+/g, " ").trim());
  } else {
    log("WARN: Resumo de recebimento não visível");
  }

  // ──────────────────────────────────────────
  // 14. Captura final da UI
  // ──────────────────────────────────────────
  await p.screenshot({ path: SHOT("07-final"), fullPage: true });
  log("Screenshots salvos em C:\\Users\\Orlando\\Documents\\Teste\\shot-*.png");

  // ──────────────────────────────────────────
  // 15. Opcional: Submeter o formulário
  // ──────────────────────────────────────────
  // Preencher campo de processo/descrição se necessário
  const descInput = p.locator('input[placeholder*="scrição"], textarea[placeholder*="scrição"]').first();
  if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await descInput.fill("Teste retroativo Playwright");
  }

  log("Teste UI concluído — verificando lógica de cálculo...");

  // Verificar cálculo via page.evaluate
  const calcResult = await p.evaluate(() => {
    // Ler valores dos hidden inputs
    const hiddenInputs = {};
    document.querySelectorAll('input[type="hidden"]').forEach(inp => {
      hiddenInputs[inp.name] = inp.value;
    });
    return hiddenInputs;
  });
  log("Hidden inputs:", JSON.stringify(calcResult, null, 2));

  await b.close();
  log("=== TESTE CONCLUÍDO ===");
}

main().catch(e => {
  console.error("[ERROR]", e.message);
  process.exit(1);
});
