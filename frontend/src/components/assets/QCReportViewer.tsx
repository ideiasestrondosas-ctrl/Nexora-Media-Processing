import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QCIssue {
  category: "VIDEO" | "AUDIO" | "CONTAINER" | "METADATA" | "GENERAL";
  severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
  ruleId: string;
  message: string;
  details?: Record<string, unknown>;
}

interface QCReportViewerProps {
  issues: QCIssue[];
  overallStatus?: "PASS" | "QUARANTINE" | "REJECT" | "PENDING";
}

const severityConfig = {
  FATAL: { icon: AlertCircle, color: "text-red-600 bg-red-500/10 border-red-500/20", badge: "bg-red-600 text-white" },
  ERROR: { icon: AlertCircle, color: "text-red-500 bg-red-500/10 border-red-500/20", badge: "bg-red-500 text-white" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20", badge: "bg-yellow-500 text-white" },
  INFO: { icon: Info, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", badge: "bg-blue-500 text-white" },
};

const statusConfig = {
  PASS: { label: "Conforme", color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20" },
  QUARANTINE: { label: "Em Quarentena", color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  REJECT: { label: "Não Conforme", color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/20" },
  PENDING: { label: "Em Análise", color: "bg-muted text-muted-foreground border-transparent" },
};

export function QCReportViewer({ issues, overallStatus = "PENDING" }: QCReportViewerProps) {
  const status = statusConfig[overallStatus];

  // Agrupar por categoria
  const groupedIssues = issues.reduce((acc, issue) => {
    const cat = issue.category || "GENERAL";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {} as Record<string, QCIssue[]>);

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", overallStatus === 'PASS' ? "bg-green-500/20 text-green-600" : "bg-primary/10 text-primary")}>
            <CheckCircle className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-bold uppercase tracking-tight">
            Veredito do Controlo de Qualidade
          </CardTitle>
        </div>
        <Badge className={cn("font-bold px-3 py-1", status.color)} variant="outline">
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <div className="p-4 bg-green-500/10 rounded-full mb-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h4 className="font-bold text-foreground">Arquivo em Conformidade</h4>
            <p className="text-sm max-w-[280px] text-center mt-1">Nenhum problema detetado. O ficheiro cumpre todos os requisitos técnicos.</p>
          </div>
        ) : (
          Object.entries(groupedIssues).map(([category, catIssues]) => (
            <div key={category} className="space-y-3">
              <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest pl-1">
                {category}
              </h4>
              <div className="space-y-2">
                {catIssues.map((issue, idx) => {
                  const config = severityConfig[issue.severity] || severityConfig.INFO;
                  const Icon = config.icon;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-xl border transition-colors",
                        config.color
                      )}
                    >
                      <div className="p-2 bg-background/50 rounded-lg shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("text-[10px] h-5 px-1.5 font-bold uppercase", config.badge)}>
                            {issue.severity}
                          </Badge>
                          <span className="text-xs font-mono font-bold uppercase tracking-tight opacity-70">
                            {issue.ruleId}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed font-medium">{issue.message}</p>
                        {issue.details && (
                          <div className="mt-3 bg-background/40 backdrop-blur-sm p-3 rounded-lg border border-foreground/5">
                            <pre className="text-[10px] font-mono leading-tight whitespace-pre-wrap opacity-80">
                              {JSON.stringify(issue.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
