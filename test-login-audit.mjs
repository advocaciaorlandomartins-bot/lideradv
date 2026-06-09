import { chromium } from 'playwright';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Faz o login e captura o horário
const agora = new Date().toLocaleTimeString('pt-BR');
console.log('Hora do login:', agora);

await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/lg0-tela-login.png` });

await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login feito com sucesso');

await page.screenshot({ path: `${DIR}/lg1-dashboard.png` });

// Log de auditoria filtrado por Usuário + Login
await page.goto('http://localhost:3000/dashboard/gerenciador/auditoria');
await page.waitForLoadState('networkidle');
await page.selectOption('select[name=entidade]', { label: 'Usuário' });
await page.selectOption('select[name=acao]', { label: 'Login' });
await page.click('button[type=submit]');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/lg2-auditoria-login.png` });
console.log('Screenshot - auditoria: Usuário + Login');

// Mostra registros
const linhas = await page.locator('tbody tr').allTextContents();
console.log('Registros de login encontrados:', linhas.length);
for (const l of linhas.slice(0, 5)) {
  console.log(' ', l.replace(/\s+/g, ' ').trim().slice(0, 120));
}

await browser.close();
console.log('DONE');
