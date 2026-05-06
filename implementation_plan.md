# Plano de Implementação Nexora

Este plano visa resolver os 5 pontos levantados no diagnóstico e pedido de melhorias:

## Resumo dos Problemas

1. **"Diagnóstico Automático" no menu logs não faz nada e quando é acionado?**
   - O diagnóstico automático está implementado no frontend para reagir a logs que possuam um campo `diagnostic`. Atualmente, o backend deve enviar eventos SSE com esse campo. É necessário garantir que o backend emite estes diagnósticos ou documentar claramente que só aparecem quando ocorrem falhas específicas.
2. **Menu "Manual": Versão não está associada à do menu Definições**
   - No menu Manual, a versão não é obtida dinamicamente da mesma forma que nas definições (onde vai a `/system/version`). 
3. **Menu "Manual": Atualizar com novas funcionalidades**
   - O texto do manual será revisto para incluir secções sobre novos plugins/ferramentas e atualizações recentes que constem do sistema.
4. **Analisar tempo de restart do serviço e demora na disponibilidade do Login**
   - A inicialização lenta pode dever-se a tentativas de conexão com *timeouts* (ex: Redis, DB, MinIO) ou bloqueios na verificação de ferramentas (`availability-checker.ts`). Será analisada a cadeia de `init` no `src/index.ts` e otimizada (por exemplo, efetuando as verificações de forma paralela ou definindo timeouts mais agressivos na inicialização).
5. **Página de Login: Estado de "A autenticar...", desabilitar botão e restaurar em erro**
   - O botão de login deve mudar o texto para "A autenticar..." ou similar, ficar desabilitado (`disabled={loading}`) e voltar ao normal se der erro. Isto já está parcialmente feito no `login/page.tsx`, mas será revisto para garantir que a indicação visual ("o que está a fazer") aparece *em cima do botão* conforme o pedido.

## User Review Required

> [!IMPORTANT]
> - O longo tempo de restart deve-se muitas vezes a tentativas de reconexão a bases de dados (PostgreSQL/Redis) inacessíveis ou a verificações de executáveis externos (FFmpeg, HandBrake, etc.). Alguma ferramenta externa específica tem demorado a carregar no seu ambiente?
> - Existem atualizações específicas que gostaria de ver destacadas no Manual (ex: integração com o bs1770gain para normalização de áudio, legendas, etc.)?

## Proposed Changes

### Frontend - Interface e Experiência

#### [MODIFY] [login/page.tsx](file:///c:/Dev/Nexora%20Media%20Processing/frontend/src/app/login/page.tsx)
- Modificar o botão de login para mostrar um spinner e o texto exato do estado. Garantir que fica completamente inativo (`disabled`) durante o request e que reverte para ativo se ocorrer erro, exibindo o respetivo feedback.

#### [MODIFY] [manual/page.tsx](file:///c:/Dev/Nexora%20Media%20Processing/frontend/src/app/manual/page.tsx) e [UserManualPopup.tsx](file:///c:/Dev/Nexora%20Media%20Processing/frontend/src/components/layout/UserManualPopup.tsx)
- Implementar a rotina de obter a versão atual do backend (idêntico ao que é feito no `settings/page.tsx`), utilizando um fallback para a versão estática em caso de erro.
- Atualizar o conteúdo do manual para refletir novidades recentes do pipeline (ex: verificação de áudio, uso do bs1770gain, legendas).

### Backend - Performance de Inicialização

#### [MODIFY] [index.ts](file:///c:/Dev/Nexora%20Media%20Processing/src/index.ts)
- Otimizar a cadeia de inicialização (`start()`):
  - Em vez de fazer `await initDatabase()`, `await ensureBuckets()`, `await initQueues()` sequencialmente se não forem interdependentes, ou pelo menos registar o tempo que cada etapa demora e introduzir `Promise.all` nas operações seguras de paralelizar.
  - O `availability-checker` é executado na rota de health, mas verificar se existem inicializações pesadas e movê-las para *background* após o `app.listen()` para que a página de login responda de imediato (e o estado interno fique 'degraded' até as ferramentas estarem ativas).

## Verification Plan

### Testes Manuais
1. Reiniciar o serviço e medir o tempo (utilizando logs) até a porta ficar em modo de escuta.
2. Aceder ao ecrã de login e verificar a fluidez do bloqueio do botão durante o login.
3. No ecrã Manual, verificar se a versão exibida reflete a versão real e as novas atualizações de conteúdo.
4. No menu Logs, simular a injeção de um log com o objeto `diagnostic` e verificar se este renderiza no painel correspondente ("Diagnóstico Automático").
