"use client";

import { useEffect, useState, useCallback } from "react";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Film, AlertTriangle, RefreshCw, UploadCloud, Cpu, Layers, Database, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import Link from "next/link";

interface MetricsSummary {
  assets: {
    total: number;
    byStatus: {
      completed: number;
      transcoding: number;
      pending: number;
      ingesting: number;
      qcRunning: number;
      failed: number;
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
  hardware: {
    cpuLoad: number;
    memUsedPercent: number;
    memTotal: string;
    gpu?: {
      name: string;
      load: number;
      memUsed: string;
      memTotal: string;
      temp: number;
    };
    storage: {
      temp: { used: string; total: string; percent: number };
      storage: { used: string; total: string; percent: number };
    };
  };
  hardwareHistory: {
    time: string;
    cpu: number;
    ram: number;
    gpu?: number;
  }[];
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, dashboardRes] = await Promise.all([
        api.get<MetricsSummary>('/metrics/summary'),
        api.get<DashboardData>('/metrics/dashboard-data'),
      ]);
      setMetrics(summaryRes);
      setDashboardData(dashboardRes);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Erro a obter métricas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => { void fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalAssets = metrics?.assets.total ?? 0;
  const completedAssets = metrics?.assets.byStatus.completed ?? 0;
  const activeJobs = dashboardData?.systemStats.activeJobs ?? 0;
  const pendingJobs = dashboardData?.systemStats.pendingJobs ?? 0;
  const successRate = metrics?.jobs.last24h.successRate ?? null;
  const failedJobs = dashboardData?.systemStats.failedJobsLast24h ?? 0;
  const uptime = dashboardData?.systemStats.uptime ?? "--";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estatísticas do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lastUpdated
              ? `Última atualização: ${lastUpdated.toLocaleTimeString("pt-PT")}`
              : "A carregar dados..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-2"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Actualizar
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            Live
          </div>
        </div>
      </div>

      {/* Cartões de métricas originais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total de Assets</CardTitle>
            <Film className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : totalAssets}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? "" : `${completedAssets} concluídos`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Jobs em Curso</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : `${activeJobs} / ${pendingJobs}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tempo de atividade: {uptime}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : successRate !== null ? `${successRate}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimas 24 horas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">Falhas Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${failedJobs > 0 ? "text-destructive" : ""}`}>
              {loading ? "…" : failedJobs}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Detetadas nas últimas 24h</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado vazio — sem assets */}
      {!loading && totalAssets === 0 && (
        <div className="bg-muted/30 border-2 border-dashed rounded-xl p-12 text-center">
          <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum asset processado</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            A sua biblioteca está vazia. Comece por carregar um ficheiro para análise.
          </p>
          <Button asChild gap-2>
            <Link href="/assets/upload">
              <UploadCloud className="h-4 w-4" />
              Fazer Upload
            </Link>
          </Button>
        </div>
      )}

      {/* Infraestrutura Hardware */}
      {!loading && dashboardData?.hardware && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">Estado da Infraestrutura</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-slate-50/50 dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                  CPU
                  <span className={(dashboardData.hardware.cpu || 0) > 80 ? "text-red-500" : "text-green-500"}>
                    {Math.round(dashboardData.hardware.cpu || 0)}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${dashboardData.hardware.cpu || 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50/50 dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                  Memória RAM
                  <span className="text-blue-500">{Math.round(dashboardData.hardware.memory?.percent || 0)}%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500" 
                    style={{ width: `${dashboardData.hardware.memory?.percent || 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-right">
                  Total: {dashboardData.hardware.memory?.total ? (dashboardData.hardware.memory.total / (1024**3)).toFixed(1) : 0} GB
                </p>
              </CardContent>
            </Card>

            {dashboardData.hardware.gpu && dashboardData.hardware.gpu.model !== 'N/A' ? (
              <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-blue-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                    GPU ({dashboardData.hardware.gpu.model})
                    <span className="text-teal-500">{Math.round(dashboardData.hardware.gpu.load || 0)}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 transition-all duration-500" 
                      style={{ width: `${dashboardData.hardware.gpu.load || 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 flex justify-between">
                    <span>VRAM: {Math.round((dashboardData.hardware.gpu.memoryUsed || 0) / 1024)} / {Math.round((dashboardData.hardware.gpu.memoryTotal || 0) / 1024)} GB</span>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">GPU</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-10">
                  <span className="text-[10px] text-muted-foreground italic text-center">Aceleração NVIDIA não detectada</span>
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-50/50 dark:bg-slate-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                  Disco (Storage)
                  <span>
                    {dashboardData.hardware.disk ? Math.round((dashboardData.hardware.disk.used / dashboardData.hardware.disk.total) * 100) : 0}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-500" 
                    style={{ width: `${dashboardData.hardware.disk ? (dashboardData.hardware.disk.used / dashboardData.hardware.disk.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-right">
                  {dashboardData.hardware.disk ? (dashboardData.hardware.disk.used / (1024**3)).toFixed(1) : 0} de {dashboardData.hardware.disk ? (dashboardData.hardware.disk.total / (1024**3)).toFixed(1) : 0} GB
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Histórico de Hardware */}
          <Card className="p-4 pt-6">
            <MetricsChart
              title="Histórico de Carga"
              description="Uso de recursos nos últimos minutos"
              data={dashboardData.hardwareHistory?.map((h: any) => ({ ...h, name: h.time })) || []}
              type="area"
              dataKeys={[
                { key: "cpu", color: "hsl(var(--chart-1))", name: "CPU (%)" },
                { key: "memory", color: "hsl(var(--chart-4))", name: "RAM (%)" },
                ...(dashboardData.hardware.gpu && dashboardData.hardware.gpu.model !== 'N/A' ? [{ key: "gpu", color: "hsl(var(--chart-5))", name: "GPU (%)" }] : []),
              ]}
            />
          </Card>
        </div>
      )}

      {/* Gráficos de Media */}
      {!loading && totalAssets > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <MetricsChart
            title="Métricas de Qualidade"
            description="Evolução de VMAF e PSNR (24h)"
            data={dashboardData?.qualityTrends?.map((item: any) => ({ ...item, name: item.time })) || []}
            type="area"
            dataKeys={[
              { key: "vmaf", color: "hsl(var(--primary))", name: "VMAF" },
              { key: "psnr", color: "hsl(var(--chart-2))", name: "PSNR (dB)" },
            ]}
          />
          <MetricsChart
            title="Carga de Processamento"
            description="Volume total processado em GB"
            data={dashboardData?.processingVolume?.map((item: any) => ({ ...item, name: item.name ?? item.date })) || []}
            type="bar"
            dataKeys={[
              { key: "gb", color: "hsl(var(--chart-3))", name: "Volume (GB)" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
