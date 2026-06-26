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

// Página de conversão
await page.goto('http://localhost:3000/dashboard/ferramentas-pdf/pdf-para-imagens');
await page.waitForLoadState('networkidle');

// Upload e conversão
await page.locator('input[type="file"]').setInputFiles(PDF_PATH);
await page.waitForTimeout(400);
await page.click('button:has-text("Converter")');
console.log('Convertendo...');

await page.waitForSelector('img[alt="Página 3"]', { timeout: 30000 });
await page.waitForTimeout(400);
console.log('3 páginas prontas');

// Lista todos os botões para depuração
const allBtns = await page.locator('button').allTextContents();
console.log('Botões na página:', allBtns.map(t => t.trim()));

// Os botões individuais "Baixar" não contêm "todas"
// Filtra apenas os que são exatamente "Baixar" (sem "todas")
const btnsBaixarIndividual = page.locator('button').filter({ hasText: /^[\s\S]*Baixar[\s\S]*$/ })
  .filter({ hasNotText: 'todas' })
  .filter({ hasNotText: 'Converter' });

const count = await btnsBaixarIndividual.count();
console.log('Botões Baixar individuais encontrados:', count);

await page.evaluate(() => window.scrollBy(0, 300));
await page.waitForTimeout(300);
await page.screenshot({ path: `${DIR}/ind1-galeria.png` });

// Clica no botão da Página 2 (índice 1)
const btnPag2 = btnsBaixarIndividual.nth(1);
console.log('Texto do botão pág 2:', await btnPag2.textContent());

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  btnPag2.click(),
]);

const filename = download.suggestedFilename();
console.log('Arquivo baixado:', filename);

const savePath = path.join(DIR, 'resultado-' + filename);
await download.saveAs(savePath);

const stat = statSync(savePath);
console.log('Tamanho:', (stat.size / 1024).toFixed(1), 'KB');
console.log(stat.size > 5000 ? '✅ Imagem gerada corretamente' : '❌ Arquivo muito pequeno');
console.log(filename.includes('pagina2') ? '✅ Nome correto (pagina2)' : '❌ Nome inesperado: ' + filename);

await page.screenshot({ path: `${DIR}/ind2-apos-download.png` });
console.log('Screenshot final');

await browser.close();
console.log('DONE');
