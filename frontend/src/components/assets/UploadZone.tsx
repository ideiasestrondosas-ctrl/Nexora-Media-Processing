"use client";

import { useState, useCallback, useEffect } from "react";
import { UploadCloud, FileVideo, X, HardDrive, Cloud, FolderOpen, ToggleLeft, ToggleRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Profile {
  id: string;
  name: string;
  description: string;
}

interface SystemSettings {
  localStoragePath: string;
  defaultStorageStrategy: "MINIO" | "LOCAL";
}

interface UploadZoneProps {
  onUploadStart?: (file: File) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadSuccess?: (assetId: string) => void;
  onUploadError?: (error: Error) => void;
  uploadUrl: string;
  token?: string | null;
}

export function UploadZone({
  onUploadStart,
  onUploadProgress,
  onUploadSuccess,
  onUploadError,
  uploadUrl,
  token: tokenProp,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [storageStrategy, setStorageStrategy] = useState<"MINIO" | "LOCAL">("MINIO");
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const { toast } = useToast();

  // Ler token da store (tem prioridade sobre a prop)
  const storeToken = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const token = storeToken ?? tokenProp;
  const isAdmin = authUser?.roles?.includes("ADMIN") || authUser?.sub === "user-123";

  useEffect(() => {
    // Buscar perfis disponíveis
    const fetchProfiles = async () => {
      try {
        const data = await api.get<{ profiles: Profile[] }>("/profiles");
        if (data?.profiles?.length > 0) {
          setProfiles(data.profiles);
          const defaultProfile = data.profiles.find((p: any) => p.isDefault) ?? data.profiles[0];
          setSelectedProfile(defaultProfile.id);
        }
      } catch (err) {
        console.error("Erro a obter perfis:", err);
      }
    };

    // Buscar configurações do sistema
    const fetchSettings = async () => {
      try {
        const data = await api.get<SystemSettings>("/settings");
        if (data) {
          setSettings(data);
          setStorageStrategy(data.defaultStorageStrategy ?? "MINIO");
        }
      } catch (err) {
        console.error("Erro a obter configurações:", err);
      }
    };

    void fetchProfiles();
    void fetchSettings();
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (f: File) => {
    if (!f.type.startsWith("video/") && !f.name.endsWith(".mxf")) {
      toast({
        title: "Tipo de ficheiro não suportado",
        description: "Apenas são permitidos ficheiros de vídeo (MP4, MXF, MOV, etc).",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      const dropped = e.dataTransfer.files[0];
      if (validateFile(dropped)) setFile(dropped);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      if (validateFile(selected)) setFile(selected);
    }
  };

  const clearFile = () => {
    if (status === "uploading") return;
    setFile(null);
    setProgress(0);
    setStatus("idle");
    setErrorMessage("");
  };

  const uploadFile = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage("");
    onUploadStart?.(file);

    const formData = new FormData();
    formData.append("file", file);

    // Construir URL com parâmetros de estratégia
    const url = new URL(uploadUrl);
    url.searchParams.set("profile", selectedProfile);
    url.searchParams.set("storageStrategy", storageStrategy);
    url.searchParams.set("keepOriginal", String(keepOriginal));

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url.toString());
      xhr.timeout = 2 * 60 * 60 * 1000; // 2 horas

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
          onUploadProgress?.(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus("success");
          try {
            const response = JSON.parse(xhr.responseText);
            const where = response.strategy === "LOCAL"
              ? `Disco Local (${settings?.localStoragePath ?? "caminho configurado"})`
              : "Nexora Cloud (MinIO)";
            onUploadSuccess?.(response.assetId ?? response.id);
            toast({
              title: "Upload concluído",
              description: `Ficheiro guardado em: ${where}`,
            });
          } catch {
            onUploadSuccess?.("unknown-id");
          }
        } else {
          setStatus("error");
          let msg = "Erro desconhecido";
          try {
            msg = JSON.parse(xhr.responseText)?.message ?? xhr.statusText;
          } catch {
            msg = xhr.statusText;
          }
          setErrorMessage(msg);
          onUploadError?.(new Error(msg));
        }
      };

      xhr.onerror = () => {
        setStatus("error");
        const msg = "Erro de rede ou ligação recusada. Verifique se o backend está a correr.";
        setErrorMessage(msg);
        onUploadError?.(new Error(msg));
      };

      xhr.ontimeout = () => {
        setStatus("error");
        const msg = "Tempo limite de upload excedido.";
        setErrorMessage(msg);
        onUploadError?.(new Error(msg));
      };

      xhr.send(formData);
    } catch (err) {
      setStatus("error");
      onUploadError?.(err as Error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardContent className="p-0">
        {!file ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center p-12 text-center border-2 border-dashed transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900",
              "hover:border-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept="video/*,.mxf"
              onChange={handleFileChange}
            />
            <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4">
              <UploadCloud className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Arrasta e Larga o teu media aqui</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Suporta MP4, MOV, MXF (ProRes, XDCAM, DNxHD) até 50GB.
            </p>
            <Button variant="secondary" className="mt-6">Procurar ficheiro</Button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Cabeçalho do ficheiro */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                <FileVideo className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate" title={file.name}>{file.name}</h4>
                <p className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              {status !== "uploading" && status !== "success" && (
                <Button variant="ghost" size="icon" onClick={clearFile} className="text-slate-400 hover:text-red-500 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Opções de upload (só quando idle) */}
            {status === "idle" && (
              <div className="space-y-4 border-t pt-4">
                {/* Perfil de Encoding */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 w-36 shrink-0">Perfil de Encoding:</span>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destino de Armazenamento */}
                <div className="space-y-2">
                  <span className="text-sm text-slate-500">Destino de Armazenamento:</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStorageStrategy("MINIO")}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                        storageStrategy === "MINIO"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <Cloud className={cn("h-5 w-5 shrink-0", storageStrategy === "MINIO" ? "text-blue-500" : "text-slate-400")} />
                      <div>
                        <p className="text-sm font-semibold">Nexora Cloud</p>
                        <p className="text-xs text-slate-500">MinIO — Escalável e distribuído</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStorageStrategy("LOCAL")}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                        storageStrategy === "LOCAL"
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <HardDrive className={cn("h-5 w-5 shrink-0", storageStrategy === "LOCAL" ? "text-green-500" : "text-slate-400")} />
                      <div>
                        <p className="text-sm font-semibold">Disco Local</p>
                        <p className="text-xs text-slate-500 truncate" title={settings?.localStoragePath}>
                          {settings?.localStoragePath ?? "Caminho configurado"}
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Info do caminho local para admins */}
                  {storageStrategy === "LOCAL" && isAdmin && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-md p-2">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      <span>Caminho: <code className="font-mono">{settings?.localStoragePath}/{"<assetId>"}/<em>{file.name}</em></code></span>
                    </div>
                  )}
                </div>

                {/* Manter Original */}
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Manter ficheiro original após processamento
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeepOriginal(!keepOriginal)}
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-colors",
                      keepOriginal ? "text-blue-600" : "text-slate-400"
                    )}
                  >
                    {keepOriginal
                      ? <ToggleRight className="h-6 w-6" />
                      : <ToggleLeft className="h-6 w-6" />
                    }
                    {keepOriginal ? "Sim" : "Não"}
                  </button>
                </div>

                {/* Botões de acção */}
                <div className="flex justify-end gap-3 pt-1">
                  <Button variant="outline" onClick={clearFile}>Cancelar</Button>
                  <Button onClick={uploadFile} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <UploadCloud className="h-4 w-4" />
                    Iniciar Upload
                  </Button>
                </div>
              </div>
            )}

            {/* Barra de progresso */}
            {(status === "uploading" || status === "success") && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600 dark:text-slate-400">
                    {status === "success"
                      ? `Concluído! → ${storageStrategy === "LOCAL" ? "Disco Local" : "Nexora Cloud"}`
                      : "A enviar..."}
                  </span>
                  <span className={status === "success" ? "text-green-500" : "text-blue-600"}>
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Erro */}
            {status === "error" && (
              <>
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md text-sm">
                  {errorMessage || "Falha no upload. O ficheiro pode ser demasiado grande ou ocorreu um erro de rede."}
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={clearFile}>Voltar</Button>
                  <Button onClick={uploadFile} variant="default">Tentar Novamente</Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
