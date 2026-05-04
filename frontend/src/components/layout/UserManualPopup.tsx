"use client";

import { useState } from "react";
import {
  BookOpen,
  Menu as MenuIcon,
  ChevronRight,
  Film,
  UploadCloud,
  ListVideo,
  Settings,
  Users,
  LayoutDashboard,
  Wrench,
  RefreshCw,
  Shield,
  X,
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
    title: "Dashboard",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          O <strong>Dashboard</strong> é o ponto de entrada do Nexora e apresenta uma visão geral em tempo real do estado do sistema.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Métricas apresentadas</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Assets Processados</strong> — número de ficheiros com processamento concluído com sucesso.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Jobs Activos / Pendentes</strong> — tarefas de processamento em execução ou em fila de espera.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Taxa de Sucesso</strong> — percentagem de jobs concluídos com êxito nas últimas 24 horas.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Falhas (24h)</strong> — número de jobs que falharam nas últimas 24 horas.</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Gráficos</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Qualidade Média (VMAF/PSNR)</strong> — evolução da qualidade de transcodificação nas últimas 24h.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Volume de Processamento</strong> — total de GB processados nos últimos 7 dias.</span></li>
          </ul>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-600 dark:text-blue-400">
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
        <p className="text-muted-foreground leading-relaxed">
          A secção <strong>Assets</strong> é a biblioteca de todos os ficheiros multimédia recebidos pelo sistema.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Estados dos Assets</h3>
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: "PENDING", color: "bg-slate-500", desc: "Ficheiro recebido, aguarda início do processamento." },
              { label: "INGESTING", color: "bg-blue-500", desc: "A analisar metadados e a calcular checksum SHA-256." },
              { label: "QC_RUNNING", color: "bg-yellow-500", desc: "Controlo de Qualidade em execução (bitrate, loudness, normas)." },
              { label: "QC_PASSED", color: "bg-green-500", desc: "Passou no QC, aguarda transcodificação." },
              { label: "QC_QUARANTINED", color: "bg-orange-500", desc: "QC detetou problemas menores; requer revisão manual." },
              { label: "TRANSCODING", color: "bg-blue-400", desc: "Transcodificação de vídeo em curso." },
              { label: "COMPLETED", color: "bg-green-600", desc: "Processamento concluído com sucesso." },
              { label: "FAILED", color: "bg-red-500", desc: "Erro durante o processamento." },
            ].map(s => (
              <div key={s.label} className="flex items-start gap-3">
                <span className={cn("text-[10px] text-white px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5", s.color)}>{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
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
        <p className="text-muted-foreground leading-relaxed">
          O <strong>Upload</strong> permite carregar ficheiros de vídeo para o sistema Nexora.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Upload Múltiplo</h3>
          <p className="text-sm text-muted-foreground">
            Pode carregar vários ficheiros em simultâneo. Use o selector global no topo para definir o perfil e destino para todos, ou ajuste individualmente na lista.
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-600 dark:text-blue-400">
          💡 Os ficheiros são processados em paralelo para maximizar a eficiência.
        </div>
      </div>
    ),
  },
  {
    id: "profiles",
    icon: Settings,
    title: "Perfis",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Os <strong>Perfis</strong> definem os parâmetros de transcodificação.
        </p>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400">
          ⚠️ O sistema valida automaticamente a compatibilidade entre o container e os codecs.
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    icon: Wrench,
    title: "Definições",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Gestão de armazenamento e reset do sistema (apenas Admins).
        </p>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
          ⚠️ O Reset Completo é irreversível e apaga todos os dados e ficheiros.
        </div>
      </div>
    ),
  },
];

export function UserManualPopup() {
  const [activeId, setActiveId] = useState("dashboard");
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0];

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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-md border-border">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Manual de Utilizador Nexora
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-48 border-r bg-muted/30 flex flex-col shrink-0">
            <nav className="flex-1 py-2 overflow-y-auto">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveId(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                      isActive
                        ? "bg-primary/10 text-primary border-r-2 border-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <activeSection.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{activeSection.title}</h2>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              {activeSection.content}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
