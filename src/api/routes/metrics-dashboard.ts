import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import si from 'systeminformation';
import fs from 'fs';
import path from 'path';

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
      },
      select: {
        createdAt: true,
        results: true,
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
      
      // results é um array de QCResult; procurar vmaf score se existir
      const results = report.results as any[];
      const vmafResult = Array.isArray(results) ? results.find((r: any) => r.vmaf ?? r.vmafScore) : null;
      const vmafValue = vmafResult ? (vmafResult.vmaf ?? vmafResult.vmafScore) : null;
      if (vmafValue && hourlyQualityMap.has(label)) {
        const current = hourlyQualityMap.get(label)!;
        hourlyQualityMap.set(label, {
          totalVmaf: current.totalVmaf + Number(vmafValue),
          count: current.count + 1
        });
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
    const activeJobs = await prisma.job.count({ where: { status: 'ACTIVE' } });
    const failedJobsLast24h = await prisma.job.count({
      where: {
        status: 'FAILED',
        updatedAt: { gte: twentyFourHoursAgo }
      }
    });

    const uptimeStr = process.uptime();
    const uptimeHours = Math.floor(uptimeStr / 3600);
    const uptimeMinutes = Math.floor((uptimeStr % 3600) / 60);

    // 4. Hardware Metrics (Nova Secção)
    let cpuLoad = 0;
    let memUsed = 0;
    let memTotal = 0;
    let gpuInfo = { model: 'N/A', memoryUsed: 0, memoryTotal: 0, load: 0 };
    let diskStats = { total: 0, used: 0, tempUsed: 0, storageUsed: 0 };

    try {
      const [cpu, mem, gpus, disk] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.graphics(),
        si.fsSize()
      ]);

      cpuLoad = cpu.currentLoad;
      memUsed = mem.active;
      memTotal = mem.total;

      if (gpus.controllers && gpus.controllers.length > 0) {
        const primaryGpu = gpus.controllers[0];
        gpuInfo = {
          model: primaryGpu.model,
          memoryUsed: primaryGpu.memoryUsed || 0,
          memoryTotal: primaryGpu.memoryTotal || 0,
          load: primaryGpu.utilizationGpu || 0
        };
      }

      // Disco principal (onde corre a app)
      const mainDisk = disk.find(d => d.mount === '/' || d.mount === 'C:') || disk[0];
      diskStats.total = mainDisk.size;
      diskStats.used = mainDisk.used;

      // Calcular espaço em /media/temp e /media/storage (Nexora específicos)
      const tempDir = process.env.NEXORA_TEMP_DIR || '/media/temp';
      const storageDir = process.env.NEXORA_STORAGE_DIR || '/media/storage';

      const getDirSize = (dirPath: string): number => {
        try {
          if (!fs.existsSync(dirPath)) return 0;
          let totalSize = 0;
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const stats = fs.statSync(path.join(dirPath, file));
            if (stats.isFile()) totalSize += stats.size;
          }
          return totalSize;
        } catch { return 0; }
      };

      diskStats.tempUsed = getDirSize(tempDir);
      diskStats.storageUsed = getDirSize(storageDir);

    } catch (err) {
      console.error("Erro a obter métricas de hardware:", err);
    }

    return {
      processingVolume,
      qualityTrends,
      systemStats: {
        pendingJobs,
        activeJobs,
        failedJobsLast24h,
        uptime: `${uptimeHours}h ${uptimeMinutes}m`
      },
      hardware: {
        cpu: Number(cpuLoad.toFixed(1)),
        memory: {
          used: memUsed,
          total: memTotal,
          percent: Number(((memUsed / memTotal) * 100).toFixed(1))
        },
        gpu: gpuInfo,
        disk: diskStats
      },
      // Mock de histórico de hardware (últimas 24h)
      hardwareHistory: Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setHours(d.getHours() - (5 - i) * 4);
        return {
          time: `${d.getHours().toString().padStart(2, '0')}:00`,
          cpu: Math.random() * 40 + 10,
          memory: Math.random() * 20 + 40
        };
      })
    };
  });
}
