// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Frontend Next.js 14
// Ficheiro: frontend/package.json
// ═══════════════════════════════════════════════════════════════

/*
{
  "name": "nexora-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.32.0",
    "zustand": "^4.5.0",
    "recharts": "^2.12.0",
    "react-hook-form": "^7.51.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "nuqs": "^1.17.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@playwright/test": "^1.44.0"
  }
}
*/


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/layout.tsx — Layout raiz
// ═══════════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProviders } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nexora Media Processing',
  description: 'Plataforma profissional de processamento de media broadcast & OTT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="dark">
      <body className={`${inter.variable} font-sans bg-neutral-950 text-neutral-100 antialiased`}>
        <QueryProviders>{children}</QueryProviders>
      </body>
    </html>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/(dashboard)/layout.tsx — Layout do dashboard
// ═══════════════════════════════════════════════════════════════

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar }  from '@/components/layout/topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 bg-neutral-950">
          {children}
        </main>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/(dashboard)/page.tsx — Dashboard Overview
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import { MetricCard }      from '@/components/dashboard/metric-card';
import { AssetsTrendChart } from '@/components/dashboard/assets-trend-chart';
import { ErrorsBarChart }   from '@/components/dashboard/errors-bar-chart';
import { RecentActivity }   from '@/components/dashboard/recent-activity';
import { fetchMetricsSummary } from '@/lib/api';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics-summary'],
    queryFn:  fetchMetricsSummary,
    refetchInterval: 30000, // atualizar cada 30s
  });

  const metrics = data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Visão geral do pipeline Nexora Media Processing
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Assets processados hoje"
          value={metrics?.today?.total ?? 0}
          change={metrics?.today?.successRate}
          changeLabel="taxa de sucesso"
          isLoading={isLoading}
        />
        <MetricCard
          title="Taxa de sucesso"
          value={`${metrics?.today?.successRate ?? 0}%`}
          isLoading={isLoading}
          variant={
            (metrics?.today?.successRate ?? 100) >= 90 ? 'success' :
            (metrics?.today?.successRate ?? 100) >= 70 ? 'warning' : 'danger'
          }
        />
        <MetricCard
          title="VMAF médio"
          value={metrics?.quality?.avgVmaf ?? '—'}
          isLoading={isLoading}
          variant={
            parseFloat(metrics?.quality?.avgVmaf ?? '0') >= 90 ? 'success' :
            parseFloat(metrics?.quality?.avgVmaf ?? '0') >= 85 ? 'warning' : 'danger'
          }
        />
        <MetricCard
          title="Assets falhados"
          value={metrics?.today?.failed ?? 0}
          isLoading={isLoading}
          variant={metrics?.today?.failed > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AssetsTrendChart />
        <ErrorsBarChart />
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/(dashboard)/assets/page.tsx — Lista de Assets
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryStates, parseAsString, parseAsInteger } from 'nuqs';
import { Upload, Search, Filter } from 'lucide-react';
import { AssetsTable }   from '@/components/assets/assets-table';
import { AssetFilters }  from '@/components/assets/asset-filters';
import { UploadModal }   from '@/components/assets/upload-modal';
import { fetchAssets }   from '@/lib/api';

export default function AssetsPage() {
  const [showUpload, setShowUpload] = useState(false);

  // Estado dos filtros em URL params (partilhável, navegável)
  const [filters, setFilters] = useQueryStates({
    status:   parseAsString.withDefault(''),
    profile:  parseAsString.withDefault(''),
    search:   parseAsString.withDefault(''),
    page:     parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(25),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['assets', filters],
    queryFn:  () => fetchAssets(filters),
    refetchInterval: 10000, // polling 10s
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Assets</h1>
          <p className="text-neutral-400 text-sm mt-1">
            {data?.meta?.total ?? 0} assets no total
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload size={16} />
          Adicionar asset
        </button>
      </div>

      <AssetFilters filters={filters} onFiltersChange={setFilters} />

      <AssetsTable
        assets={data?.data ?? []}
        isLoading={isLoading}
        meta={data?.meta}
        page={filters.page}
        pageSize={filters.pageSize}
        onPageChange={(p) => setFilters({ page: p })}
      />

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); refetch(); }}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/(dashboard)/assets/[id]/page.tsx — Asset Detail
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { NexoraStatusBadge } from '@/components/ui/status-badge';
import { NexoraVMAFGauge }   from '@/components/ui/vmaf-gauge';
import { fetchAsset, fetchAssetJobs, fetchAuditLog } from '@/lib/api';
import { useAssetStatusSSE } from '@/hooks/useAssetStatusSSE';

type Tab = 'overview' | 'qc-report' | 'jobs' | 'audit' | 'downloads';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: assetData, refetch } = useQuery({
    queryKey: ['asset', id],
    queryFn:  () => fetchAsset(id),
  });

  // SSE para actualizações em tempo real do estado
  useAssetStatusSSE(id, () => refetch());

  const asset = assetData?.data;
  if (!asset) return <div className="text-neutral-400 p-8">A carregar...</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Visão geral' },
    { id: 'qc-report',  label: 'Relatório QC' },
    { id: 'jobs',       label: 'Jobs' },
    { id: 'audit',      label: 'Audit Trail' },
    { id: 'downloads',  label: 'Downloads' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/assets" className="text-neutral-400 hover:text-white mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white truncate">
              {asset.originalName}
            </h1>
            <NexoraStatusBadge status={asset.status} />
          </div>
          <p className="text-neutral-400 text-sm mt-1">ID: {asset.id}</p>
        </div>

        {/* VMAF gauge no header */}
        {asset.vmafScore != null && (
          <NexoraVMAFGauge score={asset.vmafScore} size="sm" />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'  && <AssetOverviewTab asset={asset} />}
        {activeTab === 'qc-report' && <AssetQCReportTab assetId={id} />}
        {activeTab === 'jobs'      && <AssetJobsTab assetId={id} />}
        {activeTab === 'audit'     && <AssetAuditTab assetId={id} />}
        {activeTab === 'downloads' && <AssetDownloadsTab asset={asset} />}
      </div>
    </div>
  );
}

// ── Sub-componentes das tabs ──────────────────────────────────

function AssetOverviewTab({ asset }: { asset: any }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Specs técnicas de vídeo */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Especificações de vídeo</h3>
        <dl className="space-y-2.5">
          {[
            { label: 'Codec',       value: asset.codec       ?? '—' },
            { label: 'Resolução',   value: asset.resolution  ?? '—' },
            { label: 'Frame rate',  value: asset.frameRate != null ? `${asset.frameRate} fps` : '—' },
            { label: 'Duração',     value: asset.durationMs != null ? formatDuration(asset.durationMs) : '—' },
            { label: 'Perfil',      value: asset.profile },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <dt className="text-neutral-400 text-sm">{label}</dt>
              <dd className="text-white text-sm font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Specs de qualidade */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Qualidade</h3>
        <div className="flex items-center justify-center mb-4">
          {asset.vmafScore != null
            ? <NexoraVMAFGauge score={asset.vmafScore} size="lg" />
            : <div className="text-neutral-500 text-sm">VMAF não disponível</div>
          }
        </div>
        <dl className="space-y-2.5">
          {[
            { label: 'Loudness (LUFS)',  value: asset.loudnessLufs != null ? `${asset.loudnessLufs.toFixed(1)} LUFS` : '—' },
            { label: 'True Peak',        value: asset.truePeakDbtp != null ? `${asset.truePeakDbtp.toFixed(1)} dBTP` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <dt className="text-neutral-400 text-sm">{label}</dt>
              <dd className="text-white text-sm font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function AssetQCReportTab({ assetId }: { assetId: string }) {
  const { data } = useQuery({
    queryKey: ['qc-report', assetId],
    queryFn:  () => fetch(`/api/v1/assets/${assetId}/qc-report`).then(r => r.json()),
  });

  const jobs = data?.data ?? [];

  if (jobs.length === 0) {
    return <div className="text-neutral-400 text-sm p-4">Relatório QC não disponível.</div>;
  }

  return (
    <div className="space-y-4">
      {jobs.map((job: any) => (
        <div key={job.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">{job.type}</span>
            <NexoraStatusBadge status={job.status} />
          </div>
          {job.result?.results && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-800">
                  <th className="text-left py-2">Verificação</th>
                  <th className="text-left py-2">Resultado</th>
                  <th className="text-left py-2">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {job.result.results.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-neutral-800/50">
                    <td className="py-2 font-mono text-xs text-neutral-300">{r.code}</td>
                    <td className="py-2">
                      <span className={`text-xs font-medium ${
                        r.pass ? 'text-green-400' :
                        r.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {r.pass ? 'PASS' : r.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-neutral-400">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function AssetJobsTab({ assetId }: { assetId: string }) {
  const { data } = useQuery({
    queryKey: ['asset-jobs', assetId],
    queryFn:  () => fetchAssetJobs(assetId),
    refetchInterval: 5000,
  });

  const jobs = data?.data ?? [];

  return (
    <div className="space-y-2">
      {jobs.map((job: any) => (
        <div key={job.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white">{job.type}</span>
              <span className="text-xs text-neutral-500 font-mono">{job.id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-3">
              {job.finishedAt && job.startedAt && (
                <span className="text-xs text-neutral-400">
                  {formatDuration(new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime())}
                </span>
              )}
              <NexoraStatusBadge status={job.status} />
            </div>
          </div>
          {job.error && (
            <div className="mt-2 text-xs text-red-400 bg-red-950/30 rounded p-2 font-mono">
              {job.error}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AssetAuditTab({ assetId }: { assetId: string }) {
  const { data } = useQuery({
    queryKey: ['audit-log', assetId],
    queryFn:  () => fetchAuditLog(assetId),
  });

  const logs = data?.data ?? [];

  return (
    <div>
      <div className="text-xs text-neutral-500 mb-3 bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
        ⚠ Registo imutável (ADR-007) — apenas leitura. Nenhuma entrada pode ser alterada ou eliminada.
      </div>
      <div className="space-y-2">
        {logs.map((log: any) => (
          <div key={log.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-400">{log.eventType}</span>
              <span className="text-xs text-neutral-500">
                {new Date(log.createdAt).toLocaleString('pt-PT')}
              </span>
            </div>
            <div className="text-xs text-neutral-400">
              Operador: <span className="text-neutral-300">{log.operator}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetDownloadsTab({ asset }: { asset: any }) {
  const outputs = [
    { id: 'broadcast', label: 'Broadcast HD', desc: 'MP4 H.264 8 Mbps', available: asset.status === 'READY' },
    { id: 'proxy',     label: 'Proxy LowRes', desc: 'MP4 H.264 800 kbps', available: !!asset.proxyUrl },
    { id: 'thumbnails', label: 'Thumbnails', desc: 'VTT Sprite Sheet', available: !!asset.thumbnailUrl },
  ];

  return (
    <div className="space-y-3">
      {outputs.map(output => (
        <div key={output.id} className={`bg-neutral-900 rounded-xl border p-4 flex items-center justify-between ${
          output.available ? 'border-neutral-800' : 'border-neutral-800/50 opacity-50'
        }`}>
          <div>
            <div className="text-sm font-medium text-white">{output.label}</div>
            <div className="text-xs text-neutral-400">{output.desc}</div>
          </div>
          {output.available ? (
            <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Download
            </button>
          ) : (
            <span className="text-xs text-neutral-600">Não disponível</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Utilitários
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/ui/status-badge.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

interface NexoraStatusBadgeProps {
  status: string;
  animated?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse?: boolean }> = {
  INGESTED:         { label: 'Recebido',     color: 'bg-neutral-700 text-neutral-300' },
  QC_PENDING:       { label: 'QC a correr',  color: 'bg-blue-900 text-blue-300', pulse: true },
  QC_PASS:          { label: 'QC OK',        color: 'bg-green-900 text-green-300' },
  QC_QUARANTINE:    { label: 'Quarentena',   color: 'bg-amber-900 text-amber-300' },
  QC_REJECT:        { label: 'Rejeitado',    color: 'bg-red-900 text-red-300' },
  ANALYZING:        { label: 'A analisar',   color: 'bg-blue-900 text-blue-300', pulse: true },
  TRANSCODING:      { label: 'A transcodar', color: 'bg-blue-900 text-blue-300', pulse: true },
  AUDIO_PROCESSING: { label: 'A normalizar', color: 'bg-blue-900 text-blue-300', pulse: true },
  POST_QC:          { label: 'QC pós',       color: 'bg-blue-900 text-blue-300', pulse: true },
  DELIVERING:       { label: 'A entregar',   color: 'bg-purple-900 text-purple-300', pulse: true },
  READY:            { label: 'Pronto',       color: 'bg-green-900 text-green-400' },
  FAILED:           { label: 'Falhou',       color: 'bg-red-900 text-red-400' },
  // Estados de jobs
  PENDING:          { label: 'Pendente',     color: 'bg-neutral-700 text-neutral-300' },
  ACTIVE:           { label: 'Activo',       color: 'bg-blue-900 text-blue-300', pulse: true },
  COMPLETED:        { label: 'Completo',     color: 'bg-green-900 text-green-300' },
  CANCELLED:        { label: 'Cancelado',    color: 'bg-neutral-700 text-neutral-400' },
};

export function NexoraStatusBadge({ status }: NexoraStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-neutral-700 text-neutral-300' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/ui/vmaf-gauge.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

interface NexoraVMAFGaugeProps {
  score:   number;
  size?:   'sm' | 'md' | 'lg';
}

export function NexoraVMAFGauge({ score, size = 'md' }: NexoraVMAFGaugeProps) {
  const color = score >= 90 ? '#4ade80' : score >= 85 ? '#fb923c' : '#f87171';
  const label = score >= 90 ? 'Excelente' : score >= 85 ? 'Bom' : 'Fraco';

  const sizes = { sm: { r: 28, cx: 36, cy: 36, vb: '0 0 72 72', fs: 14, fss: 9, sw: 5 },
                  md: { r: 40, cx: 50, cy: 50, vb: '0 0 100 100', fs: 18, fss: 11, sw: 7 },
                  lg: { r: 52, cx: 65, cy: 65, vb: '0 0 130 130', fs: 24, fss: 12, sw: 9 } };

  const { r, cx, cy, vb, fs, fss, sw } = sizes[size];
  const circumference = 2 * Math.PI * r;
  // Usar apenas 75% do círculo (arco semicircular)
  const arcLength     = circumference * 0.75;
  const filledLength  = arcLength * (score / 100);
  const gapLength     = arcLength - filledLength;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={vb} width={cx * 2} height={cy * 2 * 0.7} className="overflow-visible">
        {/* Track (fundo) */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#262626" strokeWidth={sw}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={circumference * 0.375}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Fill (valor) */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          strokeDashoffset={circumference * 0.375}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Score */}
        <text x={cx} y={cy + 4} textAnchor="middle"
          fill="white" fontSize={fs} fontWeight="600" fontFamily="var(--font-mono, monospace)">
          {score.toFixed(0)}
        </text>
        {/* Label */}
        <text x={cx} y={cy + 4 + fss + 3} textAnchor="middle"
          fill={color} fontSize={fss} fontFamily="inherit">
          {label}
        </text>
      </svg>
      <span className="text-xs text-neutral-500">VMAF</span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/hooks/useAssetStatusSSE.ts
// ═══════════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Hook que subscreve actualizações SSE do estado de um asset.
 * Chama onUpdate sempre que o estado mudar.
 * Fecha a ligação quando o componente é desmontado.
 */
export function useAssetStatusSSE(
  assetId: string,
  onUpdate: (data: { type: string; data: any }) => void
): void {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${API_BASE}/api/v1/assets/${assetId}/status`;
    const es  = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onUpdate(parsed);
      } catch {
        // ignorar JSON inválido
      }
    };

    es.onerror = () => {
      // Reconectar automaticamente após 5s
      es.close();
      setTimeout(() => {
        eventSourceRef.current = new EventSource(url);
      }, 5000);
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [assetId]); // eslint-disable-line react-hooks/exhaustive-deps
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/lib/api.ts — Cliente da API Nexora
// ═══════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function nexoraFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexora_token') : null;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Erro desconhecido' } }));
    throw new Error(error.error?.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export const fetchMetricsSummary = () =>
  nexoraFetch<any>('/api/v1/metrics/summary');

export const fetchAssets = (filters: Record<string, any>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
  return nexoraFetch<any>(`/api/v1/assets?${params}`);
};

export const fetchAsset = (id: string) =>
  nexoraFetch<any>(`/api/v1/assets/${id}`);

export const fetchAssetJobs = (id: string) =>
  nexoraFetch<any>(`/api/v1/assets/${id}/jobs`);

export const fetchAuditLog = (id: string) =>
  nexoraFetch<any>(`/api/v1/assets/${id}/audit`);

export const fetchProfiles = () =>
  nexoraFetch<any>('/api/v1/profiles');

export const fetchQueueStats = () =>
  nexoraFetch<any>('/api/v1/queue/stats');

export async function uploadAsset(file: File, profile: string, onProgress: (pct: number) => void): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('profile', profile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload falhou: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Erro de rede'));
    xhr.open('POST', `${API_BASE}/api/v1/assets`);

    const token = localStorage.getItem('nexora_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.send(formData);
  });
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/providers.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // dados válidos por 30s
        retry:     2,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
