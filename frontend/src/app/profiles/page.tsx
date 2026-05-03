import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Settings2, Video } from "lucide-react";

const PROFILES = [
  {
    id: "nexora_broadcast_hd",
    name: "Broadcast HD (XDCAM 50)",
    description: "Perfil standard para emissão linear TV. MXF OP1a, XDCAM HD422 a 50Mbps, Áudio EBU R128.",
    container: "MXF (OP1a)",
    videoCodec: "MPEG-2 (xdcamhd422)",
    bitrate: "50 Mbps",
    isDefault: true,
  },
  {
    id: "nexora_web_4k",
    name: "Web 4K UHD",
    description: "Alta qualidade para plataformas VOD. MP4, H.265 (HEVC), CRF 20.",
    container: "MP4",
    videoCodec: "H.265 / HEVC",
    bitrate: "VBR (CRF 20)",
    isDefault: false,
  },
  {
    id: "nexora_social_vertical",
    name: "Redes Sociais (Vertical)",
    description: "Optimizado para Instagram Reels e TikTok. 1080x1920, H.264, 8Mbps.",
    container: "MP4",
    videoCodec: "H.264 / AVC",
    bitrate: "8 Mbps",
    isDefault: false,
  }
];

export default function ProfilesPage() {
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
        {PROFILES.map(profile => (
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
                    <TableCell className="font-mono text-sm">{profile.container}</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Codec de Vídeo</TableCell>
                    <TableCell className="font-mono text-sm">{profile.videoCodec}</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Video Bitrate</TableCell>
                    <TableCell className="font-mono text-sm">{profile.bitrate}</TableCell>
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
