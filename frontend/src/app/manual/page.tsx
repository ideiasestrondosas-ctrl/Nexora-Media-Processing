"use client";

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
  Database
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ManualPage() {
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
            <p className="text-muted-foreground text-sm">Guia técnico e pedagógico da plataforma Nexora.</p>
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

        {/* Assets */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-indigo-500" />
              Biblioteca de Assets
            </CardTitle>
            <CardDescription>Ciclo de vida e workflow dos ficheiros multimédia.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-background border rounded-lg text-center">
                <div className="bg-blue-500/10 h-8 w-8 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-500 font-bold">1</div>
                <h5 className="text-sm font-bold mb-1">Ingest</h5>
                <p className="text-xs text-muted-foreground">Análise de metadados e Checksum SHA-256.</p>
              </div>
              <div className="p-4 bg-background border rounded-lg text-center">
                <div className="bg-yellow-500/10 h-8 w-8 rounded-full flex items-center justify-center mx-auto mb-2 text-yellow-500 font-bold">2</div>
                <h5 className="text-sm font-bold mb-1">QC</h5>
                <p className="text-xs text-muted-foreground">Verificação de áudio (R128) e normas de vídeo.</p>
              </div>
              <div className="p-4 bg-background border rounded-lg text-center">
                <div className="bg-green-500/10 h-8 w-8 rounded-full flex items-center justify-center mx-auto mb-2 text-green-500 font-bold">3</div>
                <h5 className="text-sm font-bold mb-1">Delivery</h5>
                <p className="text-xs text-muted-foreground">Transcodificação e disponibilização final.</p>
              </div>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl flex gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="text-sm">
                <strong className="text-orange-500">Atenção à Quarentena:</strong> Se um asset estiver em <code>QC_QUARANTINED</code>, significa que foram detetados problemas técnicos. Verifique o relatório no detalhe do asset.
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

        {/* Encoding */}
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-500" />
              Perfis de Encoding
            </CardTitle>
            <CardDescription>Configurações técnicas para garantir consistência na saída.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">H.264</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">ProRes</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">MXF</div>
              <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">MP4</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Os perfis bloqueiam automaticamente combinações incompatíveis para evitar erros fatais durante o transcode.
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
                  <span className="text-sm text-muted-foreground">Arraste o vídeo e escolha um perfil (ex: "Web HD").</span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span className="text-sm text-muted-foreground">Acompanhe o progresso no menu "Filas".</span>
                </div>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl space-y-2">
              <h4 className="text-sm font-bold text-red-500 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Resolução de Falhas</h4>
              <p className="text-xs text-muted-foreground">Se um vídeo falhar, verifique primeiro o formato original e o espaço em disco no Dashboard. O Nexora requer pelo menos 5% de espaço livre para iniciar novos trabalhos.</p>
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
      </div>
    </div>
  );
}
