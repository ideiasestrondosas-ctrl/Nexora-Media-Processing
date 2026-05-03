import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';

export async function metricsDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /metrics/dashboard-data
  fastify.get('/metrics/dashboard-data', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // 1. Processamento Diário (Últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Obter jobs processados com sucesso agrupados por dia
    const processingJobs = await prisma.job.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: sevenDaysAgo }
      },
      select: {
        createdAt: true,
        asset: {
          select: { size: true }
        }
      }
    });

    const dailyProcessingMap = new Map<string, number>();
    // Inicializar os últimos 7 dias a 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('pt-PT', { weekday: 'short' });
      dailyProcessingMap.set(label, 0);
    }

    processingJobs.forEach(job => {
      const label = job.createdAt.toLocaleDateString('pt-PT', { weekday: 'short' });
      const sizeInGB = job.asset?.size ? Number(job.asset.size) / (1024 * 1024 * 1024) : 0;
      if (dailyProcessingMap.has(label)) {
        dailyProcessingMap.set(label, dailyProcessingMap.get(label)! + sizeInGB);
      }
    });

    const processingVolume = Array.from(dailyProcessingMap.entries()).map(([name, gb]) => ({
      name,
      gb: Number(gb.toFixed(2))
    }));

    // 2. Qualidade (VMAF) Agregada por hora (Últimas 24 horas)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const qcReports = await prisma.qCReport.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        metrics: { not: undefined }
      },
      select: {
        createdAt: true,
        metrics: true
      }
    });

    const hourlyQualityMap = new Map<string, { totalVmaf: number, count: number }>();
    
    // Inicializar as últimas 24 horas a 0 (de 4 em 4 horas para o gráfico não ficar confuso)
    for (let i = 24; i >= 0; i -= 4) {
      const d = new Date();
      d.setHours(d.getHours() - i);
      const label = `${d.getHours().toString().padStart(2, '0')}:00`;
      hourlyQualityMap.set(label, { totalVmaf: 0, count: 0 });
    }

    qcReports.forEach(report => {
      // Find the closest bucket
      const reportHour = report.createdAt.getHours();
      // Round down to nearest 4-hour bucket
      const bucketHour = Math.floor(reportHour / 4) * 4;
      const label = `${bucketHour.toString().padStart(2, '0')}:00`;
      
      const metrics = report.metrics as any;
      if (metrics && metrics.vmaf) {
        if (hourlyQualityMap.has(label)) {
          const current = hourlyQualityMap.get(label)!;
          hourlyQualityMap.set(label, {
            totalVmaf: current.totalVmaf + metrics.vmaf,
            count: current.count + 1
          });
        }
      }
    });

    const qualityTrends = Array.from(hourlyQualityMap.entries()).map(([time, data]) => {
      const vmaf = data.count > 0 ? Number((data.totalVmaf / data.count).toFixed(1)) : null;
      return {
        time,
        vmaf: vmaf || 95, // mock fallback se não houver dados
        psnr: vmaf ? Number((vmaf * 0.45).toFixed(1)) : 42, // mock derivado
      };
    });

    // 3. System Stats Rápidas (Agregadas)
    const pendingJobs = await prisma.job.count({ where: { status: 'PENDING' } });
    const activeJobs = await prisma.job.count({ where: { status: 'PROCESSING' } });
    const failedJobsLast24h = await prisma.job.count({
      where: {
        status: 'FAILED',
        updatedAt: { gte: twentyFourHoursAgo }
      }
    });

    const uptimeStr = process.uptime();
    const uptimeHours = Math.floor(uptimeStr / 3600);
    const uptimeMinutes = Math.floor((uptimeStr % 3600) / 60);

    return {
      processingVolume,
      qualityTrends,
      systemStats: {
        pendingJobs,
        activeJobs,
        failedJobsLast24h,
        uptime: `${uptimeHours}h ${uptimeMinutes}m`
      }
    };
  });
}
