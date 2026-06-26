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

// ── Screenshot das tabs ──
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/ui1-auditoria-default.png` });
const linhasDefault = await page.locator('tbody tr').count();
console.log(`Padrão (20): ${linhasDefault} linhas`);

// Verifica hrefs dos botões Exibir
const links = await page.locator('a').filter({ hasText: /^10$/ }).all();
for (const l of links) {
  const href = await l.getAttribute('href');
  console.log('Link "10" href:', href);
}

// ── Testa pageSize=10 via goto ──
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria?pageSize=10');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/ui2-exibir-10.png` });
const linhas10 = await page.locator('tbody tr').count();
const botao10Ativo = await page.locator('a.bg-primary').filter({ hasText: /^10$/ }).isVisible().catch(() => false);
console.log(`pageSize=10: ${linhas10} linhas | botão 10 ativo: ${botao10Ativo}`);

// ── Testa pageSize=50 via goto ──
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria?pageSize=50');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/ui3-exibir-50.png` });
const linhas50 = await page.locator('tbody tr').count();
console.log(`pageSize=50: ${linhas50} linhas`);

// ── Clica no botão 10 na interface ──
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');

// Pega o href exato do botão 10
const btn10 = page.locator('a[href*="pageSize=10"]');
const temBtn10 = await btn10.isVisible().catch(() => false);
console.log('Botão "10" com href pageSize=10 visível:', temBtn10);
if (temBtn10) {
  const href10 = await btn10.getAttribute('href');
  console.log('href do botão 10:', href10);
  await btn10.click();
  await page.waitForURL('**/pageSize=10**', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DIR}/ui4-clique-10.png` });
  console.log('URL após clicar 10:', page.url());
  const linhasClicar10 = await page.locator('tbody tr').count();
  console.log('Linhas após clicar 10:', linhasClicar10);
}

await browser.close();
console.log('DONE');
