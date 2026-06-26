import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 0 });
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

// Financeiro
await page.goto('http://localhost:3000/dashboard/financeiro');
await page.waitForLoadState('networkidle');

const countAntes = await page.locator('button:has-text("Recebi")').count();
console.log('Botões Recebi:', countAntes);

// Inspeciona o botão antes de clicar
const btn = page.locator('button:has-text("Recebi")').first();
const btnText = await btn.textContent();
const btnDisabled = await btn.isDisabled();
console.log('Botão texto:', btnText?.trim(), '| disabled:', btnDisabled);

// Usa evaluate para interceptar o click via console.log do browser
await page.evaluate(() => {
  const btn = document.querySelector('button');
  const all = document.querySelectorAll('button');
  const recebiBtns = [...all].filter(b => b.textContent?.includes('Recebi'));
  console.log('[BROWSER] Recebi buttons encontrados:', recebiBtns.length);
  recebiBtns.forEach((b, i) => console.log(`[BROWSER] btn[${i}]`, b.textContent?.trim()));
});

// Captura console.log do browser
page.on('console', msg => {
  if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warn') {
    console.log(`[BROWSER ${msg.type()}]`, msg.text());
  }
});

// Intercept via route para ver TODOS os requests incluindo fetch
let requests = [];
await page.route('**/*', async (route) => {
  const req = route.request();
  const method = req.method();
  const url = req.url().replace('http://localhost:3000', '');
  if (!url.includes('_next/static') && method !== 'GET' || url.includes('dashboard/financeiro')) {
    requests.push({ method, url });
    if (method !== 'GET') console.log(`[INTERCEPT ${method}]`, url.slice(0, 100));
  }
  await route.continue();
});

console.log('\n--- Clicando Recebi ---');
const recebido = await btn.isVisible();
console.log('Botão visível:', recebido);
await btn.click();
console.log('Click feito. Aguardando 4s...');
await page.waitForTimeout(4000);

console.log('Requests não-GET capturados:', requests.filter(r => r.method !== 'GET').length);
console.log('Requests POST capturados:', requests.filter(r => r.method === 'POST').length);

const countDepois = await page.locator('button:has-text("Recebi"), button:has-text("Desfazer")').count();
console.log('Botões Recebi/Desfazer depois:', countDepois);

await page.screenshot({ path: `${DIR}/pd-final.png` });
await browser.close();
