import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Film, AlertTriangle } from "lucide-react";

// Mock data for initial rendering
const vmafData = [
  { name: "00:00", value: 92 },
  { name: "04:00", value: 94 },
  { name: "08:00", value: 91 },
  { name: "12:00", value: 95 },
  { name: "16:00", value: 96 },
  { name: "20:00", value: 94 },
  { name: "24:00", value: 95 },
];

const jobsData = [
  { name: "Seg", success: 120, failed: 2 },
  { name: "Ter", success: 132, failed: 5 },
  { name: "Qua", success: 101, failed: 1 },
  { name: "Qui", success: 145, failed: 8 },
  { name: "Sex", success: 160, failed: 3 },
  { name: "Sab", success: 85, failed: 0 },
  { name: "Dom", success: 70, failed: 1 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Assets Processados</CardTitle>
            <Film className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">+12% desde o último mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tempo Médio (Transcode)</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14m 32s</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">-2% (melhoria)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.4%</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Últimos 7 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Rejeições QC</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">+4 face à semana anterior</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricsChart 
          title="Qualidade Média (VMAF)"
          description="Evolução da pontuação VMAF nas últimas 24 horas"
          data={vmafData}
          type="area"
          dataKeys={[{ key: "value", color: "#3b82f6", name: "VMAF Score" }]}
        />
        <MetricsChart 
          title="Volume de Processamento"
          description="Jobs concluídos vs falhados (Últimos 7 dias)"
          data={jobsData}
          type="bar"
          dataKeys={[
            { key: "success", color: "#22c55e", name: "Sucesso" },
            { key: "failed", color: "#ef4444", name: "Falhados" }
          ]}
        />
      </div>
    </div>
  );
}
