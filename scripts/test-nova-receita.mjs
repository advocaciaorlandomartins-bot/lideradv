import { chromium } from "playwright";
import { createHmac } from "crypto";

const SECRET = "19ffd8d4a3a21dad52beec6bdc981735f25c5ee8d27dcb5f4bad75c97495db28";
const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
const payload = JSON.stringify({ id: "1", login: "test", categoria: "Administrador(a)", permissoes: {}, exp });
const b64 = Buffer.from(payload).toString("base64url");
const sig = createHmac("sha256", SECRET).update(b64).digest("hex");
const SESSION = `${b64}.${sig}`;

const BASE = "http://localhost:3000";
const URL = `${BASE}/dashboard/financeiro/novo?tipo=entrada`;

async function injectSession(ctx) {
  await ctx.addCookies([{ name: "adv_session", value: SESSION, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function shot(page, name) {
  await page.screenshot({ path: `nr-${name}.png`, fullPage: false });
  console.log(`  📸 nr-${name}.png`);
}

function fmt(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await injectSession(ctx);
const page = await ctx.newPage();

// ── 1. Carrega formulário ───────────────────────────────────────────────────
console.log("\n1. Carrega formulário Nova Receita");
await page.goto(URL, { waitUntil: "networkidle" });

// Scroll para seção "Base do valor"
await page.getByText("Base do valor").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot(page, "1-form-base-valor");

const pillValorLivre = page.getByRole("button", { name: /Valor livre/i });
const pillSM = page.getByRole("button", { name: /SM vigente/i });
const pillCliente = page.getByRole("button", { name: /Salário do cliente/i });

console.log(`  Pill "Valor livre": ${await pillValorLivre.isVisible()}`);
console.log(`  Pill "SM vigente":  ${await pillSM.isVisible()}`);
console.log(`  Pill "Salário do cliente": ${await pillCliente.isVisible()}`);

// Lê o SM atual da pill
const smPillText = await pillSM.textContent();
console.log(`  Texto da pill SM: "${smPillText?.trim()}"`);

// Campo "Quantidade de salários" deve estar oculto
const qtdLabel = page.getByText("Quantidade de salários");
console.log(`  "Qtd salários" oculto inicialmente: ${!(await qtdLabel.isVisible())} (esperado: true)`);

// ── 2. SM vigente → campo qtd aparece + cálculo correto ────────────────────
console.log("\n2. Seleciona SM vigente");
await pillSM.click();
await page.waitForTimeout(400);
await shot(page, "2-sm-vigente");

console.log(`  "Qtd salários" visível após SM: ${await qtdLabel.isVisible()} (esperado: true)`);

// Lê o resultado mostrado (= R$ X.XXX,00 em verde)
const resultadoSMText = await page.locator("span.text-emerald-700").first().textContent();
console.log(`  Resultado calculado (SM×1): "${resultadoSMText?.trim()}"`);

// Verifica "Valor total" preenchido automaticamente
const valorTotalField = page.locator('input[name="valor"]');
const valorTotalSM = await valorTotalField.inputValue();
console.log(`  Valor total preenchido: "${valorTotalSM}"`);

// ── 3. Altera quantidade para 2 ─────────────────────────────────────────────
console.log("\n3. Define 2 salários mínimos");
// O input de quantidade não tem placeholder — localiza pelo campo dentro da seção de salários
const qtdInput = page.locator('label:has-text("Quantidade de salários") + div input[type="text"]');
await qtdInput.fill("2");
await qtdInput.dispatchEvent("input");
await page.waitForTimeout(300);
await shot(page, "3-2-salarios-sm");

const resultado2SMText = await page.locator("span.text-emerald-700").first().textContent();
console.log(`  Resultado 2×SM: "${resultado2SMText?.trim()}"`);

// ── 4. Salário do cliente → campo de valor aparece ─────────────────────────
console.log("\n4. Seleciona Salário do cliente");
// Resetar qtd para 1 antes de trocar
await qtdInput.fill("1");
await qtdInput.dispatchEvent("input");
await pillCliente.click();
await page.waitForTimeout(400);
await shot(page, "4-salario-cliente-vazio");

// Campo de salário personalizado: tem classe w-44 (único no form)
const salarioCustomInput = page.locator('input.w-44');
console.log(`  Input salário personalizado visível: ${await salarioCustomInput.isVisible()} (esperado: true)`);

// Resultado sem valor usa SM como fallback
const resultadoSemCustom = await page.locator("span.text-emerald-700").first().textContent();
console.log(`  Resultado sem custom (fallback SM): "${resultadoSemCustom?.trim()}"`);

// ── 5. Digita R$ 2.500,00 ──────────────────────────────────────────────────
console.log("\n5. Digita salário R$ 2.500,00");
await salarioCustomInput.fill("2500");
await salarioCustomInput.dispatchEvent("input");
await page.waitForTimeout(300);
await shot(page, "5-salario-2500");

const resultado2500Text = await page.locator("span.text-emerald-700").first().textContent();
console.log(`  1 × R$ 2.500: "${resultado2500Text?.trim()}" (esperado: ~R$ 2.500,00)`);

// ── 6. 3 × R$ 2.500 = R$ 7.500 ────────────────────────────────────────────
console.log("\n6. Define 3 × R$ 2.500,00");
const qtdInput2 = page.locator('label:has-text("Quantidade de salários") + div input[type="text"]');
await qtdInput2.fill("3");
await qtdInput2.dispatchEvent("input");
await page.waitForTimeout(300);
await shot(page, "6-3-salarios-2500");

const resultado7500Text = await page.locator("span.text-emerald-700").first().textContent();
console.log(`  3 × R$ 2.500: "${resultado7500Text?.trim()}" (esperado: ~R$ 7.500,00)`);

// ── 7. Volta para Valor livre → campo qtd some ─────────────────────────────
console.log("\n7. Volta para Valor livre");
await pillValorLivre.click();
await page.waitForTimeout(300);
await shot(page, "7-valor-livre");
console.log(`  "Qtd salários" sumiu: ${!(await qtdLabel.isVisible())} (esperado: true)`);
console.log(`  Custom input sumiu: ${!(await salarioCustomInput.isVisible())} (esperado: true)`);

// ── 8. Modo Retroativo com SM ───────────────────────────────────────────────
console.log("\n8. Modo Retroativo + SM vigente");
const radioRetroativo = page.locator("button", { hasText: /Retroativo/i }).first();
await radioRetroativo.click();
await page.waitForTimeout(300);

const pillNaoAcrescentar = page.getByRole("button", { name: /Não acrescentar/i });
console.log(`  Pill "Não acrescentar" visível: ${await pillNaoAcrescentar.isVisible()} (esperado: true)`);

// Scroll para ver a seção
await pillNaoAcrescentar.scrollIntoViewIfNeeded();
await pillSM.click();
await page.waitForTimeout(200);

// Preenche valor retroativo (label contém "retroativo")
const retInput = page.locator('label:has-text("retroativo") + div input[type="text"]').first();
await retInput.scrollIntoViewIfNeeded();
await retInput.fill("10000");
await retInput.dispatchEvent("input");
await retInput.blur();
await page.waitForTimeout(200);

// Preenche percentual do advogado (único input[type="number"] no form)
const percInput = page.locator('input[type="number"]').first();
await percInput.fill("30");
await percInput.dispatchEvent("input");
await page.waitForTimeout(400);
await shot(page, "8-retroativo-sm");

// Verificar se resumo aparece
const resumoVisible = await page.locator("text=Total").first().isVisible();
console.log(`  Resumo "Total" visível no retroativo: ${resumoVisible}`);

await ctx.close();
await browser.close();
console.log("\n✅ Testes Nova Receita concluídos.");
