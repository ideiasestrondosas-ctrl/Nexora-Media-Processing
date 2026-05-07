# Manual de Menus e Funcionalidades — Nexora Media Processing

Este documento detalha cada secção da aplicação Nexora, explicando as suas funcionalidades e a lógica de negócio associada.

---

## 1. Dashboard
O ecrã principal fornece uma visão panorâmica e em tempo real do estado do sistema.

- **Métricas de Infraestrutura**:
    - **CPU e RAM**: Gráficos de histórico e indicadores de carga actual.
    - **GPU NVIDIA**: Monitorização de temperatura, carga e memória de vídeo.
    - **Ocupação de Disco**: Estado dos volumes temporários (`/media/temp`) e de arquivo.
- **Jobs em Execução**: Contador em tempo real de tarefas activas no pipeline.
- **Gráficos de Tendência**:
    - **Evolução de Qualidade**: Gráfico de área mostrando a qualidade VMAF e PSNR ao longo do tempo.
    - **Histórico de Carga**: Gráfico comparativo do uso de recursos de hardware.

## 2. Assets (Biblioteca de Media)
Onde residem todos os ficheiros ingeridos no sistema.

- **Asset Cards**: Apresentam uma **Thumbnail** (pré-visualização) do vídeo, o nome do perfil utilizado e o tamanho formatado.
- **Estados de um Asset**:
    - `INGESTING`: O ficheiro está a ser carregado ou analisado.
    - `QC_RUNNING`: Verificação automática de conformidade (Controlo de Qualidade).
    - `TRANSCODING`: O ficheiro está em transcodificação de vídeo.
    - `AUDIO_PROCESSING`: Normalização de loudness EBU R128 em curso.
    - `COMPLETED`: Processamento concluído com sucesso.
    - `FAILED`: Ocorreu um erro (ver detalhes no log do job).
- **Ações e Detalhe**: 
    - Reprodução de vídeo com poster (thumbnail).
    - Metadados técnicos formatados (Resolução, Framerate decimal, Duração HH:MM:SS).
    - Download directo do ficheiro original/processado.

## 3. Upload (Ingest de Media)
A porta de entrada para novos conteúdos.

- **Zona de Arraste (Dropzone)**: Permite arrastar ficheiros de vídeo (MP4, MOV, MXF, etc.) até 50GB.
- **Opções de Armazenamento**:
    - **Nexora Cloud (MinIO)**: Armazenamento em object-storage, ideal para infraestruturas distribuídas.
    - **Disco Local**: Permite guardar o ficheiro diretamente numa pasta física do servidor.
- **Manter Original**: Interruptor para decidir se o ficheiro fonte deve ser preservado após a transcodificação.
- **Seleção de Perfil**: Antes de iniciar o upload, o utilizador deve escolher o perfil de destino (ex: Broadcast HD, Web SD).
- **Barra de Progresso**: Feedback em tempo real do envio do ficheiro para o destino selecionado.

## 4. Filas (Queue)
Monitorização técnica da infraestrutura de processamento (BullMQ).

- **Estado das Filas**: Monitorização das filas `INGEST`, `QC`, `TRANSCODE`, `AUDIO`, `PROXY`, `SUBTITLE` e `DELIVERY`.
- **Barra de Progresso Real**: Mostra a percentagem exacta de cada trabalho em execução, extraída directamente dos workers em tempo real via metadados FFmpeg.
- **Worker Status**: Lista de workers activos e a sua carga de trabalho actual, permitindo identificar gargalos de processamento.
- **Retry & Recovery**: Opções para forçar o reinício de jobs pendentes ou bloqueados.

## 5. Perfis de Encoding (HandBrake Professional)
Gestão das definições técnicas de saída com motor HandBrake.

- **Interface Master-Detail**: Nova visualização que separa a lista de perfis do formulário de edição detalhado.
- **Catálogo de 11 Perfis**: Presets optimizados para Web (H.264), Broadcast (4K), Arquivo (High10) e Social Media (1:1).
- **HandBrake Presets Professional**: Integração nativa com presets JSON do HandBrake.
- **Aceleração de Hardware**: Opções para ativar NVENC (NVIDIA) em todos os perfis compatíveis.

## 6. Logs do Sistema e Diagnóstico
Observabilidade profunda e inteligência operacional.

- **Central de Logs**: Agregação de logs do Backend, Frontend e Workers.
- **Motor de Diagnóstico Automático**: 
    - Analisa falhas comuns (falta de espaço, erro de GPU, time-out de rede).
    - Proporciona sugestões de correção diretamente na interface (botão "Ver Solução").
    - Monitoriza a saúde térmica da GPU e utilização de recursos críticos.

## 7. Scripts & CLI (Administração)
Ferramentas de linha de comando para gestão de infraestrutura.

- **Nexora CLI (`nexora.ps1`)**: O comando mestre para `start`, `stop`, `restart`, `status`, `logs` e `reset`.
- **Instalação em 10 Passos**: Script automatizado para deploy rápido em novos servidores.
- **Sincronização de Presets**: Script TS para injectar novos perfis JSON na base de dados de produção.
- **Limpeza de Filas**: Utilitário para limpar o Redis (BullMQ) em situações de emergência.

## 8. Utilizadores
Controlo de acesso e segurança da plataforma.

- **Gestão de Contas**: Listagem de todos os utilizadores com acesso ao sistema.
- **Níveis de Acesso (Roles)**:
    - `VIEWER`: Apenas leitura de assets e dashboards.
    - `OPERATOR`: Permissão para upload e gestão de filas.
    - `ADMIN`: Controlo total, incluindo gestão de utilizadores e configurações globais.
- **Configurações Globais**: Definição de caminhos de armazenamento físico e políticas de retenção.
