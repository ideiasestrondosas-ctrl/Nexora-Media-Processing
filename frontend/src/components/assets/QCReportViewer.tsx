import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";

export interface QCIssue {
  category: "VIDEO" | "AUDIO" | "CONTAINER" | "METADATA";
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
  FATAL: { icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200", badge: "bg-red-600 hover:bg-red-700" },
  ERROR: { icon: AlertCircle, color: "text-red-500 bg-red-50 border-red-200", badge: "bg-red-500 hover:bg-red-600" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50 border-yellow-200", badge: "bg-yellow-500 hover:bg-yellow-600" },
  INFO: { icon: Info, color: "text-blue-500 bg-blue-50 border-blue-200", badge: "bg-blue-500 hover:bg-blue-600" },
};

const statusConfig = {
  PASS: { label: "Aprovado", color: "bg-green-500 text-white" },
  QUARANTINE: { label: "Quarentena", color: "bg-yellow-500 text-white" },
  REJECT: { label: "Rejeitado", color: "bg-red-500 text-white" },
  PENDING: { label: "Pendente", color: "bg-slate-400 text-white" },
};

export function QCReportViewer({ issues, overallStatus = "PENDING" }: QCReportViewerProps) {
  const status = statusConfig[overallStatus];

  // Agrupar por categoria
  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, QCIssue[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Relatório de Controlo de Qualidade (QC)
        </CardTitle>
        <Badge className={status.color} variant="outline">
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <CheckCircle className="h-12 w-12 text-green-500 mb-2 opacity-50" />
            <p>Nenhum problema encontrado. O ficheiro cumpre todas as normas.</p>
          </div>
        ) : (
          Object.entries(groupedIssues).map(([category, catIssues]) => (
            <div key={category} className="space-y-3">
              <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {category}
              </h4>
              <div className="space-y-2">
                {catIssues.map((issue, idx) => {
                  const config = severityConfig[issue.severity];
                  const Icon = config.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-md border ${config.color} dark:bg-opacity-10 dark:border-opacity-20`}
                    >
                      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className={config.badge}>{issue.severity}</Badge>
                          <span className="text-sm font-semibold opacity-80">{issue.ruleId}</span>
                        </div>
                        <p className="text-sm">{issue.message}</p>
                        {issue.details && (
                          <pre className="mt-2 text-xs bg-white/50 dark:bg-black/20 p-2 rounded overflow-x-auto">
                            {JSON.stringify(issue.details, null, 2)}
                          </pre>
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
