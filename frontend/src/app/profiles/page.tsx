"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Settings2, Video, Loader2, AlertCircle, Plus, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

// ── Opções válidas ────────────────────────────────────────────────

const CONTAINERS = ["mp4", "mov", "mkv", "mxf", "ts", "avi"];

const VIDEO_CODECS = ["h264", "h265", "hevc", "prores", "prores_hq", "dnxhd", "vp9", "av1", "copy"];

const AUDIO_CODECS = ["aac", "ac3", "eac3", "pcm_s16le", "pcm_s24le", "opus", "flac", "mp3", "copy"];

// Compatibilidade container → codecs permitidos
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
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">
            {profile ? "Editar Perfil" : "Novo Perfil de Encoding"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nome do Perfil *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: nexora_4k_master"
                required
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do perfil"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Container *</Label>
              <Select value={form.container} onValueChange={handleContainerChange}>
                <SelectTrigger>
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
              <Label>Bitrate de Vídeo (Kbps) *</Label>
              <Input
                type="number"
                value={form.bitrateKbps}
                onChange={(e) => setForm({ ...form, bitrateKbps: e.target.value })}
                placeholder="4000"
                min={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Resolução *</Label>
              <Select value={form.resolution} onValueChange={(v) => setForm({ ...form, resolution: v })}>
                <SelectTrigger>
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
              <Label>Codec de Vídeo *</Label>
              <Select value={form.videoCodec} onValueChange={(v) => setForm({ ...form, videoCodec: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validVideoCodecs.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono">{c === 'copy' ? 'Original (Copy)' : c}</span>
                    </SelectItem>
                  ))}
                  {VIDEO_CODECS.filter(c => !validVideoCodecs.includes(c)).map(c => (
                    <SelectItem key={c} value={c} disabled>
                      <span className="font-mono text-muted-foreground">{c} ✗</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Codec de Áudio *</Label>
              <Select value={form.audioCodec} onValueChange={(v) => setForm({ ...form, audioCodec: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validAudioCodecs.map(c => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono">{c === 'copy' ? 'Original (Copy)' : c}</span>
                    </SelectItem>
                  ))}
                  {AUDIO_CODECS.filter(c => !validAudioCodecs.includes(c)).map(c => (
                    <SelectItem key={c} value={c} disabled>
                      <span className="font-mono text-muted-foreground">{c} ✗</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                id="isDefault"
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Perfil por defeito
              </Label>
            </div>
          </div>

          {warning && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm">{warning}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !!warning}>
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

  const { data, isLoading, isError } = useQuery<{ profiles: Profile[]; count: number }>({
    queryKey: ["profiles"],
    queryFn: () => api.get("/profiles"),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post("/profiles", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profiles"] }); setModalProfile(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/profiles/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profiles"] }); setModalProfile(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/profiles/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profiles"] }); setDeleteConfirm(null); },
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
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>A carregar perfis de encoding...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p>Erro ao carregar perfis.</p>
      </div>
    );
  }

  const profiles = data.profiles;

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
            <h3 className="text-lg font-semibold">Apagar Perfil</h3>
            <p className="text-muted-foreground text-sm">
              Tem a certeza que quer apagar <strong>{deleteConfirm.name}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteConfirm.id)}>
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apagar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Perfis de Encoding</h1>
              <p className="text-muted-foreground text-sm">Configure os parâmetros técnicos de transcodificação.</p>
            </div>
          </div>
          <Button onClick={() => setModalProfile("new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Perfil
          </Button>
        </div>

        <div className="grid gap-6">
          {profiles.length === 0 && (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Nenhum perfil configurado.</p>
            </div>
          )}
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="flex flex-row items-start justify-between border-b bg-muted/20 rounded-t-xl">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="h-5 w-5 text-muted-foreground" />
                    {profile.name}
                    {profile.isDefault && <Badge className="ml-2">Padrão</Badge>}
                  </CardTitle>
                  <CardDescription className="mt-1">{profile.description}</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setModalProfile(profile)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(profile)} disabled={profile.isDefault} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Parâmetro</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-[100px] text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "Container", value: profile.container.toUpperCase() },
                      { label: "Codec de Vídeo", value: profile.videoCodec === 'copy' ? 'Original (Copy)' : profile.videoCodec.toUpperCase() },
                      { label: "Resolução", value: profile.settings?.resolution ?? "Original" },
                      { label: "Bitrate", value: profile.settings?.bitrateKbps ? `${profile.settings.bitrateKbps} Kbps` : "Auto" },
                      { label: "Codec de Áudio", value: profile.audioCodec === 'copy' ? 'Original (Copy)' : profile.audioCodec.toUpperCase() },
                    ].map(row => (
                      <TableRow key={row.label}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="font-mono text-sm">{row.value}</TableCell>
                        <TableCell className="text-center">
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
