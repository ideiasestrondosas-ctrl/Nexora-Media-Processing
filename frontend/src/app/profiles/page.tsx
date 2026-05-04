"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Settings2, Video, Loader2, AlertCircle, Plus, Pencil, Trash2, X } from "lucide-react";
import { useQuery as useQueryRQ } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  isDefault: boolean;
}

const emptyForm: ProfileFormData = {
  name: "",
  description: "",
  container: "mp4",
  videoCodec: "h264",
  audioCodec: "aac",
  bitrateKbps: "4000",
  isDefault: false,
};

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
          isDefault: profile.isDefault,
        }
      : emptyForm
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      description: form.description || undefined,
      container: form.container,
      videoCodec: form.videoCodec,
      audioCodec: form.audioCodec,
      settings: { bitrateKbps: Number(form.bitrateKbps) },
      isDefault: form.isDefault,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold">
            {profile ? "Editar Perfil" : "Novo Perfil de Encoding"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nome do Perfil *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: nexora_4k_master"
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição do perfil"
              />
            </div>
            <div className="space-y-1">
              <Label>Container *</Label>
              <Input
                value={form.container}
                onChange={(e) => setForm({ ...form, container: e.target.value })}
                placeholder="mp4"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Codec de Vídeo *</Label>
              <Input
                value={form.videoCodec}
                onChange={(e) => setForm({ ...form, videoCodec: e.target.value })}
                placeholder="h264"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Codec de Áudio *</Label>
              <Input
                value={form.audioCodec}
                onChange={(e) => setForm({ ...form, audioCodec: e.target.value })}
                placeholder="aac"
                required
              />
            </div>
            <div className="space-y-1">
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
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="isDefault"
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              <Label htmlFor="isDefault" className="cursor-pointer">
                Perfil por defeito
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {profile ? "Guardar Alterações" : "Criar Perfil"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    },
  });

  const handleSave = (formData: any) => {
    if (modalProfile === "new") {
      createMutation.mutate(formData);
    } else if (modalProfile) {
      updateMutation.mutate({ id: (modalProfile as Profile).id, body: formData });
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>A carregar perfis de encoding...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p>Erro ao carregar perfis. Verifique a ligação ao servidor.</p>
      </div>
    );
  }

  const profiles = data.profiles;

  return (
    <>
      {/* Modal criar/editar */}
      {modalProfile !== null && (
        <ProfileModal
          profile={modalProfile === "new" ? null : modalProfile}
          onClose={() => setModalProfile(null)}
          onSave={handleSave}
          isLoading={isMutating}
        />
      )}

      {/* Modal confirmação apagar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Apagar Perfil</h3>
            <p className="text-slate-500 text-sm">
              Tem a certeza que quer apagar <strong>{deleteConfirm.name}</strong>? Esta acção é irreversível.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apagar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Perfis de Encoding</h1>
              <p className="text-slate-500 text-sm">
                Configure os parâmetros técnicos para transcodificação de ficheiros.
              </p>
            </div>
          </div>
          <Button onClick={() => setModalProfile("new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Perfil
          </Button>
        </div>

        <div className="grid gap-6">
          {profiles.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum perfil de encoding configurado.</p>
              <Button variant="outline" className="mt-4" onClick={() => setModalProfile("new")}>
                Criar primeiro perfil
              </Button>
            </div>
          )}
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader className="flex flex-row items-start justify-between bg-slate-50/50 dark:bg-slate-900/20 border-b">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="h-5 w-5 text-slate-400" />
                    {profile.name}
                    {profile.isDefault && (
                      <Badge className="ml-2 bg-blue-500">Por Defeito</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">{profile.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setModalProfile(profile)}
                    className="text-slate-500 hover:text-blue-600"
                    title="Editar perfil"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirm(profile)}
                    className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    title="Apagar perfil"
                    disabled={profile.isDefault}
                  >
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
                      <TableHead className="w-[100px] text-center">Activo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Container</TableCell>
                      <TableCell className="font-mono text-sm uppercase">{profile.container}</TableCell>
                      <TableCell className="text-center">
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Codec de Vídeo</TableCell>
                      <TableCell className="font-mono text-sm uppercase">{profile.videoCodec}</TableCell>
                      <TableCell className="text-center">
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Video Bitrate</TableCell>
                      <TableCell className="font-mono text-sm">
                        {profile.settings?.bitrateKbps
                          ? `${profile.settings.bitrateKbps} Kbps`
                          : "Auto"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Codec de Áudio</TableCell>
                      <TableCell className="font-mono text-sm uppercase">{profile.audioCodec}</TableCell>
                      <TableCell className="text-center">
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      </TableCell>
                    </TableRow>
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
