"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Settings2, Video, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

export default function ProfilesPage() {
  const { data, isLoading, isError } = useQuery<{ profiles: Profile[], count: number }>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles'),
  });

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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <Settings2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Encoding</h1>
          <p className="text-slate-500 text-sm">Configure os parâmetros técnicos para transcodificação de ficheiros.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {profiles.map(profile => (
          <Card key={profile.id}>
            <CardHeader className="flex flex-row items-start justify-between bg-slate-50/50 dark:bg-slate-900/20 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-slate-400" />
                  {profile.name}
                  {profile.isDefault && <Badge className="ml-2 bg-blue-500">Por Defeito</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">{profile.description}</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs text-slate-500">{profile.id}</Badge>
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
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Codec de Vídeo</TableCell>
                    <TableCell className="font-mono text-sm uppercase">{profile.videoCodec}</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Video Bitrate</TableCell>
                    <TableCell className="font-mono text-sm">
                      {profile.settings?.bitrateKbps ? `${profile.settings.bitrateKbps} Kbps` : 'Auto'}
                    </TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Codec de Áudio</TableCell>
                    <TableCell className="font-mono text-sm uppercase">{profile.audioCodec}</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
