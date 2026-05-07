"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  ChevronRight, 
  Film, 
  UploadCloud, 
  Settings, 
  LayoutDashboard, 
  Shield, 
  HelpCircle, 
  CheckCircle2, 
  PlayCircle, 
  AlertCircle,
  ListVideo,
  Terminal,
  MousePointer2,
  Code,
  Cpu,
  Layers,
  HardDrive,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ManualPage() {
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    api.get<{ version: string }>("/system/version")
      .then((data) => {
        if (data?.version) setVersion(data.version);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Cabeçalho Standard */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manual de Utilizador</h1>
            <p className="text-muted-foreground text-sm">Guia técnico e pedagógico da plataforma Nexora — v{version}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Dashboard */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-blue-500" />
              Dashboard & Análise
            </CardTitle>
            <CardDescription>Monitorização de saúde técnica e qualidade de produção em tempo real.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Dashboard é o centro de comando do Nexora. Aqui são monitorizadas as métricas críticas que garantem a integridade do sistema.
            </p>
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-500 uppercase">Qualidade (VMAF/PSNR)</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                    <span><strong className="text-foreground">VMAF:</strong> Mede a percepção visual humana. Acima de 90 é excelente.</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                    <span><strong className="text-foreground">PSNR:</strong> Fidelidade matemática dos pixéis. Detecta erros técnicos de compressão.</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-blue-500 uppercase">Infraestrutura</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                    <span><strong className="text-foreground">GPU:</strong> Aceleração NVIDIA para conversão rápida.</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                    <span><strong className="text-foreground">Uptime:</strong> Tempo de operação contínua sem falhas.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets & MediaInfo */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-indigo-500" />
              Biblioteca de Assets & Análise Técnica
            </CardTitle>
            <CardDescription>Gestão e análise profunda de metadados com MediaInfo.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">
              Cada ficheiro carregado é submetido a uma **Análise Técnica Avançada**. O Nexora integra o motor **MediaInfo Deep**, permitindo extrair:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-muted/10">
                <h5 className="text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Search className="h-3 w-3 text-indigo-500" /> Metadados de Imagem
                </h5>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Tipo de Scan (Progressive / Interlaced)</li>
                  <li>• Estrutura de GOP (Open/Closed) e GOP Size</li>
                  <li>• Formato HDR (HDR10, HLG, Dolby Vision)</li>
                  <li>• Color Space e Colour Primaries</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg bg-muted/10">
                <h5 className="text-xs font-bold uppercase mb-2 flex items-center gap-2">
                  <Activity className="h-3 w-3 text-indigo-500" /> Integridade do Ficheiro
                </h5>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Checksum SHA-256 automático no Ingest</li>
                  <li>• Validação de conformidade de Container</li>
                  <li>• Deteção de Bit Depth (8-bit, 10-bit)</li>
                  <li>• Verificação de Streamability (Fast Start)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Control (QC) */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-yellow-500" />
              Controlo de Qualidade (QC) Comparativo
            </CardTitle>
            <CardDescription>Verificação rigorosa pré e pós-transcodificação.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              O workflow de QC do Nexora agora inclui **QC Pós-Encode Comparativo**, garantindo que o ficheiro de saída mantém a fidelidade em relação ao original.
            </p>
            <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl">
              <h5 className="text-sm font-bold mb-2">Métricas de Comparação:</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-2 bg-background border rounded">
                  <span className="font-bold block">Bitrate Ratio:</span>
                  Eficiência da compressão.
                </div>
                <div className="p-2 bg-background border rounded">
                  <span className="font-bold block">Duration Delta:</span>
                  Sincronismo de frames.
                </div>
                <div className="p-2 bg-background border rounded">
                  <span className="font-bold block">Audio Normalization:</span>
                  Conformidade EBU R128.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload & Storage */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-sky-500" />
              Upload & Armazenamento
            </CardTitle>
            <CardDescription>Estratégias de retenção e arquivo de ficheiros.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-xl bg-card">
                <div className="flex items-center gap-2 mb-2 text-blue-500">
                  <Shield className="h-4 w-4" />
                  <h4 className="text-sm font-bold">Nexora Cloud (MinIO)</h4>
                </div>
                <p className="text-xs text-muted-foreground">Ideal para ambientes S3 distribuídos com alta redundância.</p>
              </div>
              <div className="p-4 border rounded-xl bg-card">
                <div className="flex items-center gap-2 mb-2 text-slate-500">
                  <Database className="h-4 w-4" />
                  <h4 className="text-sm font-bold">Disco Local</h4>
                </div>
                <p className="text-xs text-muted-foreground">Máxima velocidade e baixa latência de processamento local.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encoding & HandBrake Professional */}
        <Card className="shadow-sm border-primary/10 overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Perfis de Encoding (HandBrake Professional)</CardTitle>
                <CardDescription>Catálogo completo de presets técnicos e validação Master-Detail.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                O Nexora utiliza o motor <strong>HandBrake</strong> para garantir a máxima fidelidade. 
                Abaixo estão detalhados todos os 11 perfis configurados no sistema.
              </p>

              <div className="grid gap-3">
                {[
                  { name: "NexoraProxyLowRes", codec: "H.264", res: "1280x720", br: "800 kbps", hw: "Sim (NVENC)", usage: "Revisão editorial rápida" },
                  { name: "NexoraWebOptimized1080p", codec: "H.264", res: "1920x1080", br: "4 Mbps", hw: "Sim", usage: "Distribuição Web Standard" },
                  { name: "NexoraBroadcast4K", codec: "H.264", res: "3840x2160", br: "25 Mbps", hw: "Não", usage: "Master para emissão 4K" },
                  { name: "NexoraArchiveMaster", codec: "H.264 High10", res: "Fonte", br: "50 Mbps", hw: "Não", usage: "Arquivo de longo prazo" },
                  { name: "NexoraHLS1080p", codec: "H.264", res: "1920x1080", br: "6 Mbps", hw: "Sim", usage: "Streaming Adaptativo HD" },
                  { name: "NexoraHLS720p", codec: "H.264", res: "1280x720", br: "3 Mbps", hw: "Sim", usage: "Streaming Adaptativo SD" },
                  { name: "NexoraHLS480p", codec: "H.264", res: "854x480", br: "1.5 Mbps", hw: "Sim", usage: "Streaming Mobile" },
                  { name: "NexoraSocialMedia", codec: "H.264", res: "1080x1080", br: "2.5 Mbps", hw: "Sim", usage: "Social Media (1:1)" },
                  { name: "Nexora4KHDR", codec: "H.265 10-bit", res: "3840x2160", br: "20 Mbps", hw: "Sim", usage: "Premium HDR OTT" },
                  { name: "NexoraHEVCEfficient1080p", codec: "H.265", res: "1920x1080", br: "2.5 Mbps", hw: "Sim", usage: "Eficiência Máxima" },
                  { name: "NexoraQuickPreview", codec: "H.264 Baseline", res: "640x360", br: "500 kbps", hw: "Sim", usage: "Instant Preview" },
                ].map((p) => (
                  <div key={p.name} className="flex flex-col md:flex-row md:items-center gap-4 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="md:w-56 shrink-0">
                      <span className="font-bold text-primary text-xs">{p.name}</span>
                      <p className="text-[10px] text-muted-foreground uppercase font-mono mt-0.5">{p.usage}</p>
                    </div>
                    <div className="grid grid-cols-3 flex-1 gap-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-[9px] uppercase">Codec</span>
                        <span className="font-semibold">{p.codec}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-[9px] uppercase">Res.</span>
                        <span className="font-semibold">{p.res}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground/60 text-[9px] uppercase">Bitrate</span>
                        <span className="font-semibold">{p.br}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                        p.hw.includes("Sim") ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"
                      )}>
                        HW: {p.hw}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scripts e Ferramentas CLI */}
        <Card className="shadow-sm border-primary/10 overflow-hidden">
          <CardHeader className="bg-slate-900 text-white pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Ferramentas CLI & Scripts</CardTitle>
                <CardDescription className="text-slate-400">Automatização e gestão técnica via Terminal.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-primary text-sm uppercase tracking-wider">
                  <Terminal className="h-4 w-4" /> nexora.ps1
                </h4>
                <p className="text-xs text-muted-foreground">O coração operacional da plataforma no servidor.</p>
                <div className="space-y-1.5 font-mono text-[11px] bg-black/95 text-emerald-400 p-4 rounded-xl border border-white/10 shadow-2xl">
                  <p># Iniciar todos os serviços</p>
                  <p className="text-white">.\nexora.ps1 start</p>
                  <p className="mt-2"># Ver estado dos workers e portas</p>
                  <p className="text-white">.\nexora.ps1 status</p>
                  <p className="mt-2"># Reinício rápido do backend</p>
                  <p className="text-white">.\nexora.ps1 restart backend</p>
                  <p className="mt-2"># Monitorização multi-stream</p>
                  <p className="text-white">.\nexora.ps1 logs</p>
                  <p className="mt-2"># Emergência: Reset total</p>
                  <p className="text-red-400">.\nexora.ps1 reset</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-indigo-500 text-sm uppercase tracking-wider">
                  <Cpu className="h-4 w-4" /> Utilitários de Suporte
                </h4>
                <div className="grid gap-3">
                  {[
                    { name: "executa_10_passos.ps1", desc: "Instalação 'one-click' de todo o ecossistema (Node, Docker, DB)." },
                    { name: "nexora-mover-tudo.ps1", desc: "Cleanup inteligente de ficheiros temporários e organização de pastas." },
                    { name: "scripts/sync-presets.ts", desc: "Sincroniza presets HandBrake JSON com a base de dados em tempo real." },
                    { name: "scripts/flush-queues.ts", desc: "Limpa instantaneamente todas as filas BullMQ (Redis)." },
                    { name: "nexora_mover_node.js", desc: "Motor de movimentação física de assets entre tiers de armazenamento." },
                  ].map((s) => (
                    <div key={s.name} className="p-3 border rounded-lg bg-muted/10 hover:bg-muted/20 transition-all group">
                      <span className="text-xs font-bold block group-hover:text-primary transition-colors">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filas (Queue) */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <ListVideo className="h-5 w-5 text-orange-500" />
              Monitorização de Filas (Queue)
            </CardTitle>
            <CardDescription>Visibilidade em tempo real sobre o pipeline de processamento BullMQ.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              A secção de Filas permite acompanhar o progresso real de cada tarefa (Ingest, QC, Transcoding). Os workers comunicam a sua percentagem de conclusão a cada segundo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-muted/5">
                <h5 className="text-xs font-bold uppercase mb-1">Workers Ativos</h5>
                <p className="text-xs text-muted-foreground">Monitorize a carga individual de cada instância do processador de vídeo.</p>
              </div>
              <div className="p-3 border rounded-lg bg-muted/5">
                <h5 className="text-xs font-bold uppercase mb-1">Recuperação de Jobs</h5>
                <p className="text-xs text-muted-foreground">Jobs que falham por picos de rede são colocados em retry automático.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs & Diagnóstico */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-purple-500" />
              Logs & Diagnóstico Automático
            </CardTitle>
            <CardDescription>Motor de inteligência operacional para resolução de incidentes.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              O Nexora integra um **Motor de Diagnóstico** que analisa logs em tempo real para detetar anomalias de hardware ou conformidade.
            </p>
            <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl">
              <h5 className="text-sm font-bold mb-2 flex items-center gap-2 text-purple-600">
                <Activity className="h-4 w-4" /> Diagnóstico Automático:
              </h5>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <ChevronRight className="h-3 w-3 text-purple-500 shrink-0" />
                  <span><strong>Análise Proativa:</strong> Identificação de falhas de GPU NVENC antes do início do job.</span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="h-3 w-3 text-purple-500 shrink-0" />
                  <span><strong>Sugestão de Correção:</strong> Se um erro é conhecido, o sistema propõe a solução diretamente no log.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* HOW-TO */}
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Guias Práticos (HOW-TO)
            </CardTitle>
            <CardDescription className="text-primary/70">Instruções passo-a-passo para as tarefas mais comuns.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-blue-600">
                    <UploadCloud className="h-4 w-4" /> 1. Ingestão e Processamento
                  </h4>
                  <div className="space-y-3 ml-2 border-l-2 border-blue-100 pl-4">
                    <div className="text-xs">
                      <span className="font-bold block">Primeiro Upload</span>
                      <p className="text-muted-foreground">Arraste o ficheiro em Assets, escolha o perfil (ex: HLS 1080p) e o destino (Cloud/Local).</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold block">Monitorizar Progresso</span>
                      <p className="text-muted-foreground">Aceda a 'Filas' para ver a percentagem exata extraída do motor de transcode.</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold block">Hardware Acceleration</span>
                      <p className="text-muted-foreground">Nos perfis, ative 'NVENC' para usar a GPU e reduzir o tempo de encode em até 80%.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-purple-600">
                    <Activity className="h-4 w-4" /> 2. Diagnóstico de Falhas
                  </h4>
                  <div className="space-y-3 ml-2 border-l-2 border-purple-100 pl-4">
                    <div className="text-xs">
                      <span className="font-bold block">Erro de GPU</span>
                      <p className="text-muted-foreground">Se os logs indicarem 'NVENC Error', o motor de diagnóstico sugerirá fallback para CPU.</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold block">Espaço em Disco</span>
                      <p className="text-muted-foreground">O sistema bloqueia uploads se o disco estiver &gt; 95%. Use o dashboard para limpar cache.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" /> 3. Qualidade e Conformidade
                  </h4>
                  <div className="space-y-3 ml-2 border-l-2 border-emerald-100 pl-4">
                    <div className="text-xs">
                      <span className="font-bold block">Aprovar Quarentena</span>
                      <p className="text-muted-foreground">Ficheiros com VMAF baixo ficam em quarentena. Analise o relatório e aprove manualmente se estiver OK.</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold block">Normalização Áudio</span>
                      <p className="text-muted-foreground">O sistema aplica EBU R128 automaticamente. Verifique o gráfico de loudness no detalhe do asset.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-orange-600">
                    <Layers className="h-4 w-4" /> 4. Gestão e Administração
                  </h4>
                  <div className="space-y-3 ml-2 border-l-2 border-orange-100 pl-4">
                    <div className="text-xs">
                      <span className="font-bold block">Roles (RBAC)</span>
                      <p className="text-muted-foreground">Atribua roles 'VIEWER' ou 'OPERATOR' para limitar o que cada utilizador pode apagar.</p>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold block">Manutenção via CLI</span>
                      <p className="text-muted-foreground">Use <code className="bg-muted px-1 rounded">.\nexora.ps1 reset</code> apenas em situações extremas de corrupção de dados.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex gap-3 mt-6 shadow-inner">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Dica de Performance:</strong> Para ambientes de alta carga, separe os workers em máquinas diferentes e aponte todos para o mesmo Redis centralizado via <code className="bg-muted px-1 rounded">.env</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Segurança e Admin
            </CardTitle>
            <CardDescription>Controlo de acesso e operações críticas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              O acesso é gerido via <strong>RBAC</strong>. Apenas Administradores podem aceder às definições do sistema e realizar operações destrutivas.
            </p>
          </CardContent>
        </Card>

        {/* Áudio e Legendas */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Áudio & Legendas
            </CardTitle>
            <CardDescription>Normalização e acessibilidade multimédia.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              O Nexora automatiza a conformidade de áudio via <strong>bs1770gain</strong> e permite o processamento de legendas profissionais (SRT, VTT, TTML).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
