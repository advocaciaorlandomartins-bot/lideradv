import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Login
await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login OK');

// Novo lançamento
await page.goto('http://localhost:3000/dashboard/financeiro/novo');
await page.waitForLoadState('networkidle');

// Screenshot do topo do formulário
await page.screenshot({ path: `${DIR}/t0-form-topo.png` });

// Confirma tipo = entrada (default)
console.log('tipo default:', await page.locator('input[name="tipo"]:checked').inputValue());

// Ver todos os selects na página
const selects = await page.locator('select').all();
console.log('Total de selects na página:', selects.length);
for (let i = 0; i < selects.length; i++) {
  const name = await selects[i].getAttribute('name');
  const opts = await selects[i].locator('option').allTextContents();
  console.log(`  select[${i}] name="${name}" opções:`, opts.slice(0, 5));
}

// Seleciona categoria Honorários (segundo select = categoria)
const categoriaSelect = page.locator('select').nth(1);
await categoriaSelect.selectOption('Honorários');
await page.waitForTimeout(300);

const catVal = await categoriaSelect.inputValue();
console.log('Categoria selecionada:', catVal);

// Data de vencimento
await page.fill('input[name="data_vencimento"]', '2026-06-30');
await page.waitForTimeout(200);

// Valor total (modo À vista)
const valorInput = page.locator('input[placeholder="0,00"]').first();
await valorInput.click();
await valorInput.fill('1500');
await page.keyboard.press('Tab');
await page.waitForTimeout(500);

// Checa o valor do hidden input antes de submeter
const valorHidden = await page.locator('input[name="valor"]').inputValue();
console.log('Hidden valor:', valorHidden);

await page.screenshot({ path: `${DIR}/t1-form-preenchido.png` });
console.log('Screenshot 1 - formulário preenchido');

// Salvar
await page.click('text=Salvar lançamento');

// Aguarda URL mudar OU mensagem de erro aparecer
let salvou = false;
try {
  await page.waitForURL((url) => !url.pathname.includes('/novo'), { timeout: 20000 });
  salvou = true;
  console.log('Lançamento salvo! URL:', page.url());
} catch {
  console.log('Redirect não aconteceu em 20s. URL:', page.url());
  // Rola pro topo para ver qualquer mensagem de erro
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Captura texto de erro se existir
  const erroEls = await page.locator('[class*="text-red"], [class*="error"], [role="alert"]').all();
  for (const el of erroEls) {
    const txt = await el.textContent();
    if (txt && txt.trim()) console.log('ERRO na tela:', txt.trim());
  }
}

await page.screenshot({ path: `${DIR}/t2-pos-salvar.png` });
console.log('Screenshot 2 - pós salvar');

if (!salvou) {
  // Rola pro topo e tira screenshot com erro visível
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${DIR}/t2b-topo-erro.png` });
  console.log('Screenshot 2b - topo com erro');
}

// Log de auditoria
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/t3-auditoria.png` });
console.log('Screenshot 3 - auditoria completa');

// Filtra só lançamentos
const entidadeOpts = await page.locator('select[name=entidade] option').allTextContents();
console.log('Opções do filtro entidade:', entidadeOpts);

const lancamentoOptExists = entidadeOpts.some(o => o.toLowerCase().includes('lançamento') || o.toLowerCase().includes('lancamento'));
if (lancamentoOptExists) {
  const val = entidadeOpts.find(o => o.toLowerCase().includes('lançamento') || o.toLowerCase().includes('lancamento'));
  console.log('Selecionando filtro:', val);
  await page.selectOption('select[name=entidade]', { label: val });
  await page.click('button[type=submit]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DIR}/t4-auditoria-filtrada.png` });
  console.log('Screenshot 4 - filtrado por lançamento');
}

await browser.close();
console.log('DONE');
