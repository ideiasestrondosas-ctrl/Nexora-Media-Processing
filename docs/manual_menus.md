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
- **Barra de Progresso Real**: Mostra a percentagem exacta de cada trabalho em execução, extraída directamente dos workers em tempo real.
- **Worker Status**: Lista de workers activos e a sua carga de trabalho actual.

## 5. Perfis de Encoding
Gestão das definições técnicas de saída.

- **Criação e Edição**: Definição de container (mp4, mxf), codecs de vídeo (h264, prores), codecs de áudio (aac, pcm) e bitrates.
- **Perfis por Defeito**: Marcação de perfis prioritários que aparecem pré-selecionados no upload.
- **Segurança**: Proteção contra a eliminação de perfis de sistema críticos.

## 6. Utilizadores
Controlo de acesso e segurança da plataforma.

- **Gestão de Contas**: Listagem de todos os utilizadores com acesso ao sistema.
- **Níveis de Acesso (Roles)**:
    - `USER`: Acesso básico a assets e upload.
    - `OPERATOR`: Acesso a monitorização de filas e perfis.
    - `ADMIN`: Controlo total, incluindo gestão de utilizadores e configurações globais.
- **Alteração de Credenciais**: Interface dedicada para o utilizador actual alterar a sua própria password com validação de segurança.
- **Configurações Globais (Apenas Admin)**: Secção para definir o caminho absoluto no servidor onde os assets de "Disco Local" serão armazenados (ex: `C:\NexoraStorage\assets`).
