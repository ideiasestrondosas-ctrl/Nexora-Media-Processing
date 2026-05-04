"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ServerCrash, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { api } from "@/lib/api";

// Dados que vêm da API
interface QueueStat {
  name: string;
  queueKey: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  progressList?: {
    id: string;
    progress: number;
    data: { assetId?: string; filename?: string };
  }[];
}

interface QueueStatsResponse {
  queues: QueueStat[];
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export function QueueDashboard() {
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [totals, setTotals] = useState({ waiting: 0, active: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get<QueueStatsResponse>('/queue/stats');
        setQueues(data.queues);
        setTotals({ waiting: data.totals.waiting, active: data.totals.active });
        setConnected(true);
      } catch (err) {
        console.error("Erro a obter estatísticas das filas:", err);
        setConnected(false);
      }
    };

    void fetchStats();
    
    // Atualizar as filas a cada 5 segundos
    const interval = setInterval(() => { void fetchStats(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalWaiting = totals.waiting;
  const totalActive = totals.active;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Status de Ligação (SSE)</CardTitle>
            <Activity className={`h-4 w-4 ${connected ? "text-green-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connected ? "Conectado" : "Desconectado"}</div>
            <p className="text-xs text-slate-500 mt-1">Updates em tempo real activos</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total em Processamento</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
            <p className="text-xs text-slate-500 mt-1">Jobs activos nos workers</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Fila de Espera Global</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWaiting}</div>
            <p className="text-xs text-slate-500 mt-1">Jobs aguardando recursos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filas de Processamento (BullMQ)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead className="text-right">Aguardar</TableHead>
                <TableHead className="text-right">Activos</TableHead>
                <TableHead className="text-right">Concluídos</TableHead>
                <TableHead className="text-right">Falhados</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((queue) => (
                <TableRow key={queue.name}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{queue.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={queue.waiting > 20 ? "text-yellow-600 font-semibold" : ""}>
                      {queue.waiting}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-blue-600">
                    {queue.active}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {queue.completed}
                  </TableCell>
                  <TableCell className="text-right">
                    {queue.failed > 0 ? (
                      <span className="text-red-600 font-bold flex items-center justify-end gap-1">
                        {queue.failed} <ServerCrash className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {queue.progressList && queue.progressList.length > 0 ? (
                        queue.progressList.map((job: any) => (
                          <div key={job.id} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="truncate max-w-[120px]">{job.data?.filename || job.id}</span>
                              <span>{typeof job.progress === 'number' ? `${job.progress}%` : '0%'}</span>
                            </div>
                            <Progress 
                              value={typeof job.progress === 'number' ? job.progress : 0} 
                              className="h-1" 
                            />
                          </div>
                        ))
                      ) : (
                        queue.active > 0 && <Progress value={100} className="h-1 animate-pulse" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
