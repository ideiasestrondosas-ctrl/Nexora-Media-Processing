"use client";

import { useEffect, useState } from "react";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Film, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

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

interface DashboardData {
  processingVolume: { name: string; gb: number }[];
  qualityTrends: { time: string; vmaf: number; psnr: number }[];
  systemStats: {
    pendingJobs: number;
    activeJobs: number;
    failedJobsLast24h: number;
    uptime: string;
  };
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, dashboardRes] = await Promise.all([
          api.get<MetricsSummary>('/metrics/summary'),
          api.get<DashboardData>('/metrics/dashboard-data')
        ]);
        setMetrics(summaryRes);
        setDashboardData(dashboardRes);
      } catch (err) {
        console.error("Erro a obter métricas:", err);
      }
    };
    void fetchData();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => { void fetchData(); }, 30000);
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
            <CardTitle className="text-sm font-medium">Jobs Activos / Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.systemStats.activeJobs ?? '--'} / {dashboardData?.systemStats.pendingJobs ?? '--'}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tempo online: {dashboardData?.systemStats.uptime ?? '--'}</p>
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
            <CardTitle className="text-sm font-medium">Falhas (24h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.systemStats.failedJobsLast24h ?? '--'}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Jobs falhados recentemente</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricsChart 
          title="Qualidade Média (VMAF e PSNR)"
          description="Evolução da pontuação nas últimas 24 horas"
          data={dashboardData?.qualityTrends || []}
          type="area"
          dataKeys={[
            { key: "vmaf", color: "#3b82f6", name: "VMAF Score" },
            { key: "psnr", color: "#8b5cf6", name: "PSNR (dB)" }
          ]}
        />
        <MetricsChart 
          title="Volume de Processamento"
          description="Volume processado em GB (Últimos 7 dias)"
          data={dashboardData?.processingVolume || []}
          type="bar"
          dataKeys={[
            { key: "gb", color: "#22c55e", name: "Volume (GB)" }
          ]}
        />
      </div>
    </div>
  );
}
