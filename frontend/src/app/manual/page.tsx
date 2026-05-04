"use client";

import { useState } from "react";
import { BookOpen, Menu as MenuIcon, ChevronRight, Film, UploadCloud, ListVideo, Settings, Users, LayoutDashboard, Wrench, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = {
  id: string;
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          O <strong>Dashboard</strong> é o ponto de entrada do Nexora e apresenta uma visão geral em tempo real do estado do sistema.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Métricas apresentadas</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Infraestrutura Hardware</strong> — monitorização em tempo real de CPU, RAM e GPU (NVIDIA).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Armazenamento</strong> — ocupação dos volumes de trabalho e arquivo final.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Jobs Activos</strong> — contador de tarefas em execução no pipeline.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Taxa de Sucesso</strong> — percentagem de jobs concluídos com êxito nas últimas 24 horas.</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Gráficos de Histórico</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Carga de Hardware</strong> — evolução do uso de recursos nos últimos minutos.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Qualidade (VMAF/PSNR)</strong> — tendência de qualidade visual dos assets processados.</span></li>
          </ul>
        </div>
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300">
          💡 Os dados são actualizados automaticamente a cada 30 segundos.
        </div>
      </div>
    ),
  },
  {
    id: "assets",
    icon: Film,
    title: "Assets",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          A secção <strong>Assets</strong> é a biblioteca de todos os ficheiros multimédia recebidos pelo sistema.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Estados dos Assets</h3>
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: "PENDING", color: "bg-slate-600", desc: "Ficheiro recebido, aguarda início do processamento." },
              { label: "INGESTING", color: "bg-blue-700", desc: "A analisar metadados e a calcular checksum SHA-256." },
              { label: "QC_RUNNING", color: "bg-yellow-700", desc: "Controlo de Qualidade em execução (bitrate, loudness, normas)." },
              { label: "QC_PASSED", color: "bg-green-700", desc: "Passou no QC, aguarda transcodificação." },
              { label: "QC_QUARANTINED", color: "bg-orange-700", desc: "QC detetou problemas menores; requer revisão manual." },
              { label: "TRANSCODING", color: "bg-blue-600", desc: "Transcodificação de vídeo (aceleração GPU se disponível)." },
              { label: "AUDIO_PROCESSING", color: "bg-purple-600", desc: "Normalização de Loudness EBU R128." },
              { label: "COMPLETED", color: "bg-green-600", desc: "Processamento concluído com sucesso." },
              { label: "FAILED", color: "bg-red-600", desc: "Erro durante o processamento." },
            ].map(s => (
              <div key={s.label} className="flex items-start gap-3">
                <span className={cn("text-xs text-white px-2 py-0.5 rounded font-mono shrink-0 mt-0.5", s.color)}>{s.label}</span>
                <span className="text-sm text-slate-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Filtros disponíveis</h3>
          <p className="text-sm text-slate-400">Pode filtrar por <strong className="text-slate-300">nome do ficheiro</strong> e por <strong className="text-slate-300">estado</strong> para localizar rapidamente um asset específico.</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Funcionalidades Visuais</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Thumbnails</strong> — pré-visualização automática de cada vídeo na biblioteca.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Metadados Formatados</strong> — visualização clara de framerate decimal, duração e tamanho legível.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Download</strong> — acesso directo ao ficheiro original e entregas.</span></li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "upload",
    icon: UploadCloud,
    title: "Upload",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          O <strong>Upload</strong> permite carregar ficheiros de vídeo para o sistema Nexora para processamento.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Formatos suportados</h3>
          <p className="text-sm text-slate-400">MP4, MOV, MXF (ProRes, XDCAM, DNxHD), AVI, MKV, TS — até 50 GB por ficheiro.</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Opções de upload</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Perfil de Encoding</strong> — seleccionar o perfil que define os parâmetros de transcodificação (codec, bitrate, container).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Destino de Armazenamento</strong> — Nexora Cloud (MinIO) para armazenamento distribuído, ou Disco Local para armazenamento no servidor.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Manter Original</strong> — se activo, o ficheiro original é preservado após transcodificação.</span></li>
          </ul>
        </div>
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300">
          💡 Pode arrastar e largar o ficheiro diretamente na zona de upload, ou clicar em "Procurar ficheiro".
        </div>
      </div>
    ),
  },
  {
    id: "queue",
    icon: ListVideo,
    title: "Filas (Queue)",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          As <strong>Filas</strong> apresentam o estado das filas de processamento BullMQ em tempo real.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Monitorização em Tempo Real</h3>
          <p className="text-sm text-slate-400">Pode acompanhar a <strong className="text-slate-300">percentagem de conclusão</strong> de cada job activo directamente nas barras de progresso reais, sincronizadas com os workers.</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Prioridades</h3>
          <p className="text-sm text-slate-400">Os jobs têm prioridade numérica: <code className="bg-slate-800 px-1 rounded">10</code> = Broadcast, <code className="bg-slate-800 px-1 rounded">7</code> = OTT, <code className="bg-slate-800 px-1 rounded">5</code> = Web, <code className="bg-slate-800 px-1 rounded">3</code> = Proxy.</p>
        </div>
      </div>
    ),
  },
  {
    id: "profiles",
    icon: Settings,
    title: "Perfis de Encoding",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Os <strong>Perfis de Encoding</strong> definem os parâmetros técnicos de transcodificação aplicados a cada ficheiro.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Parâmetros configuráveis</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Container</strong> — formato contentor de saída: MP4, MOV, MKV, MXF, TS, AVI.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Codec de Vídeo</strong> — H.264 (compatibilidade máxima), H.265/HEVC (eficiência), ProRes (broadcast), DNxHD (edição), VP9/AV1 (web).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Codec de Áudio</strong> — AAC (web/streaming), AC3/E-AC3 (broadcast), PCM (masterização), FLAC (lossless), Opus (baixo bitrate).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Bitrate de Vídeo</strong> — em Kbps. Broadcast HD: 8000+, Web SD: 1500-3000, Web HD: 4000-6000.</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Compatibilidade container ↔ codec</h3>
          <div className="text-sm text-slate-400 space-y-1">
            <p><code className="bg-slate-800 px-1 rounded">MP4</code> → H.264, H.265, AAC, AC3, MP3</p>
            <p><code className="bg-slate-800 px-1 rounded">MXF</code> → ProRes, DNxHD, PCM (broadcast only)</p>
            <p><code className="bg-slate-800 px-1 rounded">MOV</code> → ProRes, H.264, H.265, PCM, AAC</p>
            <p><code className="bg-slate-800 px-1 rounded">MKV</code> → H.264, H.265, VP9, AV1, AAC, AC3, FLAC, Opus</p>
            <p><code className="bg-slate-800 px-1 rounded">TS</code> → H.264, H.265, AAC, AC3, E-AC3</p>
          </div>
        </div>
        <div className="bg-yellow-950/40 border border-yellow-800/50 rounded-lg p-3 text-sm text-yellow-300">
          ⚠️ Ao criar/editar um perfil, o sistema valida automaticamente a compatibilidade entre o container e os codecs seleccionados antes de gravar.
        </div>
      </div>
    ),
  },
  {
    id: "users",
    icon: Users,
    title: "Utilizadores",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          A secção <strong>Utilizadores</strong> permite gerir as contas de acesso ao sistema Nexora.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Funções (Roles)</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">ADMIN</strong> — acesso total: criar/editar utilizadores, perfis, executar reset do sistema, alterar configurações.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">USER</strong> — acesso padrão: fazer upload, visualizar assets e filas, usar perfis existentes.</span></li>
          </ul>
        </div>
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300">
          💡 Apenas utilizadores com função ADMIN podem aceder às Definições do Sistema e ao botão de Reset.
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    icon: Wrench,
    title: "Definições do Sistema",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          As <strong>Definições do Sistema</strong> permitem gerir a configuração global do Nexora.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Armazenamento</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Estratégia por defeito</strong> — define se os uploads vão para MinIO (cloud) ou para o Disco Local.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Caminho local</strong> — caminho do sistema de ficheiros onde os assets locais são armazenados.</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-red-400" />
            Reset do Sistema
          </h3>
          <p className="text-sm text-slate-400">
            O botão <strong className="text-red-400">Reset Completo</strong> apaga todos os dados da base de dados (assets, jobs, utilizadores, perfis, etc.) e os ficheiros armazenados, repondo o sistema ao estado inicial de instalação. Esta acção é <strong className="text-red-400">irreversível</strong>.
          </p>
          <p className="text-sm text-slate-400">
            Requer confirmação dupla — o utilizador deve escrever <code className="bg-slate-800 px-1 rounded text-red-300">RESET</code> na caixa de confirmação.
          </p>
        </div>
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-sm text-red-300">
          ⚠️ Apenas administradores podem aceder a esta funcionalidade. Use com extremo cuidado em ambientes de produção.
        </div>
      </div>
    ),
  },
  {
    id: "security",
    icon: Shield,
    title: "Segurança",
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          O Nexora implementa várias camadas de segurança para proteger o sistema e os dados.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Autenticação</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">JWT</strong> — autenticação por token com expiração de 1 hora. Refresh token com rotação automática (7 dias).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span><strong className="text-slate-300">Rate Limiting</strong> — protecção contra ataques de força bruta nos endpoints de login.</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Validação de ficheiros</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span>Verificação de tipo MIME real (não apenas extensão).</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span>Checksum SHA-256 para integridade de ficheiros.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" /><span>Protecção SSRF nos uploads (valida URLs de destino).</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Auditoria</h3>
          <p className="text-sm text-slate-400">
            Todas as acções relevantes são registadas no log de auditoria (append-only). Os logs incluem: quem executou a acção, quando, a partir de que IP, e os dados relevantes.
          </p>
        </div>
      </div>
    ),
  },
];

export default function ManualPage() {
  const [activeId, setActiveId] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeSection = sections.find(s => s.id === activeId) ?? sections[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 md:-m-6 lg:-m-8 overflow-hidden">
      {/* Sidebar do manual */}
      <aside className={cn(
        "bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-200",
        sidebarOpen ? "w-60" : "w-14"
      )}>
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Manual</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <MenuIcon className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {sections.map(section => {
            const Icon = section.icon;
            const isActive = section.id === activeId;
            return (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                title={!sidebarOpen ? section.title : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left",
                  isActive
                    ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                  !sidebarOpen && "justify-center px-0"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{section.title}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-blue-600/20 rounded-lg">
              <activeSection.icon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Manual de Utilizador</p>
              <h1 className="text-2xl font-bold text-slate-100">{activeSection.title}</h1>
            </div>
          </div>
          <div className="prose-nexora">
            {activeSection.content}
          </div>
        </div>
      </div>
    </div>
  );
}
