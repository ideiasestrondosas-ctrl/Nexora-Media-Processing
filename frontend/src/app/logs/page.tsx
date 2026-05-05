"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Terminal, AlertCircle, Info, Zap, Download, Trash2, 
  Search, Filter, Activity, Lightbulb, ShieldAlert,
  UploadCloud
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuthStore } from "@/store/auth";
import { API_BASE_URL } from "@/lib/api";

interface LogEntry {
  time: string;
  level: number;
  msg: string;
  service?: string;
  job_id?: string;
  asset_id?: string;
  diagnostic?: {
    id: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    title: string;
    message: string;
    suggestion: string;
  } | null;
}

const LEVEL_MAP: Record<number, { label: string, color: string }> = {
  10: { label: 'TRACE', color: 'text-slate-400' },
  20: { label: 'DEBUG', color: 'text-blue-400' },
  30: { label: 'INFO', color: 'text-green-400' },
  40: { label: 'WARN', color: 'text-yellow-400' },
  50: { label: 'ERROR', color: 'text-red-400' },
  60: { label: 'FATAL', color: 'text-red-600 font-bold' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [minLevel, setMinLevel] = useState<number>(30);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const token = useAuthStore(state => state.token);

  // SSE connection
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`${API_BASE_URL}/logs/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data) as LogEntry;
        setLogs(prev => [...prev.slice(-499), log]);
      } catch (e) {
        console.error("Error parsing log:", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(l => 
    l.level >= minLevel && 
    (l.msg.toLowerCase().includes(filter.toLowerCase()) || 
     l.job_id?.includes(filter) || 
     l.asset_id?.includes(filter))
  );

  const diagnostics = logs
    .filter(l => l.diagnostic)
    .map(l => l.diagnostic!)
    .reduce((acc, curr) => {
      if (!acc.find(d => d.id === curr.id)) acc.push(curr);
      return acc;
    }, [] as any[]);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Terminal className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Consola do Sistema</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Activity className="h-3 w-3 animate-pulse text-green-500" />
              Logs em tempo real e diagnósticos analíticos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar logs..."
              className="pl-9 h-9 w-48 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <select 
            className="h-9 rounded-md border bg-background px-3 py-1 text-sm outline-none"
            value={minLevel}
            onChange={e => setMinLevel(Number(e.target.value))}
          >
            <option value={10}>Todos (Trace)</option>
            <option value={30}>Informação (Info+)</option>
            <option value={40}>Avisos (Warn+)</option>
            <option value={50}>Erros (Error+)</option>
          </select>
          <Button variant="outline" size="icon" onClick={() => setLogs([])} title="Limpar Consola">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => {
            const blob = new Blob([logs.map(l => JSON.stringify(l)).join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nexora-logs-${new Date().toISOString()}.log`;
            a.click();
          }} title="Exportar Logs">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
        {/* Main Terminal */}
        <Card className="lg:col-span-3 bg-slate-950 border-slate-800 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2 px-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest ml-2">Terminal Live Output</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("text-[10px] h-6 px-2", autoScroll ? "text-green-500" : "text-slate-500")}
              onClick={() => setAutoScroll(!autoScroll)}
            >
              AUTO-SCROLL: {autoScroll ? "ON" : "OFF"}
            </Button>
          </div>
          
          <ScrollArea ref={scrollRef} className="flex-1 p-4 font-mono text-[11px] leading-tight">
            <div className="space-y-1">
              {filteredLogs.map((log, i) => (
                <div key={i} className="group hover:bg-slate-900/50 -mx-1 px-1 rounded transition-colors whitespace-pre-wrap">
                  <span className="text-slate-600 mr-2">[{new Date(log.time).toLocaleTimeString()}]</span>
                  <span className={cn("mr-2 font-bold", LEVEL_MAP[log.level]?.color)}>
                    {LEVEL_MAP[log.level]?.label.padEnd(5)}
                  </span>
                  <span className="text-slate-300">{log.msg}</span>
                  {log.job_id && <Badge variant="outline" className="ml-2 h-4 text-[9px] border-slate-700 text-slate-500 px-1 py-0 font-normal">JOB:{log.job_id.slice(-6)}</Badge>}
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-20 gap-4">
                  <Terminal className="h-12 w-12 opacity-10" />
                  <p>A aguardar logs do sistema...</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Diagnostic Panel */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <Card className="flex flex-col flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-yellow-500" />
                Diagnóstico Automático
              </CardTitle>
              <CardDescription className="text-[10px]">Sugestões baseadas em análise de logs.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-4 space-y-4">
              {diagnostics.length > 0 ? (
                diagnostics.map((d, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/50 space-y-2 border-l-4 border-l-yellow-500">
                    <div className="flex items-center gap-2">
                      {d.severity === 'CRITICAL' ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />}
                      <span className="text-xs font-bold uppercase">{d.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{d.message}</p>
                    <div className="pt-1 flex items-start gap-2 bg-primary/5 p-2 rounded border border-primary/10">
                      <Lightbulb className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <p className="text-[10px] font-medium text-primary leading-tight">
                        <strong>Sugestão:</strong> {d.suggestion}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Zap className="h-8 w-8 text-slate-200" />
                  <p className="text-xs text-muted-foreground italic">Nenhum problema detectado até ao momento.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold">Análise Profissional</p>
                <p className="text-[10px] text-muted-foreground">O motor Nexora identifica padrões de erro críticos automaticamente.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
