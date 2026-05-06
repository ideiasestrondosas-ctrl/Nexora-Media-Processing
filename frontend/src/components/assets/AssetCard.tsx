import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Film, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface AssetCardProps {
  asset: {
    id: string;
    filename: string;
    status: string;
    profile: string | null;
    size?: string | null;
    mimeType?: string;
    createdAt: string;
    progress?: number;
    thumbnailUrl?: string | null;
  };
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PENDING:          { color: "bg-slate-500", icon: Clock, label: "Pendente" },
  INGESTING:        { color: "bg-blue-400",  icon: Loader2, label: "A ingerir" },
  QC_RUNNING:       { color: "bg-yellow-500", icon: Loader2, label: "QC" },
  QC_PASSED:        { color: "bg-green-500", icon: CheckCircle2, label: "QC OK" },
  QC_QUARANTINE:    { color: "bg-orange-500", icon: AlertCircle, label: "Quarentena" },
  QC_REJECTED:      { color: "bg-red-500", icon: AlertCircle, label: "Rejeitado" },
  TRANSCODING:      { color: "bg-blue-600", icon: Loader2, label: "Transcode" },
  AUDIO_PROCESSING: { color: "bg-purple-500", icon: Loader2, label: "Áudio" },
  DELIVERING:       { color: "bg-teal-500", icon: Loader2, label: "Entrega" },
  COMPLETED:        { color: "bg-green-600", icon: CheckCircle2, label: "Concluído" },
  FAILED:           { color: "bg-red-600", icon: AlertCircle, label: "Falhado" },
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

const formatFileSize = (bytes: string | number | undefined | null) => {
  if (!bytes) return "—";
  const b = Number(bytes);
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function AssetCard({ asset }: AssetCardProps) {
  const status = statusConfig[asset.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;

  return (
    <Link href={`/assets/${asset.id}`} className="block group">
      <Card className="h-full overflow-hidden transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700 flex flex-col">
        {/* Thumbnail Preview Area */}
        <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
          {asset.thumbnailUrl ? (
            <img 
              src={asset.thumbnailUrl} 
              alt={asset.filename}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-20">
              <Film className="h-10 w-10 text-white" />
              <span className="text-[10px] text-white font-bold tracking-tighter uppercase">Sem Preview</span>
            </div>
          )}
          <Badge className={`absolute top-2 right-2 border-none shadow-lg ${status.color} text-white`}>
            {asset.status === 'INGESTING' || asset.status === 'TRANSCODING' ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <StatusIcon className="h-3 w-3 mr-1" />
            )}
            {status.label}
          </Badge>
        </div>

        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate" title={asset.filename}>
              {asset.filename}
            </h3>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 flex-grow">
          <div className="flex flex-col gap-2 text-[13px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between items-center">
              <span>Perfil:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {getProfileName(asset.profile)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Tamanho:</span>
              <span className="font-mono">
                {formatFileSize(asset.size)}
              </span>
            </div>
          </div>

          {(asset.status === "INGESTING" || asset.status === "TRANSCODING" || asset.status === "QC_RUNNING") && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                <span>Progresso</span>
                <span>{asset.progress ?? 0}%</span>
              </div>
              <Progress value={asset.progress ?? 0} className="h-1.5" />
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-3 text-[11px] text-slate-400 flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 mt-auto bg-slate-50/30 dark:bg-slate-900/30">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true, locale: pt })}
        </CardFooter>
      </Card>
    </Link>
  );
}
