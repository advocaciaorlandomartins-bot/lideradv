import { chromium } from 'playwright';
import path from 'path';
import { statSync } from 'fs';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';
const PDF_PATH = path.join(DIR, 'teste-conversao.pdf');

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Login
await page.goto('http://localhost:3000/');
await page.waitForLoadState('networkidle');
await page.fill('[name=login]', 'advocaciaorlandomartins@gmail.com');
await page.fill('[name=senha]', 'Wk921a07@');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard**', { timeout: 10000 });
console.log('Login OK');

await page.goto('http://localhost:3000/dashboard/ferramentas-pdf/pdf-para-imagens');
await page.waitForLoadState('networkidle');

// Seleciona PNG
await page.selectOption('select', { label: 'PNG (maior qualidade)' });
console.log('Formato: PNG');

// Upload
await page.locator('input[type="file"]').setInputFiles(PDF_PATH);
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/png1-pronto.png` });

// Converte
await page.click('button:has-text("Converter")');
console.log('Convertendo...');
await page.waitForSelector('img[alt="Página 3"]', { timeout: 30000 });
await page.waitForTimeout(400);
console.log('3 páginas prontas');

await page.evaluate(() => window.scrollBy(0, 300));
await page.waitForTimeout(300);
await page.screenshot({ path: `${DIR}/png2-galeria.png` });

// Clica no botão Baixar da Página 1 (índice 0)
const btnsBaixar = page.locator('button').filter({ hasText: /Baixar/ }).filter({ hasNotText: 'todas' }).filter({ hasNotText: 'Converter' });
const btnPag1 = btnsBaixar.nth(0);
console.log('Texto do botão pág 1:', (await btnPag1.textContent())?.trim());

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  btnPag1.click(),
]);

const filename = download.suggestedFilename();
console.log('Arquivo baixado:', filename);

const savePath = path.join(DIR, 'resultado-' + filename);
await download.saveAs(savePath);

const stat = statSync(savePath);
console.log('Tamanho:', (stat.size / 1024).toFixed(1), 'KB');
console.log(filename.endsWith('.png') ? '✅ Extensão PNG correta' : '❌ Extensão errada: ' + filename);
console.log(filename.includes('pagina1') ? '✅ Nome correto (pagina1)' : '❌ Nome inesperado: ' + filename);
console.log(stat.size > 5000 ? '✅ Arquivo com conteúdo' : '❌ Arquivo muito pequeno');

await page.screenshot({ path: `${DIR}/png3-apos-download.png` });
console.log('DONE');

await browser.close();
