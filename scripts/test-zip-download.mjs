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

// Navega para converter PDF em imagens
await page.goto('http://localhost:3000/dashboard/ferramentas-pdf/pdf-para-imagens');
await page.waitForLoadState('networkidle');

// Upload do PDF
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(PDF_PATH);
await page.waitForTimeout(500);

// Converte
await page.click('button:has-text("Converter")');
console.log('Convertendo...');

// Aguarda as 3 páginas aparecerem
await page.waitForSelector('img[alt="Página 3"]', { timeout: 30000 });
await page.waitForTimeout(400);
console.log('3 páginas convertidas');

// Rola para o botão ZIP
await page.evaluate(() => window.scrollBy(0, 300));
await page.waitForTimeout(300);
await page.screenshot({ path: `${DIR}/zip1-antes-download.png` });
console.log('Screenshot 1 - antes de clicar ZIP');

// Intercepta o download e clica no botão
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.click('button:has-text("Baixar todas")'),
]);

console.log('Download iniciado:', download.suggestedFilename());

// Salva na pasta do projeto
const savePath = path.join(DIR, 'resultado-' + download.suggestedFilename());
await download.saveAs(savePath);
console.log('Arquivo salvo em:', savePath);

// Verifica tamanho
try {
  const stat = statSync(savePath);
  console.log('Tamanho do ZIP:', (stat.size / 1024).toFixed(1), 'KB');
  console.log(stat.size > 1000 ? '✅ ZIP gerado com conteúdo' : '❌ ZIP muito pequeno');
} catch {
  console.log('❌ Arquivo não encontrado');
}

await page.screenshot({ path: `${DIR}/zip2-apos-download.png` });
console.log('Screenshot 2 - após download');

await browser.close();
console.log('DONE');
