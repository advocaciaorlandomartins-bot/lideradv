import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "advocaciaorlandomartins@gmail.com";
const PASS = "Orlando@123";
const SHOT = (n) => `/tmp/shot-${n}.png`;

const fmt = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const log = (...a) => console.log("[TEST]", ...a);
const pass = (msg) => console.log("  ✅ PASS:", msg);
const fail = (msg) => console.log("  ❌ FAIL:", msg);
const warn = (msg) => console.log("  ⚠️  WARN:", msg);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ── LOGIN ──────────────────────────────────────────────────────
  log("Fazendo login...");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', EMAIL);
  await page.fill('input[name="senha"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => window.location.pathname.includes("/dashboard"),
    { timeout: 15000 }
  );
  log("Login OK →", page.url());

  // ── NAVEGAR PARA NOVA RECEITA ──────────────────────────────────
  await page.goto(`${BASE}/dashboard/financeiro/novo`, { waitUntil: "networkidle" });
  log("Página:", page.url());
  await page.screenshot({ path: SHOT("01-form-initial"), fullPage: true });

  // ── VERIFICAR CAMPOS INICIAIS ──────────────────────────────────
  // 1. Selecionar modo RETROATIVO
  log("Selecionando modo Retroativo...");
  const retroBtn = page.locator("button").filter({ hasText: /retroativo/i }).first();
  await retroBtn.waitFor({ timeout: 5000 });
  await retroBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT("02-modo-retroativo"), fullPage: true });

  // 2. Campo "Valor retroativo" NÃO deve ser obrigatório
  const allInputs = page.locator("input");
  let valorRetroInput = null;
  const inputCount = await allInputs.count();
  for (let i = 0; i < inputCount; i++) {
    const inp = allInputs.nth(i);
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    if (placeholder && placeholder.includes("0,00")) {
      // Check if it's the valor retroativo by checking surrounding text
      const parent = inp.locator("../../..");
      const parentText = await parent.textContent().catch(() => "");
      if (parentText.toLowerCase().includes("retroativo")) {
        valorRetroInput = inp;
        break;
      }
    }
  }

  if (valorRetroInput && await valorRetroInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    const req = await valorRetroInput.getAttribute("required");
    if (req === null) {
      pass("'Valor retroativo' NÃO é obrigatório (required removido)");
    } else {
      fail("'Valor retroativo' ainda está marcado como required");
    }
  } else {
    warn("Input 'Valor retroativo' não encontrado pelo placeholder");
  }

  // 3. Preencher valor retroativo = R$10.000
  // Find by visible label text
  const retroLabel = page.locator("label, span, p").filter({ hasText: /valor retroativo/i }).first();
  if (await retroLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const retroSection = retroLabel.locator("../..").locator("input").first();
    if (await retroSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      await retroSection.fill("10000");
      await retroSection.blur();
      log("Valor retroativo preenchido: 10000");
    }
  }

  // ── SELECIONAR TIPO ENTRADA ────────────────────────────────────
  const tipoEntradaBtn = page.locator("button").filter({ hasText: /^entrada$/i }).first();
  if (await tipoEntradaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tipoEntradaBtn.click();
    log("Tipo 'Entrada' selecionado");
    await page.waitForTimeout(300);
  }

  // ── SELECIONAR SALÁRIO MÍNIMO ──────────────────────────────────
  log("Selecionando salário base...");
  // Look for the "SM vigente" or similar button
  const smBtn = page.locator("button").filter({ hasText: /SM vigente|salário mínimo|\bSM\b/i }).first();
  if (await smBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const smText = await smBtn.textContent();
    await smBtn.click();
    log("Selecionado:", smText?.trim());
    await page.waitForTimeout(500);
  } else {
    // Try to find the salary section buttons
    const salarySectionButtons = page.locator("button").filter({ hasText: /mínimo|SM|salário/i });
    const btnCount = await salarySectionButtons.count();
    log(`Botões de salário: ${btnCount}`);
    if (btnCount > 0) {
      for (let i = 0; i < btnCount; i++) {
        const txt = await salarySectionButtons.nth(i).textContent();
        log(`  btn ${i}: "${txt?.trim()}"`);
      }
      await salarySectionButtons.first().click();
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({ path: SHOT("03-salario-selecionado"), fullPage: true });

  // ── VERIFICAR LABEL "QUANTIDADE DE MESES" ─────────────────────
  const qtyMesesEl = page.locator("label, span, p").filter({ hasText: /quantidade de meses/i }).first();
  if (await qtyMesesEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    pass("Label 'Quantidade de meses' visível no modo retroativo");
  } else {
    fail("Label 'Quantidade de meses' não encontrado");
  }

  // ── PREENCHER QUANTIDADE DE MESES = 12 ────────────────────────
  // Find the input next to the "Quantidade de meses" label
  if (await qtyMesesEl.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Navigate to parent and find input
    const mesesContainer = qtyMesesEl.locator("..").locator("..");
    const mesesInput = mesesContainer.locator("input").first();
    if (await mesesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mesesInput.fill("12");
      await mesesInput.blur();
      log("Quantidade de meses: 12");
    } else {
      warn("Input de meses não encontrado");
    }
  }
  await page.waitForTimeout(500);

  // ── VERIFICAR BOX ÂMBAR ────────────────────────────────────────
  const amberBox = page.locator(".bg-amber-50").first();
  if (await amberBox.isVisible({ timeout: 3000 }).catch(() => false)) {
    const txt = await amberBox.textContent();
    pass("Box âmbar visível: " + txt?.replace(/\s+/g, " ").trim().substring(0, 100));
  } else {
    warn("Box âmbar não visível (verifique se meses está preenchido)");
  }

  // ── VERIFICAR BOX VIOLETA ──────────────────────────────────────
  const violetBox = page.locator(".bg-violet-50").first();
  if (await violetBox.isVisible({ timeout: 2000 }).catch(() => false)) {
    const txt = await violetBox.textContent();
    pass("Box violeta visível: " + txt?.replace(/\s+/g, " ").trim().substring(0, 100));
  } else {
    warn("Box violeta não visível (valor retroativo pode não ter sido preenchido)");
  }

  // ── VERIFICAR "NÚMERO DE PARCELAS" COMEÇA COM 1 ──────────────
  const parcelasLabel = page.locator("label, span").filter({ hasText: /número de parcelas/i }).first();
  let parcelasInput = null;
  if (await parcelasLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const cont = parcelasLabel.locator("..").locator("..");
    parcelasInput = cont.locator('input[type="number"]').first();
    if (!await parcelasInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      parcelasInput = cont.locator("input").first();
    }
    if (await parcelasInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const val = await parcelasInput.inputValue();
      if (val === "1") {
        pass(`Número de parcelas começa com 1 ✓`);
      } else {
        fail(`Número de parcelas = "${val}" (esperado "1")`);
      }
      await parcelasInput.fill("3");
      log("Número de parcelas: 3");
    } else {
      warn("Input 'Número de parcelas' não encontrado");
    }
  } else {
    warn("Label 'Número de parcelas' não encontrado");
  }

  // ── PREENCHER VALOR DE ENTRADA ─────────────────────────────────
  const entradaLabel = page.locator("label, span").filter({ hasText: /valor de entrada/i }).first();
  if (await entradaLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    const entContainer = entradaLabel.locator("..").locator("..");
    const entInput = entContainer.locator('input[inputmode="decimal"]').first();
    if (await entInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await entInput.fill("500");
      await entInput.blur();
      log("Valor de entrada: 500");
    } else {
      warn("Input 'Valor de entrada' não encontrado");
    }
  }

  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT("04-resumo"), fullPage: true });

  // ── VERIFICAR RESUMO DE RECEBIMENTO ───────────────────────────
  const resumoTitle = page.locator("text=Resumo de recebimento").first();
  if (await resumoTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    pass("'Resumo de recebimento' visível");
    // Check total value
    const resumoBox = resumoTitle.locator("../../..");
    const resumoText = await resumoBox.textContent();
    const cleanText = resumoText?.replace(/\s+/g, " ").trim();
    log("Resumo conteúdo:", cleanText?.substring(0, 200));

    // Check for "Total" and the expected amount
    // With 10000 retroativo, 30% = 3000 percValor, 12×SM(1412)=16944 salarioPart
    // Total = 3000 + 16944 = 19944
    // With entrada 500: totalUI = 3000 + 500 + 3×(16444/3) = 19944
    if (cleanText && cleanText.includes("Total")) {
      pass("Campo 'Total' presente no resumo");
    } else {
      fail("Campo 'Total' ausente no resumo");
    }
  } else {
    warn("'Resumo de recebimento' não visível (verificar se previewParcelas é válido)");
  }

  // ── VERIFICAR HIDDEN INPUTS ────────────────────────────────────
  const hiddenInputs = await page.evaluate(() => {
    const result = {};
    document.querySelectorAll('input[type="hidden"]').forEach(i => {
      if (i.name && !i.name.startsWith("$")) {
        result[i.name] = i.value;
      }
    });
    return result;
  });
  log("Hidden inputs para submit:", JSON.stringify(hiddenInputs, null, 2));

  // Check valor e valor_entrada
  if (hiddenInputs.valor) {
    log(`valor (para backend): ${hiddenInputs.valor}`);
    log(`valor_entrada (para backend): ${hiddenInputs.valor_entrada}`);
    log(`payment_mode: ${hiddenInputs.payment_mode}`);
    log(`parcelado: ${hiddenInputs.parcelado}`);

    // Expected: valor = 3000 + 16944 = 19944, valor_entrada = 3000 + 500 = 3500
    const v = parseFloat(hiddenInputs.valor);
    const e = parseFloat(hiddenInputs.valor_entrada);
    if (v > 10000) {
      pass(`valor inclui salarioPart: ${v} (retroativo apenas seria 3000)`);
    } else {
      fail(`valor parece não incluir salarioPart: ${v}`);
    }
    if (e > 0) {
      log(`valor_entrada: ${e} (= percValor + extraEntrada)`);
    }
  }

  await browser.close();
  log("=== TESTE CONCLUÍDO ===");
}

main().catch(e => {
  console.error("[ERROR]", e.message);
  console.error(e.stack);
  process.exit(1);
});
