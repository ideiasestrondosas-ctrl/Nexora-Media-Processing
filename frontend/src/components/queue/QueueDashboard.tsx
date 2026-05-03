"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, ServerCrash, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Exemplo de estrutura de dados que viria do SSE
interface QueueStat {
  queueName: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  isPaused: boolean;
}

export function QueueDashboard() {
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [connected, setConnected] = useState(false);

  // Em produção, isto ligar-se-ia a um endpoint SSE (EventSource) real.
  // Para efeitos de demonstração e UI testing imediato, usamos dados simulados caso a API não esteja pronta.
  useEffect(() => {
    // Simulação de dados em tempo real (Mock SSE)
    setConnected(true);
    const mockData: QueueStat[] = [
      { queueName: "Ingest", active: 2, waiting: 5, completed: 142, failed: 1, isPaused: false },
      { queueName: "QC_Pre", active: 4, waiting: 10, completed: 130, failed: 5, isPaused: false },
      { queueName: "Transcode_GPU", active: 2, waiting: 8, completed: 85, failed: 2, isPaused: false },
      { queueName: "Transcode_CPU", active: 8, waiting: 45, completed: 450, failed: 0, isPaused: false },
      { queueName: "Audio", active: 1, waiting: 0, completed: 120, failed: 0, isPaused: false },
    ];
    setQueues(mockData);

    const interval = setInterval(() => {
      setQueues(prev => prev.map(q => ({
        ...q,
        active: Math.max(0, q.active + (Math.random() > 0.5 ? 1 : -1)),
        waiting: Math.max(0, q.waiting + (Math.random() > 0.7 ? 2 : -1)),
        completed: q.completed + (Math.random() > 0.8 ? 1 : 0)
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const totalWaiting = queues.reduce((acc, q) => acc + q.waiting, 0);
  const totalActive = queues.reduce((acc, q) => acc + q.active, 0);

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
                <TableRow key={queue.queueName}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className={queue.isPaused ? "text-slate-400" : ""}>{queue.queueName}</span>
                      {queue.isPaused && <Badge variant="secondary" className="text-[10px]">PAUSED</Badge>}
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
                    {queue.active > 0 && <Progress value={100} className="h-1 animate-pulse" />}
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
