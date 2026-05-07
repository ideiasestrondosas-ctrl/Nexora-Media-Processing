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
  Database,
  Zap,
  Activity,
  Search
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

        {/* Encoding & HandBrake */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-500" />
              Perfis de Encoding & HandBrake Professional
            </CardTitle>
            <CardDescription>Otimização profissional via HandBrake Presets.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">H.265/HEVC</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Broadcast 4K</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">HLS Multi-Bitrate</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Archive Master</div>
            </div>
            <p className="text-sm text-muted-foreground">
              O Nexora integra nativamente os presets do **HandBrake**, permitindo transcodificações otimizadas para diferentes janelas de exibição (OTT, Social Media, Broadcast).
            </p>
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
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2"><PlayCircle className="h-4 w-4 text-blue-500" /> Processar o seu primeiro vídeo</h4>
              <div className="grid grid-cols-1 gap-2 ml-6">
                <div className="flex gap-3 items-center">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span className="text-sm text-muted-foreground">Vá a Assets e clique em "Fazer Upload".</span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span className="text-sm text-muted-foreground">O sistema realiza o Checksum e Análise Técnica Deep automaticamente.</span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span className="text-sm text-muted-foreground">Escolha um Perfil de Encoding (ex: Broadcast 4K) e aguarde o transcode e o QC Comparativo.</span>
                </div>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl space-y-2">
              <h4 className="text-sm font-bold text-red-500 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Resolução de Falhas</h4>
              <p className="text-xs text-muted-foreground">Consulte o **Relatório de QC** no detalhe do asset para identificar regressões de qualidade ou erros de compressão detetados pelo motor do sistema.</p>
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
