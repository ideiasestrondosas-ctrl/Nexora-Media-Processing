"use client";

import { useEffect, useState } from "react";
import { QCReportViewer, QCIssue } from "@/components/assets/QCReportViewer";
import { JobTimeline, JobEvent } from "@/components/assets/JobTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, PlayCircle, RefreshCw, Trash2, Loader2, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AssetDetail {
  id: string;
  filename: string;
  status: string;
  mimeType: string | null;
  size: string | null;
  sha256: string | null;
  profile: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetJob {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface AssetQC {
  id: string;
  decision: string;
  summary: string;
  results: any[];
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING:          { color: "bg-muted text-muted-foreground", label: "Pendente" },
  INGESTING:        { color: "bg-blue-500/20 text-blue-600 dark:text-blue-400", label: "A ingerir" },
  QC_RUNNING:       { color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400", label: "QC em curso" },
  QC_PASSED:        { color: "bg-green-500/20 text-green-600 dark:text-green-400", label: "QC aprovado" },
  QC_QUARANTINED:   { color: "bg-orange-500/20 text-orange-600 dark:text-orange-400", label: "Em quarentena" },
  QC_REJECTED:      { color: "bg-red-500/20 text-red-600 dark:text-red-400", label: "QC rejeitado" },
  TRANSCODING:      { color: "bg-blue-500/20 text-blue-600 dark:text-blue-400", label: "A transcodificar" },
  AUDIO_PROCESSING: { color: "bg-purple-500/20 text-purple-600 dark:text-purple-400", label: "Processar áudio" },
  DELIVERING:       { color: "bg-teal-500/20 text-teal-600 dark:text-teal-400", label: "A entregar" },
  COMPLETED:        { color: "bg-green-600 text-white", label: "Concluído" },
  FAILED:           { color: "bg-destructive text-destructive-foreground", label: "Falhado" },
  DELETED:          { color: "bg-muted text-muted-foreground", label: "Apagado" },
};

function jobsToTimeline(jobs: AssetJob[]): JobEvent[] {
  const typeLabel: Record<string, string> = {
    INGEST:   "Análise de Metadados",
    QC:       "Controlo de Qualidade",
    TRANSCODE:"Transcodificação de Vídeo",
    AUDIO:    "Processamento de Áudio",
    PROXY:    "Geração de Proxy",
    DELIVERY: "Entrega",
  };
  return jobs.map(j => ({
    status: j.status === "COMPLETED" ? "COMPLETED"
           : j.status === "FAILED"    ? "FAILED"
           : "RUNNING",
    name: typeLabel[j.type] ?? j.type,
    timestamp: j.startedAt ?? j.createdAt,
    durationMs: j.completedAt && j.startedAt
      ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
      : undefined,
    error: j.error ?? undefined,
  }));
}

function qcToIssues(qc: AssetQC): QCIssue[] {
  if (!Array.isArray(qc.results)) return [];
  return qc.results
    .filter((r: any) => r.passed === false)
    .map((r: any) => ({
      category: r.category ?? "GENERAL",
      severity: r.severity ?? "WARNING",
      ruleId: r.ruleId ?? r.rule ?? "UNKNOWN",
      message: r.message ?? r.description ?? "Falha sem descrição",
      details: r.details ?? undefined,
    }));
}

export default function AssetDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [jobs, setJobs] = useState<AssetJob[]>([]);
  const [qcReport, setQcReport] = useState<AssetQC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const assetData = await api.get<AssetDetail>(`/assets/${id}`);
      setAsset(assetData);

      try {
        const jobsData = await api.get<{ jobs: AssetJob[] } | AssetJob[]>(`/assets/${id}/jobs`);
        setJobs(Array.isArray(jobsData) ? jobsData : (jobsData as any)?.jobs ?? []);
      } catch {
        setJobs([]);
      }

      try {
        const qcData = await api.get<{ reports: AssetQC[] } | AssetQC>(`/assets/${id}/qc`);
        const report = Array.isArray((qcData as any)?.reports)
          ? (qcData as any).reports[0]
          : qcData;
        setQcReport(report ?? null);
      } catch {
        setQcReport(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar asset.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [id]);

  const handleDelete = async () => {
    if (confirm("Tem a certeza que deseja apagar este asset?")) {
      try {
        await api.delete(`/assets/${id}`);
        router.push("/assets");
      } catch {
        alert("Erro ao apagar asset.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <p>A processar informações do asset...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-destructive">
        <AlertCircle className="h-10 w-10 mb-4" />
        <p className="font-bold">{error ?? "Asset não encontrado."}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/assets">Voltar à Biblioteca</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG.PENDING;
  const timeline = jobsToTimeline(jobs);
  const qcIssues = qcReport ? qcToIssues(qcReport) : [];
  
  // Garantir que mostramos o relatório se existir, independentemente da decisão
  const qcStatus = qcReport ? (
    qcReport.decision === "PASS" ? "PASS" : 
    qcReport.decision === "REJECT" ? "REJECT" : "QUARANTINE"
  ) : null;

  const meta = asset.metadata ?? {};
  
  // Suporte a ambos os formatos: FFprobe (streams) e MediaInfo (media.track)
  const tracks = (meta as any).media?.track ?? [];
  const miVideo = tracks.find((t: any) => t["@type"] === "Video") ?? {};
  const miAudio = tracks.find((t: any) => t["@type"] === "Audio") ?? {};
  const miGeneral = tracks.find((t: any) => t["@type"] === "General") ?? {};

  const videoStream = miVideo.Format ? miVideo : (meta.streams?.find((s: any) => s.codec_type === "video") ?? {});
  const audioStream = miAudio.Format ? miAudio : (meta.streams?.find((s: any) => s.codec_type === "audio") ?? {});
  const formatInfo = miGeneral.Format ? miGeneral : (meta.format ?? {});

  // Funções de Formatação
  const formatFileSize = (bytes: string | number | null) => {
    if (!bytes) return "—";
    const b = Number(bytes);
    if (b === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: string | number | null) => {
    if (!seconds) return "—";
    const s = Math.round(Number(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return [hrs, mins, secs]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  const formatFrameRate = (fps: string | number | null) => {
    if (!fps) return "—";
    const f = Number(fps);
    if (isNaN(f)) return fps.toString();
    // Arredondar para 2 ou 3 casas se não for inteiro, mas remover zeros desnecessários
    return parseFloat(f.toFixed(3)).toString() + " fps";
  };

  const getProfileName = (id: string | null) => {
    if (!id) return "Padrão";
    const names: Record<string, string> = {
      'broadcast-hd': 'Broadcast HD',
      'ott-high': 'OTT High Quality',
      'web-standard': 'Web Standard',
      'social-media': 'Social Media',
      'proxy-low': 'Proxy Low-Res'
    };
    return names[id] || id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  };

  // Mapeamento de campos técnicos (Normalização entre MediaInfo e FFprobe)
  const technicalData = {
    format: formatInfo.Format ?? formatInfo.format_long_name ?? formatInfo.format_name ?? asset.mimeType ?? "—",
    videoCodec: videoStream.Format ?? videoStream.codec_name ?? "—",
    resolution: videoStream.Width ? `${videoStream.Width}×${videoStream.Height}` : (videoStream.width ? `${videoStream.width}×${videoStream.height}` : "—"),
    frameRate: formatFrameRate(videoStream.FrameRate ?? videoStream.avg_frame_rate),
    audioCodec: audioStream.Format ?? audioStream.codec_name ?? "—",
    duration: formatDuration(formatInfo.Duration ?? formatInfo.duration),
  };

  const formattedSize = formatFileSize(asset.size);

  // Análises técnicas detalhadas (MediaAnalysis)
  const mediaAnalyses = (asset as any).mediaAnalyses || [];
  const preEncode = mediaAnalyses.find((a: any) => a.phase === 'PRE_ENCODE');
  const postEncode = mediaAnalyses.find((a: any) => a.phase === 'POST_ENCODE');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/assets"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{asset.filename}</h1>
              <Badge className={cn("font-bold", statusConfig.color)}>{statusConfig.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">ID: {asset.id}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Apagar
          </Button>
          {(asset as any).downloadUrl && (
            <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white" asChild>
              <a href={(asset as any).downloadUrl} download={asset.filename}>
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Player de Vídeo ou Placeholder */}
          <Card className="bg-black text-white overflow-hidden border-border/50 shadow-2xl">
            {(asset as any).downloadUrl ? (
              <video 
                controls 
                className="w-full aspect-video bg-black" 
                poster={(asset as any).thumbnailUrl || "/api/placeholder/video"}
              >
                <source src={(asset as any).downloadUrl} type={asset.mimeType ?? "video/mp4"} />
                O seu browser não suporta o elemento de vídeo.
              </video>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground/40 relative">
                <PlayCircle className="h-20 w-20 mb-4 opacity-20" />
                <p className="text-sm font-medium tracking-wide uppercase">Preview indisponível</p>
                <div className="absolute bottom-4 right-4">
                  <Badge variant="outline" className="bg-white/5 text-white/50 border-white/10 backdrop-blur-sm">
                    {asset.mimeType ?? "Video"}
                  </Badge>
                </div>
              </div>
            )}
          </Card>

          {/* Análise Técnica Avançada (MediaInfo Deep) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Análise Técnica Avançada</h2>
            </div>
            
            {preEncode ? (
              <Card>
                <CardHeader className="py-3 bg-muted/30">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider">Metadados Source (MediaInfo Deep)</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">Codec/Profile</p>
                    <p className="font-mono font-bold">{preEncode.videoCodec} ({preEncode.videoProfile})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Scan Type</p>
                    <p className="font-mono font-bold">{preEncode.scanType} {preEncode.scanOrder ? `(${preEncode.scanOrder})` : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">HDR Format</p>
                    <p className="font-mono font-bold">{preEncode.hdrFormat || 'SDR'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">GOP</p>
                    <p className="font-mono font-bold">{preEncode.gopType} (Size: {preEncode.gopSize})</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Color Space</p>
                    <p className="font-mono font-bold">{preEncode.colorSpace} / {preEncode.colourRange}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Bit Depth</p>
                    <p className="font-mono font-bold">{preEncode.bitDepth} bit</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed py-4 text-center text-muted-foreground text-sm">
                Aguardando análise técnica profunda...
              </Card>
            )}
          </div>

          {/* QC Report Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Relatório de Qualidade (QC)</h2>
            </div>
            
            {qcReport ? (
              <QCReportViewer issues={qcIssues} overallStatus={qcStatus as any} />
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="p-3 bg-muted rounded-full mb-3">
                    <Loader2 className="h-6 w-6 animate-spin opacity-30" />
                  </div>
                  <p className="text-sm">A aguardar conclusão do processo de QC...</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* QC Pós-Encode (Diferencial) */}
          {postEncode && postEncode.comparisonResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">QC Pós-Encode (Comparativo)</h2>
              </div>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-background rounded border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Bitrate Ratio</p>
                      <p className={cn("font-bold", (postEncode.comparisonResult as any).qualityIndicators.bitrateRatio < 0.3 ? "text-red-500" : "text-green-500")}>
                        {((postEncode.comparisonResult as any).qualityIndicators.bitrateRatio * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Duration Delta</p>
                      <p className={cn("font-bold", Math.abs((postEncode.comparisonResult as any).qualityIndicators.durationDelta) > 0.5 ? "text-red-500" : "text-green-500")}>
                        {(postEncode.comparisonResult as any).qualityIndicators.durationDelta.toFixed(3)}s
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">File Size Ratio</p>
                      <p className="font-bold">
                        {((postEncode.comparisonResult as any).qualityIndicators.fileSizeRatio).toFixed(2)}x
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Fast Start</p>
                      <p className={cn("font-bold", postEncode.isStreamable ? "text-green-500" : "text-orange-500")}>
                        {postEncode.isStreamable ? "SIM" : "NÃO"}
                      </p>
                    </div>
                  </div>
                  
                  {(postEncode.comparisonResult as any).videoChanged?.length > 0 && (
                    <div className="mt-4 p-3 bg-background rounded border text-[11px]">
                      <p className="font-bold mb-2 uppercase text-muted-foreground">Alterações de Vídeo:</p>
                      <div className="space-y-1">
                        {(postEncode.comparisonResult as any).videoChanged.map((diff: any) => (
                          <div key={diff.field} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                            <span className="font-medium">{diff.field}</span>
                            <span>{diff.before} → <span className="font-bold">{diff.after}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          {/* Metadados */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Metadados Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-sm">
              {[
                { label: "Ficheiro", value: asset.filename },
                { label: "Formato", value: technicalData.format },
                { label: "Codec Vídeo", value: technicalData.videoCodec.toUpperCase() },
                { label: "Resolução", value: technicalData.resolution },
                { label: "Framerate", value: technicalData.frameRate },
                { label: "Codec Áudio", value: technicalData.audioCodec.toUpperCase() },
                { label: "Duração", value: technicalData.duration },
                { label: "Tamanho", value: formattedSize },
                { label: "Perfil", value: getProfileName(asset.profile) },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4 pb-2 border-b last:border-0 last:pb-0 border-border/50">
                  <span className="text-muted-foreground font-medium">{row.label}</span>
                  <span className="font-mono text-right truncate max-w-[180px]" title={row.value}>
                    {row.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Timeline de jobs */}
          <div className="space-y-4">
            <div className="px-2">
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Histórico de Processamento</h2>
            </div>
            {timeline.length > 0 ? (
              <JobTimeline events={timeline} />
            ) : (
              <p className="text-xs text-muted-foreground px-2 italic">Nenhuma atividade registada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
