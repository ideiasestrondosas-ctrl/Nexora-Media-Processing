import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Film, Clock, HardDrive, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface AssetCardProps {
  asset: {
    id: string;
    originalName: string;
    status: string;
    profile: string;
    durationMs?: number;
    resolution?: string;
    createdAt: string;
    progress?: number;
  };
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  READY: { color: "bg-green-500", icon: CheckCircle2, label: "Pronto" },
  ERROR: { color: "bg-red-500", icon: AlertCircle, label: "Erro" },
  PROCESSING: { color: "bg-blue-500", icon: Loader2, label: "A processar" },
  UPLOADED: { color: "bg-slate-500", icon: HardDrive, label: "Recebido" },
  QUARANTINE: { color: "bg-yellow-500", icon: AlertCircle, label: "Quarentena" },
};

function formatDuration(ms?: number) {
  if (!ms) return "--:--";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AssetCard({ asset }: AssetCardProps) {
  const status = statusConfig[asset.status] || statusConfig.UPLOADED;
  const StatusIcon = status.icon;

  return (
    <Link href={`/assets/${asset.id}`} className="block group">
      <Card className="h-full transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700">
        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <Film className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <h3 className="font-semibold text-sm truncate" title={asset.originalName}>
              {asset.originalName}
            </h3>
          </div>
          <Badge variant="outline" className={`${status.color} text-white border-transparent flex items-center gap-1`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex justify-between items-center">
              <span>Perfil:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {asset.profile.replace("nexora_", "")}
              </Badge>
            </div>
            {asset.resolution && (
              <div className="flex justify-between items-center">
                <span>Resolução:</span>
                <span className="font-mono">{asset.resolution}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Duração:</span>
              <span className="font-mono">{formatDuration(asset.durationMs)}</span>
            </div>
          </div>

          {asset.status === "PROCESSING" && typeof asset.progress === "number" && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs font-medium text-blue-600 dark:text-blue-400">
                <span>Progresso</span>
                <span>{asset.progress}%</span>
              </div>
              <Progress value={asset.progress} className="h-1.5" />
            </div>
          )}
        </CardContent>
        <CardFooter className="p-4 pt-0 text-xs text-slate-400 flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 pt-3 mt-auto">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true, locale: pt })}
        </CardFooter>
      </Card>
    </Link>
  );
}
