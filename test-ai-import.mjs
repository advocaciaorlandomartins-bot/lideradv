import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PNG 200x120 branco com pixels pretos formando texto simulado
// (PNG válido gerado via base64 — Claude tentará extrair dados)
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAYAAAHnGHGcAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz" +
  "AAALEwAACxMBAJqcGAAAA3ZJREFUeJzt3TFuwzAMQFHl/ofOkCFDh6IopUh+kgMkSuLnQ5Ikif8B" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgvQ8AAAD//2NgYGBgJCIiIiIiIiIiIiI=" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

(async () => {
  // Salva a imagem temporária
  const imgBuffer = Buffer.from(PNG_BASE64, "base64");
  const tmpImg = path.join(__dirname, "test-doc-temp.png");
  fs.writeFileSync(tmpImg, imgBuffer);

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  try {
    // 1. Login
    console.log("1. Fazendo login...");
    await page.goto("http://localhost:3000");
    await page.fill('input[name="login"]', "lideradv");
    await page.fill('input[name="senha"]', "123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
    console.log("   ✓ Login OK");

    // 2. Testar o endpoint diretamente via fetch com a sessão
    console.log("\n2. Testando endpoint /api/clientes/importacao-ia diretamente...");
    const cookies = await page.context().cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await page.evaluate(
      async ({ cookieStr }) => {
        const fd = new FormData();
        // PNG 1x1 pixel cinza válido
        const bytes = Uint8Array.from(atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        ), c => c.charCodeAt(0));
        fd.append("file", new File([bytes], "test.png", { type: "image/png" }));

        const response = await fetch("/api/clientes/importacao-ia", {
          method: "POST",
          body: fd,
        });

        const status = response.status;
        let body;
        try { body = await response.json(); } catch { body = {}; }
        return { status, body };
      },
      { cookieStr }
    );

    console.log(`   Status HTTP: ${res.status}`);
    console.log(`   Resposta:`, JSON.stringify(res.body, null, 2));

    if (res.status === 500 && res.body?.error?.includes("ANTHROPIC_API_KEY")) {
      console.log("\n   ✗ FALHA — chave Anthropic não configurada no servidor");
    } else if (res.status === 500 && res.body?.error?.includes("quota")) {
      console.log("\n   ✗ FALHA — cota esgotada (ainda usando OpenAI?)");
    } else if (res.status === 200 && res.body?.data) {
      console.log("\n   ✓ SUCESSO — Anthropic respondeu e extraiu dados!");
    } else if (res.status === 422) {
      console.log("\n   ✓ API Anthropic funcionando (imagem de teste sem dados legíveis — esperado)");
    } else if (res.body?.error) {
      console.log(`\n   ⚠ Resposta com erro: ${res.body.error}`);
    } else {
      console.log("\n   ✓ Endpoint respondeu — verificar detalhes acima");
    }

    // 3. Testar via UI — abrir modal
    console.log("\n3. Testando via UI — modal de importação...");
    await page.goto("http://localhost:3000/dashboard/clientes");
    await page.waitForLoadState("networkidle");
    await page.click('button:has-text("Novo cliente")');
    await page.waitForTimeout(600);
    await page.click('text=Importar por documento');
    await page.waitForTimeout(800);

    const modalAberto = await page.locator('[role="dialog"], .modal, text=Importar').first().isVisible().catch(() => false);
    console.log(`   Modal aberto: ${modalAberto ? "✓ sim" : "✗ não encontrado"}`);

    await page.screenshot({ path: path.join(__dirname, "screenshot-ai-import.png") });
    console.log("\n   → Screenshot: screenshot-ai-import.png");

  } finally {
    if (fs.existsSync(tmpImg)) fs.unlinkSync(tmpImg);
    await browser.close();
  }
})();
