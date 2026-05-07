"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  ChevronRight,
  Film,
  UploadCloud,
  Settings,
  LayoutDashboard,
  Shield,
  HelpCircle,
  AlertCircle,
  Database,
  CheckCircle2,
  PlayCircle,
  Terminal,
  Zap,
  ListVideo,
  Activity,
  MousePointer2,
  Code,
  Cpu,
  Layers,
  HardDrive,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { api } from "@/lib/api";

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
    title: "Dashboard & Análise",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          O <strong>Dashboard</strong> é o centro de comando do Nexora. Monitoriza a saúde
          técnica e a qualidade da produção em tempo real.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Qualidade (VMAF/PSNR)</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">VMAF</strong> — Mede a percepção visual humana. Valores acima de 90 indicam qualidade excelente para broadcast.</span>
              </li>
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">PSNR</strong> — Métrica matemática de fidelidade de pixéis para detecção de erros técnicos de compressão.</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">Infraestrutura</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">GPU</strong> — Aceleração NVIDIA (NVENC) para conversão rápida com fallback automático para CPU.</span>
              </li>
              <li className="flex gap-2">
                <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Uptime</strong> — Tempo de operação contínua sem falhas do sistema.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
          💡 As métricas de <strong>CPU, RAM e Disco</strong> são actualizadas a cada 5 segundos via Prometheus. Um disco abaixo de 5% de espaço livre bloqueia novos trabalhos automaticamente.
        </div>
      </div>
    ),
  },
  {
    id: "assets",
    icon: Film,
    title: "Assets & Workflow",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          Cada asset passa por um ciclo de vida rigoroso de 3 fases automáticas:
          <strong> Ingest → QC → Delivery</strong>.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-background border rounded-lg text-center">
            <div className="bg-blue-500/10 h-7 w-7 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-500 font-bold text-xs">1</div>
            <h5 className="text-xs font-bold mb-1">Ingest</h5>
            <p className="text-xs text-muted-foreground">Análise de metadados e Checksum SHA-256.</p>
          </div>
          <div className="p-3 bg-background border rounded-lg text-center">
            <div className="bg-yellow-500/10 h-7 w-7 rounded-full flex items-center justify-center mx-auto mb-2 text-yellow-500 font-bold text-xs">2</div>
            <h5 className="text-xs font-bold mb-1">QC</h5>
            <p className="text-xs text-muted-foreground">Verificação de áudio (EBU R128) e normas de vídeo.</p>
          </div>
          <div className="p-3 bg-background border rounded-lg text-center">
            <div className="bg-green-500/10 h-7 w-7 rounded-full flex items-center justify-center mx-auto mb-2 text-green-500 font-bold text-xs">3</div>
            <h5 className="text-xs font-bold mb-1">Delivery</h5>
            <p className="text-xs text-muted-foreground">Transcodificação e disponibilização final.</p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Estados do Asset</h3>
          <div className="space-y-1 text-sm">
            {[
              { state: "PENDING", color: "text-slate-400", desc: "Aguarda processamento" },
              { state: "QC_RUNNING", color: "text-yellow-500", desc: "Análise de qualidade em curso" },
              { state: "QC_QUARANTINED", color: "text-orange-500", desc: "Problema detectado — aguarda revisão (48h)" },
              { state: "QC_REJECTED", color: "text-red-500", desc: "Rejeitado — não conformante com normas" },
              { state: "TRANSCODING", color: "text-blue-500", desc: "Conversão em curso (GPU ou CPU)" },
              { state: "COMPLETED", color: "text-green-500", desc: "Pipeline concluído com sucesso" },
              { state: "FAILED", color: "text-red-600", desc: "Falha não recuperável — ver logs" },
            ].map(({ state, color, desc }) => (
              <div key={state} className="flex items-center gap-3">
                <span className={cn("font-mono text-xs font-bold w-36 shrink-0", color)}>{state}</span>
                <span className="text-muted-foreground text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/20 p-3 rounded-lg flex gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-orange-500">Quarentena:</strong> Se um asset estiver em <code className="bg-muted px-1 rounded">QC_QUARANTINED</code>, foi detectado um problema técnico. Reveja o relatório no detalhe do asset e aprove ou rejeite manualmente.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "upload",
    icon: UploadCloud,
    title: "Upload & Armazenamento",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          Pode escolher entre armazenamento em <strong>Nuvem (MinIO)</strong> para
          redundância distribuída ou <strong>Disco Local</strong> para máxima velocidade de acesso.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 border rounded-xl bg-card">
            <div className="flex items-center gap-2 mb-2 text-blue-500">
              <Shield className="h-4 w-4" />
              <h4 className="text-sm font-bold">Nexora Cloud (MinIO)</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Ideal para ambientes S3 distribuídos com alta redundância e acesso remoto.</p>
            <div className="text-xs text-blue-500/70 font-mono">s3://nexora-assets/</div>
          </div>
          <div className="p-4 border rounded-xl bg-card">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <Database className="h-4 w-4" />
              <h4 className="text-sm font-bold">Disco Local</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Máxima velocidade e baixa latência. Ideal para workstations dedicadas.</p>
            <div className="text-xs text-slate-400 font-mono">C:\NexoraStorage\assets\</div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Formatos Suportados</h3>
          <div className="flex flex-wrap gap-2">
            {["MP4", "MOV", "MKV", "AVI", "MPEG-TS", "MXF", "WAV", "AIFF", "MP3", "AAC"].map(fmt => (
              <span key={fmt} className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{fmt}</span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Retenção de Dados</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Manter Original</strong> — Define se o ficheiro bruto é apagado após o transcode (configúravel por upload).</span>
            </li>
            <li className="flex gap-2">
              <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span><strong className="text-foreground">Validação Magic Bytes</strong> — O sistema verifica a assinatura binária do ficheiro antes de aceitar (10 formatos reconhecidos).</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "profiles",
    icon: Settings,
    title: "Perfis & HandBrake",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O Nexora utiliza o motor <strong>HandBrake</strong>. Abaixo estão os 11 perfis configurados.
        </p>

        <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {[
            { name: "NexoraProxyLowRes", codec: "H.264", res: "720p", br: "800k", usage: "Preview" },
            { name: "NexoraWebOptimized1080p", codec: "H.264", res: "1080p", br: "4M", usage: "Web" },
            { name: "NexoraBroadcast4K", codec: "H.264", res: "4K", br: "25M", usage: "TV" },
            { name: "NexoraArchiveMaster", codec: "H.264 10b", res: "Src", br: "50M", usage: "Arch" },
            { name: "NexoraHLS1080p", codec: "H.264", res: "1080p", br: "6M", usage: "HLS" },
            { name: "NexoraSocialMedia", codec: "H.264", res: "1:1", br: "2.5M", usage: "Social" },
            { name: "Nexora4KHDR", codec: "H.265", res: "4K", br: "20M", usage: "HDR" },
          ].map((p) => (
            <div key={p.name} className="flex items-center gap-3 p-2 rounded border bg-muted/30 text-[11px]">
              <div className="w-32 shrink-0 font-bold text-primary truncate">{p.name}</div>
              <div className="flex-1 flex gap-2 text-muted-foreground">
                <span>{p.codec}</span>
                <span>{p.res}</span>
              </div>
              <div className="text-primary font-mono">{p.br}</div>
            </div>
          ))}
          <p className="text-[10px] text-center text-muted-foreground italic">E mais 4 perfis especializados de HLS e HEVC...</p>
        </div>
      </div>
    ),
  },
  {
    id: "scripts",
    icon: Code,
    title: "Scripts & CLI",
    content: (
      <div className="space-y-4">
        <div className="p-3 bg-slate-950 text-emerald-400 rounded-lg font-mono text-[10px] border border-white/10">
          <p className="text-slate-500 mb-1"># Comandos Principais:</p>
          <p><span className="text-white">.\nexora.ps1 start</span>   - Sobe sistema</p>
          <p><span className="text-white">.\nexora.ps1 status</span>  - Dashboard CLI</p>
          <p><span className="text-white">.\nexora.ps1 logs</span>    - Logs em real-time</p>
          <p className="text-red-400 mt-2">.\nexora.ps1 reset   - Limpa TUDO</p>
        </div>
        <div className="grid gap-2">
          <div className="p-2 border rounded bg-muted/20">
            <span className="text-[11px] font-bold block">executa_10_passos.ps1</span>
            <p className="text-[10px] text-muted-foreground">Script mestre de instalação e setup inicial.</p>
          </div>
          <div className="p-2 border rounded bg-muted/20">
            <span className="text-[11px] font-bold block">scripts/sync-presets.ts</span>
            <p className="text-[10px] text-muted-foreground">Sincroniza presets JSON com a base de dados.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "queue",
    icon: ListVideo,
    title: "Filas (Queue)",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          Monitorização técnica do pipeline de processamento assíncrono (BullMQ).
        </p>
        <div className="space-y-3">
          <div className="p-3 border rounded-lg bg-muted/10">
            <h4 className="text-xs font-bold uppercase mb-2">Progresso Real</h4>
            <p className="text-xs text-muted-foreground">O sistema reporta a percentagem exata de transcode extraída dos metadados do FFmpeg em tempo real.</p>
          </div>
          <div className="p-3 border rounded-lg bg-muted/10">
            <h4 className="text-xs font-bold uppercase mb-2">Gestão de Workers</h4>
            <p className="text-xs text-muted-foreground">Visualize quais workers estão ocupados e a carga individual de cada processo.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "diagnostics",
    icon: Terminal,
    title: "Logs & Diagnóstico",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          O motor de diagnóstico analisa falhas de hardware e software automaticamente.
        </p>
        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl space-y-3">
          <h4 className="text-sm font-bold text-purple-600 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Diagnóstico Inteligente
          </h4>
          <ul className="text-xs space-y-2 text-muted-foreground">
            <li>• <strong>Detecção de NVENC:</strong> Verifica se a GPU está disponível antes de falhar o job.</li>
            <li>• <strong>Proposta de Soluções:</strong> Botões de ação rápida nos logs para corrigir erros comuns.</li>
            <li>• <strong>Monitorização de Temp:</strong> Alerta se a GPU exceder os 85ºC.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "howto",
    icon: HelpCircle,
    title: "Guias Práticos",
    content: (
      <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase text-blue-500 flex items-center gap-2">
            <UploadCloud className="h-3 w-3" /> Ingestão
          </h4>
          <p className="text-[11px] text-muted-foreground">Upload em Assets → Escolher Perfil → Escolher Destino → Monitorizar em Filas.</p>
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="text-xs font-bold uppercase text-purple-500 flex items-center gap-2">
            <Activity className="h-3 w-3" /> Diagnóstico
          </h4>
          <p className="text-[11px] text-muted-foreground">Se falhar, ver Logs. Clique no ícone de diagnóstico para ver a sugestão de correção automática.</p>
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="text-xs font-bold uppercase text-emerald-500 flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" /> Quarentena
          </h4>
          <p className="text-[11px] text-muted-foreground">Se o VMAF for baixo, o asset fica em Quarentena. Analise o relatório e use 'Aprovação Manual' se estiver satisfeito.</p>
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="text-xs font-bold uppercase text-orange-500 flex items-center gap-2">
            <RotateCcw className="h-3 w-3" /> Manutenção
          </h4>
          <p className="text-[11px] text-muted-foreground">Use <code className="bg-muted px-1">.\nexora.ps1 reset</code> para limpar o ambiente ou <code className="bg-muted px-1">npm run queue:flush</code> para limpar filas presas.</p>
        </div>
      </div>
    ),
  },
  {
    id: "audio-subtitles",
    icon: Zap,
    title: "Áudio & Legendas",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          Funcionalidades avançadas para conformidade de áudio e acessibilidade.
        </p>
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Normalização EBU R128</h3>
          <p className="text-sm text-muted-foreground">
            O Nexora utiliza o <strong>bs1770gain</strong> para garantir que todos os assets cumprem a norma EBU R128 (-23 LUFS).
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>Target:</strong> -23.0 LUFS</span></li>
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>True Peak:</strong> -1.0 dBTP</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Processamento de Legendas</h3>
          <p className="text-sm text-muted-foreground">
            Suporte para conversão e conformação de ficheiros de legenda nos formatos standard da indústria.
          </p>
          <div className="flex flex-wrap gap-2">
            {["SRT", "WebVTT", "TTML (SMPTE-TT)"].map(fmt => (
              <span key={fmt} className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{fmt}</span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "security",
    icon: Shield,
    title: "Segurança & Admin",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          O Nexora utiliza <strong>RBAC</strong> (Role-Based Access Control) para garantir que
          apenas utilizadores autorizados acedem a funções críticas.
        </p>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Modelo de Segurança</h3>
          <div className="space-y-2 text-sm">
            {[
              { feature: "JWT RS256 4096-bit", desc: "Access token 15min + Refresh token 7 dias" },
              { feature: "Rotação de Tokens", desc: "Detecção de replay attack — revoga todos os tokens" },
              { feature: "Rate Limiting", desc: "Redis-backed, por utilizador autenticado (100 req/min)" },
              { feature: "Validação de Upload", desc: "Magic bytes (10 formatos) + MIME + tamanho máximo" },
              { feature: "Path Traversal Guard", desc: "Bloqueia ../, null bytes, e encoding URI malicioso" },
              { feature: "SSRF Protection", desc: "Bloqueia RFC 1918, loopback, e cloud metadata (169.254.169.254)" },
              { feature: "Audit Trail", desc: "Append-only PostgreSQL com RLS — UPDATE/DELETE bloqueados" },
            ].map(({ feature, desc }) => (
              <div key={feature} className="flex gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground text-xs">{feature}</span>
                  <span className="text-muted-foreground text-xs"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Roles de Utilizador</h3>
          <div className="space-y-1 text-sm">
            <div className="flex gap-3 items-center">
              <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold">ADMIN</span>
              <span className="text-muted-foreground text-xs">Acesso total — configurações, reset, backup, gestão de utilizadores</span>
            </div>
            <div className="flex gap-3 items-center">
              <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold">OPERATOR</span>
              <span className="text-muted-foreground text-xs">Upload, processamento e monitorização — sem configurações críticas</span>
            </div>
            <div className="flex gap-3 items-center">
              <span className="bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">VIEWER</span>
              <span className="text-muted-foreground text-xs">Leitura apenas — dashboard, assets e logs</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function UserManualPopup() {
  const [activeId, setActiveId] = useState("dashboard");
  const [version, setVersion] = useState<string>("1.1.0");
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0]!;

  useEffect(() => {
    // Usar o endpoint com o helper da API configurado (base URL correto)
    const fetchVersion = async () => {
      try {
        const data = await api.get<{ version: string }>("/system/version");
        if (data?.version) setVersion(data.version);
      } catch (err) {
        console.warn("Falha ao obter versão para o manual:", err);
      }
    };
    fetchVersion();
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-blue-400 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden md:inline">Manual</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[75vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-md border-border">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Manual de Utilizador Nexora
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar de navegação */}
          <aside className="w-44 border-r bg-muted/20 flex flex-col shrink-0">
            <nav className="flex-1 py-2 overflow-y-auto">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 text-xs transition-colors text-left",
                      isActive
                        ? "bg-primary/10 text-primary border-r-2 border-primary font-bold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.title}</span>
                  </button>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t bg-muted/30">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed font-medium">
                Nexora Media Processing<br />
                <span className="text-primary/70 font-bold">V{version}</span> — Broadcast & OTT
              </p>
            </div>
          </aside>

          {/* Área de conteúdo */}
          <div className="flex-1 overflow-y-auto p-5 bg-background/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg">
                <activeSection.icon className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-bold">{activeSection.title}</h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {activeSection.content}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
