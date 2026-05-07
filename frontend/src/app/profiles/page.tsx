"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Check, 
  Settings2, 
  Video, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  AlertTriangle,
  Search,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Activity,
  Zap
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Opções válidas ────────────────────────────────────────────────

const CONTAINERS = ["mp4", "mov", "mkv", "mxf", "ts", "avi"];
const VIDEO_CODECS = ["h264", "h265", "hevc", "prores", "prores_hq", "dnxhd", "vp9", "av1", "copy"];
const AUDIO_CODECS = ["aac", "ac3", "eac3", "pcm_s16le", "pcm_s24le", "opus", "flac", "mp3", "copy"];

const CONTAINER_VIDEO_COMPAT: Record<string, string[]> = {
  mp4: ["h264", "h265", "hevc", "copy"],
  mov: ["h264", "h265", "hevc", "prores", "prores_hq", "copy"],
  mkv: ["h264", "h265", "hevc", "vp9", "av1", "dnxhd", "copy"],
  mxf: ["prores", "prores_hq", "dnxhd", "copy"],
  ts:  ["h264", "h265", "hevc", "copy"],
  avi: ["h264", "copy"],
};

const CONTAINER_AUDIO_COMPAT: Record<string, string[]> = {
  mp4: ["aac", "ac3", "eac3", "mp3", "copy"],
  mov: ["aac", "pcm_s16le", "pcm_s24le", "ac3", "copy"],
  mkv: ["aac", "ac3", "eac3", "flac", "opus", "mp3", "copy"],
  mxf: ["pcm_s16le", "pcm_s24le", "copy"],
  ts:  ["aac", "ac3", "eac3", "copy"],
  avi: ["aac", "mp3", "ac3", "copy"],
};

function getCompatWarning(container: string, videoCodec: string, audioCodec: string): string | null {
  const validVideo = CONTAINER_VIDEO_COMPAT[container] ?? [];
  const validAudio = CONTAINER_AUDIO_COMPAT[container] ?? [];
  const issues: string[] = [];
  if (videoCodec && !validVideo.includes(videoCodec)) {
    issues.push(`Codec de vídeo "${videoCodec}" não é compatível com container "${container}"`);
  }
  if (audioCodec && !validAudio.includes(audioCodec)) {
    issues.push(`Codec de áudio "${audioCodec}" não é compatível com container "${container}"`);
  }
  return issues.length > 0 ? issues.join(". ") : null;
}

// ── Tipos ─────────────────────────────────────────────────────────

interface Profile {
  id: string;
  name: string;
  description: string | null;
  container: string;
  videoCodec: string;
  audioCodec: string;
  settings: Record<string, any>;
  isDefault: boolean;
  isSystem: boolean;
}

interface ProfileFormData {
  name: string;
  description: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  bitrateKbps: string;
  resolution: string;
  isDefault: boolean;
}

const RESOLUTIONS = ["Original", "1920x1080", "1280x720", "3840x2160", "640x360"];

const emptyForm: ProfileFormData = {
  name: "",
  description: "",
  container: "mp4",
  videoCodec: "h264",
  audioCodec: "aac",
  bitrateKbps: "4000",
  resolution: "Original",
  isDefault: false,
};

// ── Modal de criação/edição ───────────────────────────────────────

function ProfileModal({
  profile,
  onClose,
  onSave,
  isLoading,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ProfileFormData>(
    profile
      ? {
          name: profile.name,
          description: profile.description ?? "",
          container: profile.container,
          videoCodec: profile.videoCodec,
          audioCodec: profile.audioCodec,
          bitrateKbps: String(profile.settings?.bitrateKbps ?? 4000),
          resolution: profile.settings?.resolution ?? "Original",
          isDefault: profile.isDefault,
        }
      : emptyForm
  );

  const warning = getCompatWarning(form.container, form.videoCodec, form.audioCodec);

  const handleContainerChange = (container: string) => {
    const validVideo = CONTAINER_VIDEO_COMPAT[container] ?? [];
    const validAudio = CONTAINER_AUDIO_COMPAT[container] ?? [];
    setForm(prev => ({
      ...prev,
      container,
      videoCodec: validVideo.includes(prev.videoCodec) ? prev.videoCodec : (validVideo[0] ?? "h264"),
      audioCodec: validAudio.includes(prev.audioCodec) ? prev.audioCodec : (validAudio[0] ?? "aac"),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (warning) return;
    onSave({
      name: form.name,
      description: form.description || undefined,
      container: form.container,
      videoCodec: form.videoCodec,
      audioCodec: form.audioCodec,
      settings: { 
        bitrateKbps: Number(form.bitrateKbps),
        resolution: form.resolution,
      },
      isDefault: form.isDefault,
    });
  };

  const validVideoCodecs = CONTAINER_VIDEO_COMPAT[form.container] ?? VIDEO_CODECS;
  const validAudioCodecs = CONTAINER_AUDIO_COMPAT[form.container] ?? AUDIO_CODECS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">
              {profile ? "Editar Perfil" : "Novo Perfil de Encoding"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Nome do Perfil *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: nexora_4k_master"
                required
                className="bg-muted/30"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição técnica do objetivo deste perfil"
                className="bg-muted/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Container *</Label>
              <Select value={form.container} onValueChange={handleContainerChange}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINERS.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono uppercase">{c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Bitrate Vídeo (Kbps) *</Label>
              <Input
                type="number"
                value={form.bitrateKbps}
                onChange={(e) => setForm({ ...form, bitrateKbps: e.target.value })}
                placeholder="4000"
                min={100}
                required
                className="bg-muted/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Resolução *</Label>
              <Select value={form.resolution} onValueChange={(v) => setForm({ ...form, resolution: v })}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map(r => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Codec de Vídeo *</Label>
              <Select value={form.videoCodec} onValueChange={(v) => setForm({ ...form, videoCodec: v })}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validVideoCodecs.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono">{c === 'copy' ? 'Original (Copy)' : c.toUpperCase()}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Codec de Áudio *</Label>
              <Select value={form.audioCodec} onValueChange={(v) => setForm({ ...form, audioCodec: v })}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validAudioCodecs.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono">{c === 'copy' ? 'Original (Copy)' : c.toUpperCase()}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10 mt-2">
              <input
                id="isDefault"
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <div>
                <Label htmlFor="isDefault" className="cursor-pointer font-bold text-sm">
                  Perfil por defeito
                </Label>
                <p className="text-[10px] text-muted-foreground">Este perfil será selecionado automaticamente para novos uploads.</p>
              </div>
            </div>
          </div>

          {warning && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm">{warning}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <Button type="button" variant="ghost" onClick={onClose} className="font-bold">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !!warning} className="font-bold px-8">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {warning ? "Corrija a incompatibilidade" : profile ? "Guardar Alterações" : "Criar Perfil"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────

export default function ProfilesPage() {
  const queryClient = useQueryClient();
  const [modalProfile, setModalProfile] = useState<Profile | "new" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ profiles: Profile[]; count: number }>({
    queryKey: ["profiles"],
    queryFn: () => api.get("/profiles"),
  });

  const profiles = data?.profiles ?? [];

  // Filtragem de perfis
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [profiles, search]);

  // Perfil selecionado
  const selectedProfile = useMemo(() => {
    if (selectedProfileId) {
      return profiles.find(p => p.id === selectedProfileId) ?? null;
    }
    return filteredProfiles[0] ?? null;
  }, [profiles, selectedProfileId, filteredProfiles]);

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post("/profiles", body),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["profiles"] }); 
      setModalProfile(null); 
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/profiles/${id}`, body),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["profiles"] }); 
      setModalProfile(null); 
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/profiles/${id}`),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["profiles"] }); 
      setDeleteConfirm(null); 
      setSelectedProfileId(null);
    },
  });

  const handleSave = (formData: any) => {
    if (modalProfile === "new") {
      createMutation.mutate(formData);
    } else if (modalProfile) {
      updateMutation.mutate({ id: (modalProfile as Profile).id, body: formData });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="font-medium animate-pulse">A carregar biblioteca de perfis...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-destructive">
        <AlertCircle className="h-10 w-10 mb-4" />
        <p className="font-bold">Erro técnico ao carregar perfis.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <>
      {modalProfile !== null && (
        <ProfileModal
          profile={modalProfile === "new" ? null : modalProfile}
          onClose={() => setModalProfile(null)}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Apagar Perfil</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Esta ação é irreversível. Tem a certeza que quer apagar o perfil <strong>{deleteConfirm.name}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="font-bold">
                Cancelar
              </Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="font-bold">
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apagar Definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-140px)] flex flex-col gap-6 max-w-[1400px] mx-auto pb-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Perfis de Encoding</h1>
              <p className="text-muted-foreground text-sm">Gestão de presets profissionais HandBrake e FFmpeg.</p>
            </div>
          </div>
          <Button onClick={() => setModalProfile("new")} className="gap-2 font-bold px-6 h-11 shadow-lg shadow-primary/20">
            <Plus className="h-5 w-5" />
            Novo Perfil
          </Button>
        </div>

        {/* Layout Master-Detail */}
        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          {/* Coluna Master (Lista) */}
          <div className="w-80 flex flex-col gap-4 min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar perfis..." 
                className="pl-9 bg-card/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl opacity-40 italic text-sm">
                  Nenhum perfil encontrado.
                </div>
              ) : (
                filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all relative group",
                      selectedProfile?.id === p.id 
                        ? "bg-primary/10 border-primary shadow-sm" 
                        : "bg-card border-border/50 hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "font-bold text-sm truncate pr-2",
                        selectedProfile?.id === p.id ? "text-primary" : "text-foreground"
                      )}>
                        {p.name}
                      </span>
                      {p.isDefault && <Check className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] px-1 h-4 uppercase font-mono tracking-tighter bg-background/50">
                        {p.container}
                      </Badge>
                      {p.isSystem && (
                        <ShieldCheck className="h-3 w-3 text-blue-500/70" />
                      )}
                    </div>
                    {selectedProfile?.id === p.id && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Coluna Detail */}
          <div className="flex-1 min-w-0">
            {selectedProfile ? (
              <Card className="h-full border-2 shadow-xl bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col">
                <CardHeader className={cn(
                  "border-b flex flex-row items-center justify-between py-6",
                  selectedProfile.isSystem ? "bg-blue-500/5" : "bg-muted/30"
                )}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedProfile.isSystem ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary"
                      )}>
                        <Video className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                          {selectedProfile.name}
                          {selectedProfile.isDefault && <Badge className="bg-primary hover:bg-primary">Por Defeito</Badge>}
                          {selectedProfile.isSystem && <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">System</Badge>}
                        </CardTitle>
                        <CardDescription className="text-sm font-medium">{selectedProfile.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 font-bold"
                      onClick={() => setModalProfile(selectedProfile)}
                      disabled={selectedProfile.isSystem}
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 font-bold text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteConfirm(selectedProfile)}
                      disabled={selectedProfile.isDefault || selectedProfile.isSystem}
                    >
                      <Trash2 className="h-4 w-4" /> Apagar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Grelha de Parâmetros */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { label: "Container", value: selectedProfile.container.toUpperCase(), icon: Settings2 },
                      { label: "Video Codec", value: selectedProfile.videoCodec === 'copy' ? 'Original (Copy)' : selectedProfile.videoCodec.toUpperCase(), icon: Video },
                      { label: "Audio Codec", value: selectedProfile.audioCodec === 'copy' ? 'Original (Copy)' : selectedProfile.audioCodec.toUpperCase(), icon: Activity },
                      { label: "Resolução", value: selectedProfile.settings?.resolution ?? "Original", icon: ChevronRight },
                      { label: "Bitrate Est.", value: selectedProfile.settings?.bitrateKbps ? `${selectedProfile.settings.bitrateKbps} Kbps` : "Automático", icon: Zap },
                    ].map(item => (
                      <div key={item.label} className="p-4 bg-background border rounded-2xl shadow-sm group hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                          <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{item.label}</span>
                        </div>
                        <div className="text-lg font-mono font-bold tracking-tight">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detalhes JSON (Advanced) */}
                  <div className="space-y-4 pt-4">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Settings2 className="h-4 w-4" /> Parâmetros Adicionais (JSON)
                    </h4>
                    <pre className="p-6 bg-zinc-950 text-emerald-500 rounded-2xl font-mono text-xs overflow-x-auto border border-zinc-800 shadow-inner">
                      {JSON.stringify(selectedProfile.settings, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-3xl bg-card/20">
                <Settings2 className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium">Selecione um perfil para ver os detalhes técnicos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
