"use client";

import { useState } from "react";
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
    id: "encoding",
    icon: Settings,
    title: "Perfis de Encoding",
    content: (
      <div className="space-y-5">
        <p className="text-muted-foreground leading-relaxed">
          Os perfis bloqueiam automaticamente combinações incompatíveis para evitar erros fatais durante o transcode.
        </p>

        <div className="space-y-2">
          {[
            { name: "Broadcast HD", fmt: "MXF OP1a + H.264", bitrate: "8 Mbps", uso: "RTP, BBC, AS-11 UK DPP", color: "text-blue-500" },
            { name: "OTT Premium", fmt: "CMAF + H.265", bitrate: "5 Mbps", uso: "Netflix, Amazon, Disney+", color: "text-indigo-500" },
            { name: "Streaming Web", fmt: "MP4 + H.264", bitrate: "2 Mbps", uso: "YouTube, Web Players", color: "text-sky-500" },
            { name: "Proxy", fmt: "MP4 480p", bitrate: "800 kbps", uso: "Revisão editorial rápida", color: "text-slate-400" },
            { name: "Archive", fmt: "MXF + ProRes", bitrate: "Lossless", uso: "Arquivo profissional permanente", color: "text-emerald-500" },
          ].map(p => (
            <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
              <div className={cn("font-bold text-xs w-28 shrink-0", p.color)}>{p.name}</div>
              <div className="text-xs text-muted-foreground flex-1">
                <span className="font-mono">{p.fmt}</span> · {p.bitrate}
              </div>
              <div className="text-xs text-muted-foreground hidden sm:block">{p.uso}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Standards de Qualidade</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>ADR-004</strong> — yuv420p obrigatório em todos os outputs de distribuição</span></li>
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>ADR-005</strong> — Two-pass EBU R128 + BS1770GAIN verificação independente (precisão ±0.1 LU)</span></li>
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>ADR-006</strong> — Closed GOP + IDR frames em todos os outputs broadcast</span></li>
            <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" /><span><strong>ADR-010</strong> — VMAF score calculado e guardado para todos os outputs</span></li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "how-to",
    icon: HelpCircle,
    title: "Guias (HOW-TO)",
    content: (
      <div className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <PlayCircle className="h-4 w-4" /> Processar o seu primeiro vídeo
          </h3>
          <div className="space-y-2 ml-2">
            {[
              "Vá a Assets e clique em \"Fazer Upload\".",
              "Arraste o vídeo para a zona de drop (ou clique para seleccionar).",
              "Escolha a estratégia de armazenamento (MinIO ou Disco Local).",
              "Seleccione um perfil de encoding (ex: \"Streaming Web\").",
              "Acompanhe o progresso no menu \"Filas\" em tempo real.",
              "Quando concluir, o asset aparece em \"Assets\" com status COMPLETED.",
            ].map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Monitorizar Logs do Sistema
          </h3>
          <div className="space-y-2 ml-2 text-sm text-muted-foreground">
            <p>1. Navegue para <strong>Logs do Sistema</strong> na sidebar.</p>
            <p>2. Use os filtros de severidade: <code className="bg-muted px-1 rounded">ERROR</code>, <code className="bg-muted px-1 rounded">WARN</code>, <code className="bg-muted px-1 rounded">INFO</code>.</p>
            <p>3. O motor de diagnóstico detecta padrões automaticamente e sugere correcções.</p>
            <p>4. Clique em qualquer entrada de log para ver o contexto completo.</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <Zap className="h-4 w-4" /> Configurar Backup Automático
          </h3>
          <div className="space-y-2 ml-2 text-sm text-muted-foreground">
            <p>1. Aceda a <strong>Definições</strong> → secção Sistema.</p>
            <p>2. Clique em <strong>"Fazer Backup Agora"</strong> para criar um snapshot.</p>
            <p>3. Os backups são rotacionados automaticamente (máx. 10 ficheiros / 30 dias).</p>
            <p>4. Para restaurar, use <strong>"Restaurar Configurações"</strong> e seleccione um ficheiro JSON.</p>
          </div>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-lg space-y-1">
          <h4 className="text-xs font-bold text-red-500 flex items-center gap-2">
            <AlertCircle className="h-3 w-3" /> Resolução de Falhas
          </h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• <strong>Jobs não iniciam</strong> → Verifique o espaço em disco no Dashboard (mínimo 5% livre).</li>
            <li>• <strong>QC_QUARANTINED</strong> → Verifique o relatório MediaConch no detalhe do asset.</li>
            <li>• <strong>GPU NVENC falha</strong> → O sistema faz fallback automático para CPU (libx264).</li>
            <li>• <strong>Loudness desviado</strong> → O two-pass EBU R128 retenta automaticamente com offset ±0.5 LU.</li>
          </ul>
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
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0]!;

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
            <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">v1.0.0</span>
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
            <div className="px-4 py-3 border-t">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Nexora Media Processing<br />
                Plataforma Broadcast & OTT
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
