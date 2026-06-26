import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';

const DIR = 'C:/Users/Orlando/Documents/Teste/next-app';
const PDF_PATH = path.join(DIR, 'teste-conversao.pdf');

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

// Navega para a página de conversão
await page.goto('http://localhost:3000/dashboard/ferramentas-pdf/pdf-para-imagens');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${DIR}/conv0-inicial.png` });
console.log('Screenshot 0 - página inicial');

// Seleciona formato PNG e 150 DPI
await page.selectOption('select', { label: 'PNG (maior qualidade)' });
await page.screenshot({ path: `${DIR}/conv1-opcoes.png` });
console.log('Screenshot 1 - opções selecionadas (PNG, 150 DPI)');

// Faz upload do PDF via input file
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles(PDF_PATH);
await page.waitForTimeout(600);
await page.screenshot({ path: `${DIR}/conv2-pdf-carregado.png` });
console.log('Screenshot 2 - PDF carregado na drop zone');

// Clica em Converter
await page.click('button:has-text("Converter")');
console.log('Conversão iniciada...');

// Aguarda as páginas aparecerem (progresso)
await page.waitForTimeout(1000);
await page.screenshot({ path: `${DIR}/conv3-convertendo.png` });
console.log('Screenshot 3 - convertendo...');

// Aguarda resultado (até 30s)
await page.waitForSelector('img[alt="Página 1"]', { timeout: 30000 });
await page.waitForTimeout(500);

// Scroll para ver todas as páginas
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/conv4-resultado.png` });
console.log('Screenshot 4 - resultado com galeria');

// Conta imagens convertidas
const imgs = await page.locator('img[alt^="Página"]').count();
console.log('Imagens convertidas:', imgs);

// Verifica botão "Baixar todas (ZIP)"
const temZip = await page.locator('button:has-text("Baixar todas")').isVisible().catch(() => false);
console.log('Botão ZIP visível:', temZip);

// Dimensões da primeira imagem
const dim = await page.locator('span:has-text("px")').first().textContent().catch(() => '');
console.log('Dimensões pág 1:', dim?.trim());

await browser.close();
console.log('DONE');
