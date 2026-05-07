# Manual de Utilizador e Resolução de Problemas — Nexora

Este manual guia-o através da utilização diária da plataforma Nexora e fornece soluções para os problemas mais comuns.

---

## 1. Guia Passo a Passo

### Como processar um vídeo pela primeira vez:
1. **Configuração Inicial (Admin)**: Se pretender usar armazenamento local, o administrador deve ir a "Utilizadores", definir um caminho na secção "Armazenamento Local" e clicar em "Guardar Caminho".
2. **Login**: Aceda a `http://localhost:3002` e entre com as suas credenciais.
3. **Perfis**: Verifique no menu "Perfis de Encoding" se existe um perfil adequado para o seu objetivo.
4. **Upload**: 
    - Vá ao menu "Upload".
    - Arraste o seu ficheiro para a zona central.
    - **Escolha o Destino**: Selecione "Nexora Cloud" ou "Disco Local".
    - **Manter Original**: Ative se não quiser que o ficheiro de origem seja apagado após a conclusão.
    - Selecione o perfil de encoding.
    - Clique em **"Iniciar Upload"**.
21. **Monitorização**: 
    - No **Dashboard**, acompanhe a carga de CPU, Memória e utilização de GPU em tempo real.
    - No menu **Filas**, veja a barra de progresso real (percentagem) de cada trabalho activo.
22. **Controlo de Qualidade (QC)**: Quando terminar, o ficheiro aparecerá em "Assets" com uma thumbnail. No detalhe, pode consultar o relatório comparativo VMAF/PSNR. Se o asset estiver em quarentena, deve aprová-lo manualmente.
23. **Diagnóstico**: Se algo falhar, consulte o menu **Logs do Sistema** onde o motor de diagnóstico automático indicará o problema e a solução.

---

## 2. Visibilidade e Observabilidade

### Dashboards de Infraestrutura
A plataforma monitoriza continuamente os recursos do servidor:
- **CPU e RAM**: Gráficos de histórico para detectar picos de carga.
- **GPU (NVIDIA)**: Monitorização de temperatura, carga e memória de vídeo para processos de transcodificação acelerada.
- **Armazenamento**: Estado de ocupação das pastas temporárias e de arquivo final. Bloqueio automático se o espaço for inferior a 5%.

### Gestão de Filas e Workers
No menu "Filas", pode ver exactamente o que o sistema está a processar:
- **Progresso Real**: Percentagem baseada no tempo total do vídeo fonte.
- **Worker Status**: Lista de workers ativos e as tarefas específicas que cada um está a realizar.
- **Retry Automático**: Jobs falhados por erros transitórios (ex: timeout de rede) são repetidos automaticamente 3 vezes.

## 3. Perfis de Encoding (HandBrake)

O sistema utiliza o motor HandBrake Professional. Abaixo estão os 11 perfis standard configurados:

| Perfil | Codec | Resolução | Bitrate | Uso Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| **NexoraProxyLowRes** | H.264 | 720p | 800 kbps | Revisão editorial rápida |
| **NexoraWebOptimized1080p** | H.264 | 1080p | 4 Mbps | Distribuição Web Standard |
| **NexoraBroadcast4K** | H.264 | 4K | 25 Mbps | Master para emissão TV |
| **NexoraArchiveMaster** | H.264 High10 | Fonte | 50 Mbps | Arquivo de longo prazo |
| **NexoraHLS1080p** | H.264 | 1080p | 6 Mbps | Streaming Adaptativo HD |
| **NexoraHLS720p** | H.264 | 720p | 3 Mbps | Streaming Adaptativo SD |
| **NexoraHLS480p** | H.264 | 480p | 1.5 Mbps | Streaming Mobile |
| **NexoraSocialMedia** | H.264 | 1080x1080 | 2.5 Mbps | Social Media (1:1) |
| **Nexora4KHDR** | H.265 10-bit | 4K | 20 Mbps | Premium HDR OTT |
| **NexoraHEVCEfficient1080p** | H.265 | 1080p | 2.5 Mbps | Eficiência de Storage |
| **NexoraQuickPreview** | H.264 Baseline | 360p | 500 kbps | Instant Preview |

---

## 4. Resolução de Problemas (Troubleshooting)

### Motor de Diagnóstico Automático
O Nexora agora inclui um motor que analisa os logs e propõe soluções:
- **Erro de GPU**: Se o encoder NVENC falhar por falta de recursos, o sistema sugere o fallback para CPU ou limpeza de processos fantasmas.
- **Espaço em Disco**: Alerta proativo e sugestão de limpeza de logs/assets antigos.
- **Conformidade QC**: Explica porque razão um ficheiro foi rejeitado (ex: "Bitrate abaixo do target").

### Cenários Práticos (HOW-TO)
1.  **Diagnóstico de Erros**: Se um job falhar, aceda a 'Logs'. Procure entradas a vermelho. O motor de diagnóstico injetará um botão de 'Ver Solução' se o erro for conhecido.
2.  **Aprovação de Quarentena**: Se um asset ficar em 'QUARANTINED', clique no detalhe e analise o score VMAF. Se o vídeo parecer bom apesar do score baixo, use o botão 'Aprovação Manual'.
3.  **Aceleração GPU**: Nos perfis, ative 'NVENC' para usar a GPU e reduzir o tempo de encode. Se a GPU falhar, o worker faz fallback automático para CPU.
4.  **Gestão de RBAC**: Administradores podem atribuir roles 'VIEWER', 'OPERATOR' ou 'ADMIN' no menu de Utilizadores.

---

## 5. Manutenção Via CLI & Scripts

Para administradores de sistema, as ferramentas CLI são essenciais para manter a estabilidade.

### Nexora CLI (`nexora.ps1`)
| Comando | Descrição |
| :--- | :--- |
| `.\nexora.ps1 status` | Verifica se o Backend, Frontend e Workers estão a correr. |
| `.\nexora.ps1 stop` | Pára todos os processos e limpa PIDs. |
| `.\nexora.ps1 start` | Inicia toda a infraestrutura e serviços. |
| `.\nexora.ps1 logs` | Stream centralizado de logs de todos os componentes. |
| `.\nexora.ps1 restart` | Reinicia todos os serviços rapidamente. |
| `.\nexora.ps1 reset` | **CUIDADO**: Limpa base de dados, volumes docker e ambiente. |

### Outros Scripts Úteis
- **executa_10_passos.ps1**: Workflow completo de instalação e setup automatizado.
- **nexora-mover-tudo.ps1**: Utilitário de organização de diretórios e migração de ficheiros.
- **scripts/sync-presets.ts**: Sincronização de presets HandBrake com a base de dados via `npm run presets:sync`.
- **scripts/flush-queues.ts**: Comando de emergência para limpar filas BullMQ (Redis) via `npm run queue:flush`.

---

## 6. FAQ (Perguntas Frequentes)

**P: Qual o tamanho máximo de ficheiro suportado?**
R: Por defeito, o sistema suporta até 50GB por ficheiro, dependendo do espaço livre no bucket MinIO.

**P: Posso criar novos perfis de encoding?**
R: Sim, no menu "Perfis de Encoding", clique em "Novo Perfil".

**P: Onde ficam os ficheiros originais?**
R: São guardados de forma segura no bucket `nexora-input` dentro do MinIO.
