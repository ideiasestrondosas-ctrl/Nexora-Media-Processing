import { CheckCircle2, Circle, Clock, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface JobEvent {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  name: string;
  timestamp: string;
  durationMs?: number;
  error?: string;
}

interface JobTimelineProps {
  events: JobEvent[];
}

export function JobTimeline({ events }: JobTimelineProps) {
  return (
    <Card>
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Histórico de Execução (Timeline)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative space-y-0 pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-3">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            let Icon = Circle;
            let iconColor = "text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-950";
            
            if (event.status === "COMPLETED") {
              Icon = CheckCircle2;
              iconColor = "text-green-500 bg-white dark:bg-slate-950";
            } else if (event.status === "RUNNING") {
              Icon = Loader2;
              iconColor = "text-blue-500 bg-white dark:bg-slate-950 animate-spin-slow";
            } else if (event.status === "FAILED") {
              Icon = AlertCircle;
              iconColor = "text-red-500 bg-white dark:bg-slate-950";
            }

            return (
              <div key={index} className={cn("relative pl-6 pb-6", isLast && "pb-0")}>
                <div className={cn("absolute -left-[1.35rem] top-0.5", iconColor)}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
                  <div>
                    <h4 className={cn("text-sm font-semibold", 
                      event.status === "FAILED" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                    )}>
                      {event.name}
                    </h4>
                    {event.error && (
                      <p className="text-sm text-red-500 mt-1">{event.error}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                    {event.durationMs && (
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm">
                        <Clock className="h-3 w-3" />
                        {(event.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    <time dateTime={event.timestamp}>
                      {format(new Date(event.timestamp), "HH:mm:ss · dd MMM yyyy", { locale: pt })}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
