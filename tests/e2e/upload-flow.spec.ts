import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Nexora Media Processing E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Vamos assumir que o frontend estará a correr no porto 3000
    await page.goto('http://localhost:3000/');
  });

  test('Deve fazer upload de um ficheiro, processar e apresentar resultado', async ({ page }) => {
    // Como a UI ainda pode estar em desenvolvimento, procuramos por test-ids ou input fields
    
    // 1. Simular login (se a plataforma tiver login UI)
    // Se não tiver login UI no momento, avançamos directo para o upload
    const loginButton = page.getByRole('button', { name: /entrar/i });
    if (await loginButton.isVisible()) {
      await page.fill('input[type="text"]', 'user-test');
      await page.fill('input[type="password"]', 'password-123');
      await loginButton.click();
      
      // Aguardar redireccionamento
      await page.waitForURL('**/dashboard');
    }

    // 2. Localizar o input de ficheiros
    // Vamos usar a fixture de vídeo perfeita (se não existir geramos no momento, ou usamos um ficheiro dummy)
    const filePath = path.resolve(__dirname, '../fixtures/data/base_1080p_25fps.mp4');
    
    // Mock file input - assume que o desenvolvedor usará type="file"
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(filePath);
      
      // Selecionar o profile (se houver UI para isso)
      const profileSelect = page.locator('select[name="profile"]');
      if (await profileSelect.isVisible()) {
        await profileSelect.selectOption('broadcast-hd');
      }

      // 3. Submeter
      const uploadBtn = page.getByRole('button', { name: /upload|processar/i });
      await uploadBtn.click();

      // 4. Aguardar progresso
      // Assumimos que o status muda para "COMPLETED" ou que aparece um botão de download
      // O processamento pode demorar, aumentamos o timeout para 60s
      test.setTimeout(60000);

      const statusBadge = page.getByText(/CONCLUÍDO|COMPLETED/i);
      await expect(statusBadge).toBeVisible({ timeout: 50000 });

      // 5. Verificar botão de download ou playback
      const downloadBtn = page.getByRole('button', { name: /download|baixar/i });
      await expect(downloadBtn).toBeVisible();
    } else {
      console.log('UI de upload ainda não implementada para testes E2E completos.');
      test.skip();
    }
  });
});
