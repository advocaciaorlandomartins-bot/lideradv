import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 250 });
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

// Novo cliente
await page.goto('http://localhost:3000/dashboard/clientes/novo');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/c0-form-cliente.png` });

// Tipo (PF já deve ser default)
const tipoOpts = await page.locator('input[name="type"]').all();
console.log('Opções de tipo:', tipoOpts.length);

// Preenche os campos obrigatórios
await page.fill('input[name="name"]', 'Cliente Teste Auditoria');
await page.fill('input[name="doc"]', '123.456.789-09');
await page.fill('input[name="phone"]', '(11) 99999-0000');
await page.fill('input[name="email"]', 'teste.auditoria@example.com');

// Endereço
await page.fill('input[name="cep"]', '01310-100');
await page.waitForTimeout(1000); // aguarda autofill do CEP

await page.screenshot({ path: `${DIR}/c1-apos-cep.png` });

// Preenche endereço manualmente caso o autofill não funcione
const streetVal = await page.locator('input[name="street"]').inputValue();
if (!streetVal) {
  await page.fill('input[name="street"]', 'Avenida Paulista');
}
await page.fill('input[name="number"]', '1000');

const neighborhoodVal = await page.locator('input[name="neighborhood"]').inputValue();
if (!neighborhoodVal) {
  await page.fill('input[name="neighborhood"]', 'Bela Vista');
}

const cityVal = await page.locator('input[name="city"]').inputValue();
if (!cityVal) {
  await page.fill('input[name="city"]', 'São Paulo');
}

// Estado
const stateSelect = page.locator('select[name="state"]');
const stateVal = await stateSelect.inputValue();
if (!stateVal) {
  await stateSelect.selectOption('SP');
}

await page.screenshot({ path: `${DIR}/c2-form-completo.png` });
console.log('Screenshot 2 - formulário completo');

// Salvar
await page.click('button[type=submit]');

try {
  await page.waitForURL((url) => url.pathname.includes('/clientes') && !url.pathname.includes('/novo'), { timeout: 20000 });
  console.log('Cliente salvo! URL:', page.url());
} catch {
  console.log('Redirect não aconteceu. URL:', page.url());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const erros = await page.locator('[class*="text-red"], [class*="bg-red"]').allTextContents();
  if (erros.length) console.log('Erros na tela:', erros);
}

await page.screenshot({ path: `${DIR}/c3-pos-salvar.png` });
console.log('Screenshot 3 - pós salvar');

// Log de auditoria
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/c4-auditoria.png` });
console.log('Screenshot 4 - auditoria geral');

// Filtra por Cliente
await page.selectOption('select[name=entidade]', { label: 'Cliente' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/c5-auditoria-filtrada.png` });
console.log('Screenshot 5 - filtrado por Cliente');

await browser.close();
console.log('DONE');
