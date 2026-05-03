import { QueueDashboard } from "@/components/queue/QueueDashboard";

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Monitorização de Filas</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Visualização em tempo real do estado das filas do BullMQ e workers activos.
        </p>
      </div>
      
      <QueueDashboard />
    </div>
  );
}
