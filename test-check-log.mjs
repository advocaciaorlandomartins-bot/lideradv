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

// Abre auditoria sem filtro — pega todos os registros recentes
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');

// Filtra apenas Lançamento (sem filtrar ação) para ver o que foi gravado
await page.selectOption('select[name=entidade]', { label: 'Lançamento' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/check-lancamentos-log.png` });

// Lê o conteúdo da tabela
const linhas = await page.locator('tbody tr, table tr').allTextContents();
console.log('Registros encontrados:', linhas.length);
for (const l of linhas.slice(0, 10)) {
  console.log(' ', l.replace(/\s+/g, ' ').trim().slice(0, 120));
}

await browser.close();
