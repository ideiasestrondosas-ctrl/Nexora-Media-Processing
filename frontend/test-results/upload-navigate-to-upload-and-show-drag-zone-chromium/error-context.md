# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upload.spec.ts >> navigate to upload and show drag zone
- Location: tests\upload.spec.ts:3:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected substring: "Novo Asset"
Received string:    "Dashboard Overview"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1')
    8 × locator resolved to <h1 class="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
      - unexpected value "Dashboard Overview"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: Nexora
        - button [ref=e6] [cursor=pointer]:
          - img
      - navigation [ref=e7]:
        - list [ref=e8]:
          - listitem [ref=e9]:
            - link "Dashboard" [ref=e10] [cursor=pointer]:
              - /url: /
              - img [ref=e11]
              - generic [ref=e16]: Dashboard
          - listitem [ref=e17]:
            - link "Assets" [ref=e18] [cursor=pointer]:
              - /url: /assets
              - img [ref=e19]
              - generic [ref=e21]: Assets
          - listitem [ref=e22]:
            - link "Upload" [active] [ref=e23] [cursor=pointer]:
              - /url: /assets/upload
              - img [ref=e24]
              - generic [ref=e27]: Upload
          - listitem [ref=e28]:
            - link "Filas (Queue)" [ref=e29] [cursor=pointer]:
              - /url: /queue
              - img [ref=e30]
              - generic [ref=e32]: Filas (Queue)
          - listitem [ref=e33]:
            - link "Perfis de Encoding" [ref=e34] [cursor=pointer]:
              - /url: /profiles
              - img [ref=e35]
              - generic [ref=e38]: Perfis de Encoding
    - generic [ref=e39]:
      - banner [ref=e40]:
        - generic [ref=e41]:
          - text: Nexora Media Processing /
          - generic [ref=e42]: Dashboard
        - generic [ref=e44]: Sem Autenticação (Modo Dev)
      - main [ref=e45]:
        - generic [ref=e46]:
          - generic [ref=e47]:
            - heading "Novo Asset" [level=1] [ref=e48]
            - paragraph [ref=e49]: Faça upload de um ficheiro de media para iniciar o workflow de processamento Nexora.
          - generic [ref=e53] [cursor=pointer]:
            - img [ref=e55]
            - heading "Arrasta e Larga o teu media aqui" [level=3] [ref=e58]
            - paragraph [ref=e59]: Suporta MP4, MOV, MXF (ProRes, XDCAM, DNxHD) até 50GB.
            - button "Procurar ficheiro" [ref=e60]
  - region "Notifications (F8)":
    - list
  - alert [ref=e61]
  - generic [ref=e62]: "40"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('navigate to upload and show drag zone', async ({ page }) => {
  4  |   await page.goto('/');
  5  | 
  6  |   // Navigates using sidebar
  7  |   await page.click('text=Upload');
  8  | 
  9  |   // Verify page title
> 10 |   await expect(page.locator('h1')).toContainText('Novo Asset');
     |                                    ^ Error: expect(locator).toContainText(expected) failed
  11 | 
  12 |   // Verify upload zone text
  13 |   await expect(page.getByText('Arrasta e Larga o teu media aqui')).toBeVisible();
  14 | });
  15 | 
```