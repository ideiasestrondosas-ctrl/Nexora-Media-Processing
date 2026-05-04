"use client";

import { QCReportViewer, QCIssue } from "@/components/assets/QCReportViewer";
import { JobTimeline, JobEvent } from "@/components/assets/JobTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, PlayCircle, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Mocks
const mockIssues: QCIssue[] = [
  { category: "VIDEO", severity: "WARNING", ruleId: "V_BITRATE_FLUCTUATION", message: "Bitrate drops below 5Mbps at 00:12:34", details: { time: 12.5, currentBitrate: 4.8 } },
  { category: "AUDIO", severity: "ERROR", ruleId: "A_LOUDNESS_EBU_R128", message: "Integrated loudness is -21 LUFS (target -23 LUFS)" }
];

const mockTimeline: JobEvent[] = [
  { status: "COMPLETED", name: "Upload via Web", timestamp: new Date(Date.now() - 3600000).toISOString(), durationMs: 120000 },
  { status: "COMPLETED", name: "Análise de Metadados", timestamp: new Date(Date.now() - 3400000).toISOString(), durationMs: 4500 },
  { status: "COMPLETED", name: "Quality Control (Pré)", timestamp: new Date(Date.now() - 3300000).toISOString(), durationMs: 45000 },
  { status: "FAILED", name: "Transcode Video (GPU)", timestamp: new Date(Date.now() - 3200000).toISOString(), durationMs: 15000, error: "NVIDIA NVENC Error: Out of memory" },
  { status: "RUNNING", name: "Transcode Video (CPU Fallback)", timestamp: new Date(Date.now() - 3100000).toISOString() }
];

export default function AssetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const handleDelete = async () => {
    if (confirm("Tem a certeza que deseja apagar este asset?")) {
      try {
        await api.delete(`/assets/${id}`);
        router.push("/assets");
      } catch (err) {
        alert("Erro ao apagar asset.");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/assets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">promo_final_v2.mp4</h1>
            <Badge className="bg-blue-500">A PROCESSAR</Badge>
          </div>
          <p className="text-sm text-slate-500 font-mono mt-1">ID: {id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> Recarregar</Button>
          <Button variant="destructive" className="gap-2" onClick={handleDelete}><Trash2 className="h-4 w-4" /> Apagar Asset</Button>
          <Button className="gap-2" disabled><Download className="h-4 w-4" /> Download Proxy</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 text-slate-100 overflow-hidden border-slate-800">
            <div className="aspect-video bg-black flex flex-col items-center justify-center text-slate-500 relative">
              <PlayCircle className="h-16 w-16 mb-4 opacity-50" />
              <p>O proxy de vídeo ainda não está disponível.</p>
              <div className="absolute top-4 left-4">
                <Badge variant="outline" className="bg-black/50 text-white border-white/20">Sem Preview</Badge>
              </div>
            </div>
          </Card>
          
          <QCReportViewer issues={mockIssues} overallStatus="QUARANTINE" />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md">Metadados Originais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Formato</span><span className="font-mono">QuickTime / MOV</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Codec de Vídeo</span><span className="font-mono">Apple ProRes 422</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Resolução</span><span className="font-mono">1920x1080</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Framerate</span><span className="font-mono">25.000 fps</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Canais de Áudio</span><span className="font-mono">2 (Stereo)</span></div>
              <div className="flex justify-between pb-1"><span className="text-slate-500">Tamanho</span><span className="font-mono">4.2 GB</span></div>
            </CardContent>
          </Card>

          <JobTimeline events={mockTimeline} />
        </div>
      </div>
    </div>
  );
}
