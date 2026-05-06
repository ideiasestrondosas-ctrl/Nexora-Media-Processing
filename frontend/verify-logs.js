const { chromium } = require('playwright');

(async () => {
  console.log('A iniciar Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('A navegar para http://localhost:3002/login...');
    await page.goto('http://localhost:3002/login');
    
    console.log('A aguardar formulário...');
    await page.waitForSelector('#username');

    console.log('A fazer login...');
    await page.fill('#username', 'user-123');
    await page.fill('#secret', 'changeme');
    await page.click('button[type="submit"]');

    console.log('Aguardar navegação após login...');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(e => console.log('Timeout navigation, continuando...'));

    console.log('A navegar para a página de Logs...');
    await page.goto('http://localhost:3002/logs');
    
    console.log('A aguardar que os logs comecem a aparecer (5 segundos)...');
    await page.waitForTimeout(5000);

    // Extrair o conteúdo da janela de logs para a consola
    const logContent = await page.evaluate(() => {
      // Find all elements containing log text
      const codeBlocks = Array.from(document.querySelectorAll('code, pre, .font-mono'));
      return codeBlocks.map(el => el.innerText).join('\n');
    });
    console.log('\n--- CONTEÚDO DOS LOGS (FRONTEND) ---');
    console.log(logContent.substring(0, 500) + (logContent.length > 500 ? '...' : ''));
    console.log('------------------------------------\n');

    console.log('A tirar screenshot (logs_page.png)...');
    await page.screenshot({ path: 'logs_page.png' });
    console.log('Sucesso!');
  } catch (err) {
    console.error('Erro durante a execução do Playwright:', err);
  } finally {
    await browser.close();
  }
})();
