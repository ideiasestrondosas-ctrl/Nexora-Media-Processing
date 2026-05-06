"use client";

import { useState, useCallback, useEffect } from "react";
import {
  UploadCloud,
  HardDrive,
  Cloud,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Settings,
  CheckCircle2,
  Loader2,
  Trash2,
  Monitor, Clock, FileType
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Profile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

interface SystemSettings {
  localStoragePath: string;
  defaultStorageStrategy: "MINIO" | "LOCAL";
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  // Overrides
  profileId: string;
  storageStrategy: "MINIO" | "LOCAL";
  keepOriginal: boolean;
  // Metadata
  resolution?: string;
  duration?: number;
  extension: string;
}

interface UploadZoneProps {
  onAllComplete?: () => void;
  uploadUrl: string;
}

export function UploadZone({ onAllComplete, uploadUrl }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Global defaults
  const [globalProfile, setGlobalProfile] = useState<string>("");
  const [globalStorage, setGlobalStorage] = useState<"MINIO" | "LOCAL">("MINIO");
  const [globalKeep, setGlobalKeep] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(true);

  const { toast } = useToast();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const data = await api.get<{ profiles: Profile[] }>("/profiles");
        if (data?.profiles?.length > 0) {
          setProfiles(data.profiles);
          const defaultP = data.profiles.find((p) => p.isDefault) ?? data.profiles[0];
          setGlobalProfile(defaultP.id);
        }
      } catch (err) {
        console.error("Erro ao obter perfis:", err);
      }
    };

    const fetchSettings = async () => {
      try {
        const data = await api.get<SystemSettings>("/settings");
        if (data) {
          setSettings(data);
          setGlobalStorage(data.defaultStorageStrategy ?? "MINIO");
        }
      } catch (err) {
        console.error("Erro ao obter configurações:", err);
      }
    };

    void fetchProfiles();
    void fetchSettings();
  }, []);

  const validateFile = (f: File) => {
    const isVideo = f.type.startsWith("video/") || f.name.endsWith(".mxf") || f.name.endsWith(".mov") || f.name.endsWith(".mp4");
    if (!isVideo) {
      toast({
        title: "Tipo de ficheiro não suportado",
        description: `${f.name} não parece ser um vídeo válido.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const extractMetadata = (file: File): Promise<{ resolution?: string; duration?: number }> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("video/")) {
        resolve({});
        return;
      }

      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve({
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          duration: video.duration,
        });
      };
      video.onerror = () => {
        resolve({});
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const addFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;
    
    const validItems: UploadItem[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      if (validateFile(f)) {
        const metadata = await extractMetadata(f);
        const ext = f.name.split(".").pop()?.toUpperCase() || "???";
        
        validItems.push({
          id: Math.random().toString(36).substring(7),
          file: f,
          progress: 0,
          status: "idle",
          profileId: globalProfile,
          storageStrategy: globalStorage,
          keepOriginal: globalKeep,
          resolution: metadata.resolution,
          duration: metadata.duration,
          extension: ext,
        });
      }
    }
    
    setFiles((prev) => [...prev, ...validItems]);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    void addFiles(e.dataTransfer.files);
  }, [globalProfile, globalStorage, globalKeep]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileConfig = (id: string, updates: Partial<UploadItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const uploadSingleFile = async (item: UploadItem) => {
    if (item.status === "uploading" || item.status === "success") return;

    setFiles((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: "uploading", error: undefined } : f))
    );

    const formData = new FormData();
    formData.append("file", item.file);

    const url = new URL(uploadUrl);
    url.searchParams.set("profile", item.profileId);
    url.searchParams.set("storageStrategy", item.storageStrategy);
    url.searchParams.set("keepOriginal", String(item.keepOriginal));

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url.toString());
      
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: "success", progress: 100 } : f))
          );
        } else {
          let msg = "Erro no upload";
          try { msg = JSON.parse(xhr.responseText)?.message || xhr.statusText; } catch { msg = xhr.statusText; }
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: "error", error: msg } : f))
          );
        }
        resolve();
      };

      xhr.onerror = () => {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "error", error: "Erro de rede" } : f))
        );
        resolve();
      };

      xhr.send(formData);
    });
  };

  const startAllUploads = async () => {
    const idleFiles = files.filter((f) => f.status === "idle" || f.status === "error");
    if (idleFiles.length === 0) return;

    // Parallel upload of all idle files
    await Promise.all(idleFiles.map((f) => uploadSingleFile(f)));
    
    const allDone = files.every(f => f.status === "success");
    if (allDone) {
      toast({ title: "Todos os uploads concluídos com sucesso!" });
      onAllComplete?.();
    }
  };

  const applyGlobalToIdle = () => {
    setFiles(prev => prev.map(f => {
      if (f.status === "idle" || f.status === "error") {
        return {
          ...f,
          profileId: globalProfile,
          storageStrategy: globalStorage,
          keepOriginal: globalKeep
        };
      }
      return f;
    }));
    toast({ title: "Configurações aplicadas à fila" });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Zona de Drop Principal */}
      <div
        className={cn(
          "relative group overflow-hidden rounded-2xl border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/20 bg-card hover:border-primary/50 hover:bg-accent/50"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById("multi-upload")?.click()}
      >
        <input
          id="multi-upload"
          type="file"
          multiple
          className="hidden"
          accept="video/*,.mxf,.mov,.mp4"
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Carregamento Múltiplo Paralelo</h2>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm">
            Arraste vários ficheiros de vídeo para aqui ou clique para selecionar.
            Formatos suportados: MP4, MOV, MXF (ProRes, DNxHD, etc).
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <>
          {/* Configurações Globais */}
          <Card className="border-primary/20 shadow-lg overflow-hidden">
            <div 
              className="bg-primary/5 px-4 py-3 flex items-center justify-between cursor-pointer border-b"
              onClick={() => setShowGlobalSettings(!showGlobalSettings)}
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm uppercase tracking-wider">Configuração Global da Fila</span>
              </div>
              {showGlobalSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            {showGlobalSettings && (
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Perfil Padrão</Label>
                    <Select value={globalProfile} onValueChange={setGlobalProfile}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Armazenamento</Label>
                    <div className="flex bg-muted p-1 rounded-md h-10">
                      <button
                        onClick={() => setGlobalStorage("MINIO")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded text-xs font-medium transition-all",
                          globalStorage === "MINIO" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="h-3.5 w-3.5" /> Cloud
                      </button>
                      <button
                        onClick={() => setGlobalStorage("LOCAL")}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 rounded text-xs font-medium transition-all",
                          globalStorage === "LOCAL" ? "bg-background shadow-sm text-green-600" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <HardDrive className="h-3.5 w-3.5" /> Local
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Retenção</Label>
                    <div className="flex items-center justify-between h-10 px-3 bg-muted rounded-md">
                      <span className="text-xs">Manter original</span>
                      <button onClick={() => setGlobalKeep(!globalKeep)}>
                        {globalKeep ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={applyGlobalToIdle} className="gap-2 border-primary/30 text-primary hover:bg-primary/5">
                    Aplicar configurações a todos os pendentes
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Lista de Ficheiros */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold flex items-center gap-2">
                Fila de Upload 
                <Badge variant="secondary" className="rounded-full px-2 py-0">{files.length}</Badge>
              </h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setFiles([])} 
                  disabled={files.some(f => f.status === "uploading")}
                >
                  Limpar Tudo
                </Button>
                <Button 
                  size="sm" 
                  onClick={startAllUploads} 
                  disabled={files.some(f => f.status === "uploading") || files.every(f => f.status === "success")}
                  className="gap-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Iniciar Todos
                </Button>
              </div>
            </div>

            {files.map((item) => (
              <Card key={item.id} className={cn(
                "transition-all border-l-4",
                item.status === "success" ? "border-l-green-500" : 
                item.status === "error" ? "border-l-red-500" : 
                item.status === "uploading" ? "border-l-primary" : "border-l-muted"
              )}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Info Ficheiro */}
                    <div className="flex gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "p-3 rounded-lg shrink-0 h-14 w-14 flex flex-col items-center justify-center relative border shadow-inner",
                          item.status === "success" ? "bg-green-100 border-green-200 text-green-600" : "bg-muted border-muted-foreground/10 text-primary"
                        )}>
                          {item.status === "uploading" ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <>
                              <FileType className="h-5 w-5 mb-0.5 opacity-50" />
                              <span className="text-[10px] font-black tracking-tighter leading-none">{item.extension}</span>
                            </>
                          )}
                          {item.status === "success" && (
                            <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-0.5 text-white border-2 border-background">
                              <CheckCircle2 className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold truncate text-sm" title={item.file.name}>{item.file.name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                              {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                            {item.resolution && (
                              <div className="flex items-center gap-1 text-[10px] text-primary font-bold">
                                <Monitor className="h-3 w-3" />
                                {item.resolution}
                              </div>
                            )}
                            {item.duration && (
                              <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                                <Clock className="h-3 w-3" />
                                {Math.floor(item.duration / 60)}:{(Math.floor(item.duration % 60)).toString().padStart(2, '0')}
                              </div>
                            )}
                          </div>
                        
                        {/* Barra de Progresso */}
                        {(item.status === "uploading" || item.status === "success" || item.status === "error") && (
                          <div className="mt-2 space-y-1">
                            <Progress value={item.progress} className="h-1.5" />
                            {item.error && <p className="text-[10px] text-red-500 font-medium">{item.error}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Config Individual (só se idle/error) */}
                    {(item.status === "idle" || item.status === "error") ? (
                      <div className="flex flex-wrap items-center gap-3 md:border-l md:pl-4">
                        <Select 
                          value={item.profileId} 
                          onValueChange={(v) => updateFileConfig(item.id, { profileId: v })}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <div className="flex bg-muted rounded h-8 p-0.5">
                          <button 
                            onClick={() => updateFileConfig(item.id, { storageStrategy: "MINIO" })}
                            className={cn("px-2 rounded text-[10px] font-bold", item.storageStrategy === "MINIO" ? "bg-background shadow-sm" : "text-muted-foreground")}
                          >
                            CLOUD
                          </button>
                          <button 
                            onClick={() => updateFileConfig(item.id, { storageStrategy: "LOCAL" })}
                            className={cn("px-2 rounded text-[10px] font-bold", item.storageStrategy === "LOCAL" ? "bg-background shadow-sm text-green-600" : "text-muted-foreground")}
                          >
                            LOCAL
                          </button>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFile(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-xs font-medium md:border-l md:pl-4 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground uppercase text-[9px]">Configuração</span>
                          <span>{profiles.find(p => p.id === item.profileId)?.name}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground uppercase text-[9px]">Destino</span>
                          <span className={item.storageStrategy === "LOCAL" ? "text-green-600" : "text-blue-500"}>
                            {item.storageStrategy}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <span className={cn(
      "text-[10px] font-bold px-1.5 py-0.5 rounded",
      variant === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </span>
  );
}
