"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wrench, HardDrive, Cloud, RefreshCw, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Shield, Database, FileX, UploadCloud, Download,
  History, Info, Cpu, Zap, ChevronRight
} from "lucide-react";


import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface SystemSettings {
  localStoragePath: string;
  defaultStorageStrategy: "MINIO" | "LOCAL";
  webPriorityPercentage: number;
  version?: string;
}

interface SystemStatus {
  assets: number;
  users: number;
  profiles: number;
  jobs: number;
  isEmpty: boolean;
}

type ResetStep = "idle" | "confirm1" | "confirm2" | "resetting" | "done" | "error";

export default function SettingsPage() {
  const authUser = useAuthStore(s => s.user);
  const isAdmin = authUser?.roles?.includes("ADMIN") || authUser?.sub === "user-123";

  const [settings, setSettings] = useState<SystemSettings>({
    localStoragePath: "",
    defaultStorageStrategy: "MINIO",
    webPriorityPercentage: 20,
  });
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Reset state machine
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [includeFiles, setIncludeFiles] = useState(false);
  const [resetResult, setResetResult] = useState<{ details: string[]; message: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Fetch settings + status
  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, st] = await Promise.all([
          api.get<SystemSettings>("/settings"),
          api.get<SystemStatus>("/system/reset/status"),
        ]);
        setSettings(cfg);
        setStatus(st);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoadingSettings(false);
      }
    };
    void load();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSavedOk(false);
    try {
      await api.put("/settings", settings);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err: any) {
      alert(err?.message ?? "Erro ao guardar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirmText !== "RESET") return;
    setResetStep("resetting");
    setResetError(null);
    try {
      const result = await api.post<{ message: string; details: string[] }>("/system/reset", {
        confirmation: "RESET",
        includeFiles,
      });
      setResetResult(result);
      setResetStep("done");
      try {
        const st = await api.get<SystemStatus>("/system/reset/status");
        setStatus(st);
      } catch { /* ignore */ }
    } catch (err: any) {
      setResetError(err?.message ?? "Erro durante o reset.");
      setResetStep("error");
    }
  };

  const cancelReset = () => {
    setResetStep("idle");
    setResetConfirmText("");
    setIncludeFiles(false);
    setResetError(null);
    setResetResult(null);
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-3" />
        A carregar definições...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Wrench className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Definições do Sistema</h1>
          <p className="text-muted-foreground text-sm">Configuração global do Nexora Media Processing.</p>
        </div>
      </div>

      {/* Estado actual */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Assets", value: status.assets, icon: Database },
            { label: "Jobs", value: status.jobs, icon: RefreshCw },
            { label: "Utilizadores", value: status.users, icon: Shield },
            { label: "Perfis", value: status.profiles, icon: Wrench },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Armazenamento e Recursos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Armazenamento e Recursos
          </CardTitle>
          <CardDescription>Configuração do destino de ficheiros e prioridade de CPU.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label>Estratégia por Defeito</Label>
            <Select
              value={settings.defaultStorageStrategy}
              onValueChange={(v) => setSettings(s => ({ ...s, defaultStorageStrategy: v as "MINIO" | "LOCAL" }))}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MINIO">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-blue-500" />
                    Nexora Cloud (MinIO)
                  </div>
                </SelectItem>
                <SelectItem value="LOCAL">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-green-500" />
                    Disco Local
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Caminho de Armazenamento Local</Label>
            <Input
              value={settings.localStoragePath}
              onChange={(e) => setSettings(s => ({ ...s, localStoragePath: e.target.value }))}
              placeholder="C:\NexoraStorage\assets"
              disabled={!isAdmin}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Directório onde os assets são guardados quando a estratégia LOCAL está seleccionada.
            </p>
          </div>

          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Prioridade do Serviço Web
                </Label>
                <p className="text-xs text-muted-foreground max-w-[400px]">
                  Reserva CPU para garantir que a interface responde durante hardware load.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-lg font-bold px-2 py-1 rounded bg-muted",
                  settings.webPriorityPercentage > 70 ? "text-orange-500" : "text-primary"
                )}>
                  {settings.webPriorityPercentage}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={settings.webPriorityPercentage}
                onChange={(e) => setSettings(s => ({ ...s, webPriorityPercentage: parseInt(e.target.value) }))}
                disabled={!isAdmin}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                <span>REATIVIDADE MÍNIMA (10%)</span>
                <span>MÁXIMA (90%)</span>
              </div>
            </div>

            {settings.webPriorityPercentage > 70 && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Atenção ao Desempenho</p>
                  <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80 leading-relaxed">
                    Prioridade acima de 70% deixará poucos recursos para o processamento de vídeo. 
                    <strong> Os trabalhos em fila (transcode) serão executados muito mais lentamente.</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className={cn(
                  "gap-2 min-w-[140px]",
                  savedOk && "bg-green-600 hover:bg-green-700 text-white"
                )}
              >
                {savingSettings ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> A guardar...</>
                ) : savedOk ? (
                  <><CheckCircle2 className="h-4 w-4" /> Guardado!</>
                ) : (
                  "Guardar Configurações"
                )}
              </Button>
            </div>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Apenas administradores podem alterar as configurações.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Versão e Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Versão e Histórico do Sistema
          </CardTitle>
          <CardDescription>Informação sobre a release actual e log de alterações.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70">Nexora Engine</p>
                <p className="text-2xl font-black tracking-tighter">V{settings.version || "1.1.0"}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Build Status</p>
              <div className="flex items-center gap-1.5 justify-end text-green-500 font-bold text-xs uppercase">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Stable Production
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">Log de Alterações</h4>
            
            <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-muted">
              {/* V1.1.0 */}
              <div className="relative pl-8 group">
                <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-primary bg-background z-10 group-hover:scale-110 transition-transform" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">V1.1.0 — Nexora Stabilization</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-tight">Current</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span><strong>Identificação Automática</strong> — Versão global lida dinamicamente do motor principal.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span><strong>Prioridade Web</strong> — Novo mecanismo de reserva de hardware para garantir interface fluida.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span><strong>Análise Rica de Upload</strong> — Detecção instantânea de resolução, duração e ícones de codec.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span><strong>Preservação Original</strong> — Suporte para codec "Copy" em perfis para manter qualidade nativa.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* V1.0.0 */}
              <div className="relative pl-8 group opacity-70 hover:opacity-100 transition-opacity">
                <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-muted-foreground bg-background z-10" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">V1.0.0 — Nexora Foundation</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Maio 2026</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>Arquitetura Micro-Batch</strong> — Pipeline baseada em BullMQ e Redis para alta performance.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>Multi-Storage</strong> — Suporte nativo para MinIO (S3) e Armazenamento Local Directo.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>Quality Control</strong> — Motor de diagnóstico com MediaConch e Loudness EBU R128.</span>
                    </li>
                    <li className="flex gap-2">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>Dashboard de Telemetria</strong> — Monitorização em tempo real de CPU, RAM, GPU e Disco.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup e Restore — apenas admins */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Backup e Recuperação
            </CardTitle>
            <CardDescription>Cópia de segurança das configurações, perfis e utilizadores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Exportar Configurações</p>
                <p className="text-xs text-muted-foreground">
                  Gera um ficheiro JSON com todos os perfis, destinos de entrega, utilizadores e definições globais.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto gap-2"
                  onClick={async () => {
                    try {
                      const data = await api.get("/system/backup");
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `nexora-backup-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err: any) {
                      alert("Erro ao gerar backup: " + err.message);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />

                  Descarregar Backup
                </Button>
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Importar Backup</p>
                <p className="text-xs text-muted-foreground">
                  Restaura o sistema a partir de um ficheiro previamente exportado. <span className="text-destructive font-semibold">Substitui dados existentes.</span>
                </p>
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    accept=".json"
                    className="text-xs h-9 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!confirm("Tem a certeza que deseja restaurar este backup? As configurações actuais serão sobrescritas.")) return;
                      
                      try {
                        const text = await file.text();
                        const backup = JSON.parse(text);
                        await api.post("/system/restore", backup);
                        alert("Sistema restaurado com sucesso! A recarregar...");
                        window.location.reload();
                      } catch (err: any) {
                        alert("Erro ao restaurar backup: " + err.message);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset do Sistema — apenas admins */}
      {isAdmin && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Zona de Perigo — Reset Completo
            </CardTitle>
            <CardDescription>
              Apaga <strong>todos</strong> os dados do sistema e repõe ao estado inicial.
              Esta acção é <strong className="text-destructive font-bold">irreversível</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetStep === "idle" && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-destructive/5 border border-destructive/10 rounded-lg gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Reset Completo da Base de Dados</p>
                  <p className="text-xs text-muted-foreground">
                    Remove assets, jobs, utilizadores, perfis, webhooks, tokens e logs.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="shrink-0 gap-2 w-full sm:w-auto"
                  onClick={() => setResetStep("confirm1")}
                >
                  <Database className="h-4 w-4" />
                  Iniciar Reset
                </Button>
              </div>
            )}

            {resetStep === "confirm1" && (
              <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-3 text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Tem a certeza absoluta?</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Serão apagados: <strong>{status?.assets ?? "?"} assets</strong>,{" "}
                      <strong>{status?.jobs ?? "?"} jobs</strong>,{" "}
                      <strong>{status?.users ?? "?"} utilizadores</strong> e{" "}
                      <strong>{status?.profiles ?? "?"} perfis</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <input
                    id="includeFiles"
                    type="checkbox"
                    checked={includeFiles}
                    onChange={e => setIncludeFiles(e.target.checked)}
                    className="h-4 w-4 accent-destructive"
                  />
                  <label htmlFor="includeFiles" className="text-sm cursor-pointer flex items-center gap-2">
                    <FileX className="h-4 w-4 text-destructive" />
                    Incluir limpeza de ficheiros locais
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={cancelReset}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={() => setResetStep("confirm2")}>
                    Continuar →
                  </Button>
                </div>
              </div>
            )}

            {resetStep === "confirm2" && (
              <div className="space-y-4 p-4 bg-destructive/10 border-2 border-destructive rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <p className="text-sm font-bold">Confirmação final — sem retorno.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Escreva <code className="bg-muted px-1.5 py-0.5 rounded font-mono">RESET</code> para confirmar:
                  </Label>
                  <Input
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="font-mono text-lg tracking-widest text-center"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={cancelReset}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={resetConfirmText !== "RESET"}
                    onClick={handleReset}
                    className="gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Executar Reset
                  </Button>
                </div>
              </div>
            )}

            {resetStep === "resetting" && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-destructive" />
                <p className="text-sm">A apagar dados e a repor o sistema...</p>
              </div>
            )}

            {resetStep === "done" && resetResult && (
              <div className="space-y-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-semibold">{resetResult.message}</p>
                </div>
                <div className="space-y-1 bg-muted rounded p-3 max-h-48 overflow-y-auto">
                  {resetResult.details.map((line, i) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground">✓ {line}</p>
                  ))}
                </div>
                <Button variant="outline" onClick={cancelReset}>
                  Fechar
                </Button>
              </div>
            )}

            {resetStep === "error" && (
              <div className="space-y-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <p className="text-sm font-semibold">Erro durante o reset</p>
                </div>
                <p className="text-xs font-mono">{resetError}</p>
                <Button variant="outline" onClick={cancelReset}>
                  Tentar Novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 bg-muted border rounded-lg text-muted-foreground text-sm">
          <Shield className="h-5 w-5 shrink-0" />
          <span>Acesso restrito a administradores.</span>
        </div>
      )}
    </div>
  );
}
