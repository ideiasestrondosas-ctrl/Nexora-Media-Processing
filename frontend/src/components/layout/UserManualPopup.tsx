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
  X,
  HelpCircle,
  PlayCircle,
  AlertCircle,
  Database,
  CheckCircle2
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
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          O <strong>Dashboard</strong> monitoriza a saúde técnica e a qualidade da produção em tempo real.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Qualidade (VMAF/PSNR)</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>VMAF</strong> — Mede a percepção visual humana. Valores acima de 90 indicam qualidade excelente.</span></li>
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>PSNR</strong> — Métrica matemática de fidelidade de pixéis para deteção de erros técnicos.</span></li>
          </ul>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
          💡 A monitorização de <strong>GPU (NVIDIA)</strong> garante que o hardware está a acelerar a conversão corretamente.
        </div>
      </div>
    ),
  },
  {
    id: "assets",
    icon: Film,
    title: "Assets & Workflow",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Cada asset passa por um ciclo de vida rigoroso: <strong>Análise -> QC -> Processamento</strong>.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Controlo de Qualidade (QC)</h3>
          <p className="text-sm text-muted-foreground">O sistema valida automaticamente normas de áudio (EBU R128) e vídeo.</p>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-xs text-orange-600 dark:text-orange-400">
            ⚠️ <strong>Quarentena:</strong> Se o QC falhar, o asset é bloqueado para revisão manual para evitar emissões com erro.
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "upload",
    icon: UploadCloud,
    title: "Upload & Armazenamento",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Pode escolher entre armazenamento em <strong>Nuvem (MinIO)</strong> para redundância ou <strong>Disco Local</strong> para máxima velocidade.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Retenção de Dados</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span><strong>Manter Original</strong> — Define se o ficheiro bruto é apagado após o transcode.</span></li>
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
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Processar vídeo</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Inicie o upload em <strong>Assets</strong>.</p>
          <p>2. Configure o ficheiro com o <strong>Perfil</strong> desejado.</p>
          <p>3. Monitorize o progresso no menu <strong>Filas</strong>.</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-600 dark:text-red-400">
          🆘 <strong>Falhas:</strong> Verifique o espaço em disco no Dashboard se os trabalhos não iniciarem.
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
        <p className="text-muted-foreground leading-relaxed">
          O Nexora utiliza <strong>RBAC</strong> para garantir que apenas utilizadores autorizados acedem a funções críticas como o Reset do Sistema.
        </p>
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
      <DialogContent className="max-w-3xl h-[70vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-md border-border">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Manual de Utilizador Nexora
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
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
          </aside>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-background/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <activeSection.icon className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold">{activeSection.title}</h2>
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
