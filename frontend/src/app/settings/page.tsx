"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wrench, HardDrive, Cloud, RefreshCw, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Shield, Database, FileX
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface SystemSettings {
  localStoragePath: string;
  defaultStorageStrategy: "MINIO" | "LOCAL";
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

      {/* Armazenamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Armazenamento
          </CardTitle>
          <CardDescription>Configuração do destino por defeito para novos uploads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <UploadCloud className="h-4 w-4" />
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
