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
20. **Monitorização**: 
    - No **Dashboard**, acompanhe a carga de CPU, Memória e utilização de GPU em tempo real.
    - No menu **Filas**, veja a barra de progresso real (percentagem) de cada trabalho activo.
    - Quando terminar, o ficheiro aparecerá no menu **"Assets"** com uma **Thumbnail** (pré-visualização) gerada automaticamente.
21. **Download/Verificação**: No detalhe do Asset, pode ver metadados técnicos formatados (Resolução, Framerate, Duração), reproduzir o vídeo com a Thumbnail como poster inicial, e descarregar o ficheiro original.
22. **Áudio**: O sistema agora realiza normalização de áudio (EBU R128) automática se configurado no perfil.

---

## 2. Visibilidade e Observabilidade

### Dashboards de Infraestrutura
A plataforma monitoriza continuamente os recursos do servidor:
- **CPU e RAM**: Gráficos de histórico para detectar picos de carga.
- **GPU (NVIDIA)**: Monitorização de temperatura, carga e memória de vídeo para processos de transcodificação acelerada.
- **Armazenamento**: Estado de ocupação das pastas temporárias e de arquivo final.

### Gestão de Filas
No menu "Filas", pode ver exactamente o que o sistema está a processar:
- **Barra de Progresso**: Percentagem exacta baseada no tempo de transcodificação.
- **Status Sincronizado**: Visibilidade imediata entre o que está no Redis (BullMQ) e na base de dados (PostgreSQL).

---

## 2. Resolução de Problemas (Troubleshooting)

### Erro: "Falha no upload" ou "401 Unauthorized"
- **Causa**: O token de autenticação expirou ou a sessão foi perdida.
- **Solução**: Saia da aplicação (Logout) e volte a entrar. Certifique-se de que o backend está a correr.

### Erro: "Caminho de armazenamento inválido" ou "Permissão Negada"
- **Causa**: O caminho configurado pelo administrador não existe ou o processo do backend não tem permissões de escrita.
- **Solução (Admin)**: Verifique se o caminho em "Utilizadores" é absoluto (ex: `C:\Nexora\Assets`) e se a pasta tem permissões totais para o utilizador que corre o Node.js.

### Erro: "Ficheiro original desapareceu"
- **Causa**: A opção "Manter Original" estava desligada durante o upload.
- **Solução**: Ative sempre o toggle "Manter ficheiro original" se precisar de manter o Master no disco local ou MinIO.

### O sistema parece bloqueado ou lento
- **Causa**: Jobs pesados podem estar a saturar a fila.
- **Solução**: Verifique o menu "Filas (Queue)". Se houver muitos jobs falhados, pode ser necessário limpar a fila usando a CLI.

---

## 3. Manutenção Via CLI (PowerShell)

Para administradores de sistema, a ferramenta `nexora.ps1` é essencial:

| Comando | Descrição |
| :--- | :--- |
| `.\nexora.ps1 status` | Verifica se o Backend, Frontend e Workers estão a correr. |
| `.\nexora.ps1 stop` | Pára todos os processos de desenvolvimento. |
| `.\nexora.ps1 start` | Inicia toda a infraestrutura e serviços. |
| `.\nexora.ps1 logs backend` | Visualiza erros em tempo real do servidor API. |
| `.\nexora.ps1 clean-db` | **Cuidado**: Limpa a base de dados (apaga todos os assets). |

---

## 4. FAQ (Perguntas Frequentes)

**P: Qual o tamanho máximo de ficheiro suportado?**
R: Por defeito, o sistema suporta até 50GB por ficheiro, dependendo do espaço livre no bucket MinIO.

**P: Posso criar novos perfis de encoding?**
R: Sim, no menu "Perfis de Encoding", clique em "Novo Perfil". Certifique-se de usar codecs compatíveis (h264, aac, etc.).

**P: Onde ficam os ficheiros originais?**
R: São guardados de forma segura no bucket `nexora-input` dentro do MinIO, organizados por ID de asset.
