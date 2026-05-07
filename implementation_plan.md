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

### Manual de Utilizador e Documentação (Página e Popup)

#### [MODIFY] [ManualPage.tsx](file:///c:/Dev/Nexora%20Media%20Processing/frontend/src/app/manual/page.tsx)
#### [MODIFY] [UserManualPopup.tsx](file:///c:/Dev/Nexora%20Media%20Processing/frontend/src/components/layout/UserManualPopup.tsx)
#### [MODIFY] [manual_menus.md](file:///c:/Dev/Nexora%20Media%20Processing/docs/manual_menus.md)
#### [MODIFY] [manual_utilizador.md](file:///c:/Dev/Nexora%20Media%20Processing/docs/manual_utilizador.md)

**Novas secções e detalhamento:**

1.  **Perfis de Encoding (Detalhados)**:
    - Listar todos os 11 perfis ativos (`NexoraProxyLowRes`, `NexoraWebOptimized1080p`, `NexoraBroadcast4K`, `NexoraArchiveMaster`, `NexoraHLS1080p`, `NexoraHLS720p`, `NexoraHLS480p`, `NexoraSocialMedia`, `Nexora4KHDR`, `NexoraHEVCEfficient1080p`, `NexoraQuickPreview`).
    - Para cada perfil, incluir: **Codec**, **Resolução**, **Bitrate Médio**, **Uso Recomendado** e se suporta **Aceleração de Hardware**.

2.  **Expansão do HOW-TO**:
    - **Cenário 1: Primeiro Upload**: Fluxo básico de ingestão.
    - **Cenário 2: Diagnóstico de Erros**: Como ler os logs e aplicar correções automáticas do motor de diagnóstico.
    - **Cenário 3: Aprovação de Quarentena**: Procedimento de QC manual para assets com VMAF abaixo do threshold.
    - **Cenário 4: Configuração de Armazenamento**: Diferenças entre Disco Local e MinIO (Cloud).
    - **Cenário 5: Gestão de RBAC**: Como atribuir roles (`VIEWER`, `OPERATOR`, `ADMIN`) a novos utilizadores.
    - **Cenário 6: Aceleração GPU**: Como configurar os workers para usar NVENC/QuickSync.

3.  **Guia de Scripts e Ferramentas CLI**:
    - Criar uma nova secção dedicada a documentar todos os scripts do ecossistema:
        - `nexora.ps1`: Gestor central de ambiente (comandos `start`, `stop`, `restart`, `status`, `logs`, `reset`).
        - `executa_10_passos.ps1`: Script de instalação automatizada em 10 etapas.
        - `nexora-mover-tudo.ps1`: Utilitário de organização de diretórios e migração de ficheiros.
        - `scripts/sync-presets.ts`: Sincronização de presets HandBrake com a base de dados.
        - `scripts/flush-queues.ts`: Comando de emergência para limpar filas BullMQ (Redis).
        - `nexora_mover_node.js`: Lógica de movimentação inteligente de assets entre storage layers.

## Verification Plan

### Automated Tests
- Verificar via Playwright se as novas secções aparecem no DOM tanto na página como no popup.
- Validar se todos os links internos da documentação estão funcionais.

### Manual Verification
- Confirmar visualmente se a tabela de perfis de encoding contém todos os 11 itens e se a formatação está legível.
- Testar a navegação entre os novos cenários do HOW-TO no popup.
- Validar se a explicação dos scripts é clara para um administrador de sistemas.
