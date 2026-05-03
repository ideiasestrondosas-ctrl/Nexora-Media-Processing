"use client";

import { useState, useCallback, useEffect } from "react";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Profile {
  id: string;
  name: string;
  description: string;
}

interface UploadZoneProps {
  onUploadStart?: (file: File) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadSuccess?: (assetId: string) => void;
  onUploadError?: (error: Error) => void;
  uploadUrl: string; // API endpoint
  token?: string | null;
}

export function UploadZone({
  onUploadStart,
  onUploadProgress,
  onUploadSuccess,
  onUploadError,
  uploadUrl,
  token
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("nexora_broadcast_hd");
  const { toast } = useToast();

  useEffect(() => {
    // Fetch disponíveis perfis
    const fetchProfiles = async () => {
      try {
        const data = await api.get<{ profiles: Profile[] }>('/profiles');
        if (data && data.profiles) {
          setProfiles(data.profiles);
          // Auto-select first profile if currently selected is not in list
          if (data.profiles.length > 0 && !data.profiles.find(p => p.id === selectedProfile)) {
            setSelectedProfile(data.profiles[0].id);
          }
        }
      } catch (err) {
        console.error("Erro a obter perfis:", err);
      }
    };
    void fetchProfiles();
  }, [selectedProfile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (file: File) => {
    // Validar apenas vídeo ou MXF
    if (!file.type.startsWith("video/") && !file.name.endsWith(".mxf")) {
      toast({
        title: "Tipo de ficheiro não suportado",
        description: "Apenas são permitidos ficheiros de vídeo (MP4, MXF, MOV, etc).",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const clearFile = () => {
    if (status === "uploading") return;
    setFile(null);
    setProgress(0);
    setStatus("idle");
  };

  const uploadFile = async () => {
    if (!file) return;

    setStatus("uploading");
    onUploadStart?.(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("profile", selectedProfile);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
          onUploadProgress?.(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus("success");
          try {
            const response = JSON.parse(xhr.responseText);
            onUploadSuccess?.(response.id || response.asset?.id);
            toast({
              title: "Upload concluído",
              description: "Ficheiro enviado com sucesso para a Nexora.",
            });
          } catch (e) {
            onUploadSuccess?.("unknown-id");
          }
        } else {
          setStatus("error");
          onUploadError?.(new Error(xhr.statusText));
          toast({
            title: "Erro no upload",
            description: "Ocorreu um erro ao enviar o ficheiro. Tente novamente.",
            variant: "destructive"
          });
        }
      };

      xhr.onerror = () => {
        setStatus("error");
        onUploadError?.(new Error("Network Error"));
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
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
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

            {status === "idle" && (
              <div className="flex justify-between items-center gap-3 border-t pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Perfil:</span>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={clearFile}>Cancelar</Button>
                  <Button onClick={uploadFile} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <UploadCloud className="h-4 w-4" />
                    Iniciar Upload
                  </Button>
                </div>
              </div>
            )}

            {(status === "uploading" || status === "success") && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600 dark:text-slate-400">
                    {status === "success" ? "Concluído!" : "A enviar para a cloud..."}
                  </span>
                  <span className={status === "success" ? "text-green-500" : "text-blue-600"}>
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            {status === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm mb-4">
                Falha no upload. O ficheiro pode ser demasiado grande ou ocorreu um erro de rede.
              </div>
            )}
            {status === "error" && (
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={clearFile}>Voltar</Button>
                <Button onClick={uploadFile} variant="default">Tentar Novamente</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
