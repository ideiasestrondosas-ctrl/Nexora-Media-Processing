"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Database, 
  Activity,
  History,
  Loader2,
  Wrench,
  Zap,
  HardDrive,
  Shield,
  RefreshCw,
  ChevronRight,
  Cloud,
  Cpu,
  CheckCircle2,
  FileX,
  Download,
  AlertTriangle
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";


interface SystemSettings {
  localStoragePath: string;
  defaultStorageStrategy: "MINIO" | "LOCAL";
  webPriorityPercentage: number;
}

interface SystemStatus {
  redis: boolean;
  database: boolean;
  minio: boolean;
  worker: boolean;
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

type ResetStep = "idle" | "confirm" | "processing" | "done";


export default function SettingsPage() {
  const authUser = useAuthStore(s => s.user);
  const isAdmin = authUser?.roles?.includes("ADMIN") || authUser?.sub === "user-123";

  const [settings, setSettings] = useState<SystemSettings & { logRotationSizeMB?: number; logRotationCount?: number; tempDirectory?: string }>({
    localStoragePath: "",
    defaultStorageStrategy: "MINIO",
    webPriorityPercentage: 20,
    logRotationSizeMB: 50,
    logRotationCount: 5,
    tempDirectory: "",
  });
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [hydrated, setHydrated] = useState(false);


  // Reset state machine
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetOptions, setResetOptions] = useState({
    redis: false,
    database: false,
    tempFiles: false,
    logs: false,
  });
  const [resetResult, setResetResult] = useState<{ results: any; message: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = (useAuthStore as any).persist?.onFinishHydration(() => setHydrated(true));
    setHydrated((useAuthStore as any).persist?.hasHydrated());
    return unsub;
  }, []);

  // Fetch settings + status
  useEffect(() => {
    if (!hydrated) return;

    const load = async () => {
      try {
        const results = await Promise.allSettled([
          api.get<any>("/settings"),
          api.get<any>("/system/reset/status"),
          api.get<any>("/system/changelog"),
        ]);

        const cfg = results[0].status === 'fulfilled' ? results[0].value : null;
        const st = results[1].status === 'fulfilled' ? results[1].value : null;
        const cl = results[2].status === 'fulfilled' ? results[2].value : { entries: [] };

        if (cfg) setSettings((prev: any) => ({ ...prev, ...cfg }));
        if (st) setStatus(st);
        if (cl?.entries) setChangelog(cl.entries);

      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoadingSettings(false);
      }
    };
    void load();
  }, [hydrated, authUser]);

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
      const result = await api.post<{ message: string; results: any }>("/system/reset", resetOptions);
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
    setResetOptions({
      redis: false,
      database: false,
      tempFiles: false,
      logs: false,
    });
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
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
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

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 border mb-6">
          <TabsTrigger value="geral" className="gap-2 py-2.5">
            <Zap className="h-4 w-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="recursos" className="gap-2 py-2.5">
            <HardDrive className="h-4 w-4" /> Recursos
          </TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-2 py-2.5">
            <Activity className="h-4 w-4" /> Manutenção
          </TabsTrigger>
          <TabsTrigger value="sistema" className="gap-2 py-2.5">
            <Shield className="h-4 w-4" /> Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-6">
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
                      <p className="text-2xl font-black tracking-tighter">V{settings.version || "1.1.6"}</p>
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
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2 flex justify-between items-center">
                    Log de Alterações
                    <span className="text-[10px] lowercase font-normal">Ultimos 10 registos</span>
                  </h4>

                  
                  <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-muted">
                    {changelog.map((entry, idx) => (
                      <div key={entry.version} className={cn(
                        "relative pl-8 group transition-opacity",
                        idx > 0 && "opacity-70 hover:opacity-100"
                      )}>
                        <div className={cn(
                          "absolute left-0 top-1 h-4 w-4 rounded-full border-2 bg-background z-10 transition-transform",
                          idx === 0 ? "border-primary group-hover:scale-110" : "border-muted-foreground"
                        )} />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">V{entry.version} — {entry.date}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-tight">Current</span>
                            )}
                          </div>
                          <ul className="space-y-1.5 text-xs text-muted-foreground">
                            {entry.changes.map((change, i) => (
                              <li key={i} className="flex gap-2">
                                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recursos" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-6">
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
                </div>

                <div className="space-y-1.5">
                  <Label>Directório Temporário de Processamento</Label>
                  <Input
                    value={settings.tempDirectory}
                    onChange={(e) => setSettings(s => ({ ...s, tempDirectory: e.target.value }))}
                    placeholder="C:\NexoraStorage\temp"
                    disabled={!isAdmin}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="pt-4 border-t space-y-4">
                  <Label className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Prioridade do Serviço Web ({settings.webPriorityPercentage}%)
                  </Label>
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
                </div>

                {isAdmin && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : savedOk ? <CheckCircle2 className="h-4 w-4" /> : null}
                      {savedOk ? "Guardado!" : "Guardar Recursos"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manutencao" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileX className="h-4 w-4 text-muted-foreground" />
                  Gestão de Logs e Diagnósticos
                </CardTitle>
                <CardDescription>Configuração de retenção e rotação de ficheiros de log.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Limite de Tamanho por Ficheiro (MB)</Label>
                    <Input
                      type="number"
                      value={settings.logRotationSizeMB}
                      onChange={(e) => setSettings(s => ({ ...s, logRotationSizeMB: parseInt(e.target.value) }))}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número Máximo de Ficheiros (Rotação)</Label>
                    <Input
                      type="number"
                      value={settings.logRotationCount}
                      onChange={(e) => setSettings(s => ({ ...s, logRotationCount: parseInt(e.target.value) }))}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveSettings} disabled={savingSettings}>
                      {savedOk ? "Guardado!" : "Guardar Manutenção"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Backup e Recuperação
                </CardTitle>
                <CardDescription>Exportar ou importar todo o estado do sistema.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end -mt-4">
                <Button variant="outline" className="w-full gap-2 h-10" onClick={async () => {
                  const data = await api.get("/system/backup");
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `nexora-backup-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                }}>
                  <Download className="h-4 w-4" /> Descarregar Backup
                </Button>

                <div className="space-y-1.5">
                  <Label htmlFor="restore-file" className="text-xs">Importar Backup (.json)</Label>
                  <Input id="restore-file" type="file" className="h-10 cursor-pointer" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const backup = JSON.parse(await file.text());
                      await api.post("/system/restore", backup);
                      alert("Restaurado com sucesso!");
                      window.location.reload();
                    } catch (err) {
                      alert("Erro ao importar: " + err);
                    }
                  }} />
                </div>
              </CardContent>

            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sistema" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-6">
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Zona de Perigo — Reset do Sistema
                </CardTitle>
                <CardDescription>Escolha os componentes que deseja repor ao estado inicial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resetStep === "idle" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: "redis", label: "Redis", desc: "Limpar chaves e cache de jobs." },
                        { id: "database", label: "Database", desc: "Remover assets e histórico." },
                        { id: "tempFiles", label: "Temp Files", desc: "Apagar ficheiros temporários." },
                        { id: "logs", label: "Logs & Backups", desc: "Limpar auditoria e backups." },
                      ].map(opt => (
                        <div 
                          key={opt.id} 
                          onClick={() => setResetOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                          className={cn(
                            "p-3 border rounded-lg cursor-pointer transition-colors text-left",
                            resetOptions[opt.id as keyof typeof resetOptions] ? "bg-destructive/10 border-destructive/50" : "hover:bg-muted"
                          )}
                        >
                          <p className="text-sm font-bold">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                        </div>
                      ))}
                    </div>

                    <Button variant="destructive" className="w-full gap-2" onClick={() => setResetStep("confirm1")} disabled={!Object.values(resetOptions).some(Boolean)}>
                      <AlertTriangle className="h-4 w-4" /> Iniciar Reset Seleccionado
                    </Button>
                  </div>
                )}

                {resetStep === "confirm1" && (
                  <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-semibold text-destructive">Confirmação final necessária</p>
                    <p className="text-xs text-muted-foreground">
                      Esta acção é irreversível. Todos os dados nos componentes seleccionados serão perdidos.
                    </p>
                    <Input
                      value={resetConfirmText}
                      onChange={e => setResetConfirmText(e.target.value)}
                      placeholder="Escreva RESET para confirmar"
                      className="text-center font-mono"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={cancelReset}>Cancelar</Button>
                      <Button variant="destructive" disabled={resetConfirmText !== "RESET"} onClick={handleReset}>
                        Executar Agora
                      </Button>
                    </div>
                  </div>
                )}

                {resetStep === "resetting" && <div className="py-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-destructive" /><p className="text-sm mt-4">A processar reset...</p></div>}
                
                {resetStep === "done" && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                    <p className="text-sm font-bold text-green-600">Reset concluído com sucesso!</p>
                    <div className="text-[10px] font-mono text-muted-foreground max-h-32 overflow-y-auto">
                      {JSON.stringify(resetResult?.results, null, 2)}
                    </div>
                    <Button variant="outline" onClick={cancelReset}>Concluído</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
