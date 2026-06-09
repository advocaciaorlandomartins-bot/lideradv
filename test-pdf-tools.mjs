import { chromium } from 'playwright';
const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';
const browser = await chromium.launch({ headless: false, slowMo: 250 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login OK');

// Grid de ferramentas
await page.goto('http://localhost:3000/dashboard/ferramentas-pdf');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
await page.screenshot({ path: `${DIR}/pdf1-grid.png` });
console.log('Screenshot 1 - grid ferramentas');

// Verifica textos
const cards = await page.locator('a h2').allTextContents();
console.log('Cards:', cards);

// Verifica ProIA (não TramitaIA)
const temProIA = await page.locator('text=ProIA').isVisible().catch(() => false);
const temTramita = await page.locator('text=TramitaIA').isVisible().catch(() => false);
console.log('ProIA visível:', temProIA, '| TramitaIA visível:', temTramita);

// Abre a página de converter PDF em imagens
await page.goto('http://localhost:3000/dashboard/ferramentas-pdf/pdf-para-imagens');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/pdf2-converter-imagens.png` });
console.log('Screenshot 2 - converter PDF em imagens');

await browser.close();
console.log('DONE');
