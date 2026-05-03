"use client";

import { useEffect, useState } from "react";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Film, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

// Mock data for initial rendering (Gráficos mantidos em mock até API de time-series)
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

interface MetricsSummary {
  assets: {
    total: number;
    byStatus: {
      completed: number;
      qcRejected: number;
      [key: string]: number;
    };
  };
  jobs: {
    total: number;
    last24h: {
      completed: number;
      failed: number;
      successRate: number;
    };
  };
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.get<MetricsSummary>('/metrics/summary');
        setMetrics(data);
      } catch (err) {
        console.error("Erro a obter métricas:", err);
      }
    };
    void fetchMetrics();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => { void fetchMetrics(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live Data
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Assets Processados</CardTitle>
            <Film className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.assets.byStatus.completed ?? '--'}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total no sistema: {metrics?.assets.total ?? '--'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Jobs Activos (24h)</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics?.jobs.last24h.completed ?? 0) + (metrics?.jobs.last24h.failed ?? 0)}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total global: {metrics?.jobs.total ?? '--'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.jobs.last24h.successRate ?? '--'}%</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Últimas 24 horas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Rejeições QC</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.assets.byStatus.qcRejected ?? '--'}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total acumulado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricsChart 
          title="Qualidade Média (VMAF) [Demo]"
          description="Evolução da pontuação VMAF nas últimas 24 horas"
          data={vmafData}
          type="area"
          dataKeys={[{ key: "value", color: "#3b82f6", name: "VMAF Score" }]}
        />
        <MetricsChart 
          title="Volume de Processamento [Demo]"
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
