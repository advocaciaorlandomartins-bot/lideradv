import { chromium } from 'playwright';
const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';
const browser = await chromium.launch({ headless: false, slowMo: 200 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });

// Auditoria com pageSize=10 (exibe 10 linhas — barra fica visível sem scroll)
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria?pageSize=10');
await page.waitForLoadState('networkidle');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/final-exibir-bar.png` });
console.log('Screenshot rodapé da tabela (pageSize=10)');

await browser.close();
console.log('DONE');
