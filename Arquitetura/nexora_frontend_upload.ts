// ═══════════════════════════════════════════════════════════════
// frontend/src/components/assets/upload-modal.tsx
// Wizard de upload em 4 passos: Ficheiro → Perfil → Opções → Progresso
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Upload, CheckCircle, AlertCircle, FileVideo, ChevronRight } from 'lucide-react';
import { uploadAsset, fetchProfiles } from '@/lib/api';

interface UploadModalProps {
  onClose:   () => void;
  onSuccess: () => void;
}

type Step = 'file' | 'profile' | 'options' | 'progress';

interface UploadFile {
  file:     File;
  id:       string;
  progress: number;
  status:   'pending' | 'uploading' | 'done' | 'error';
  assetId?: string;
  error?:   string;
}

const ACCEPTED_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/mpeg', 'audio/wav', 'audio/mpeg',
];

const MAX_FILE_SIZE_GB = 50;

export function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const [step, setStep]           = useState<Step>('file');
  const [files, setFiles]         = useState<UploadFile[]>([]);
  const [profile, setProfile]     = useState('nexora_broadcast_hd');
  const [priority, setPriority]   = useState<'high' | 'normal' | 'low'>('normal');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profilesData } = useQuery({
    queryKey: ['profiles'],
    queryFn:  fetchProfiles,
  });
  const profiles = profilesData?.data ?? [];

  // Validar e adicionar ficheiros
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const validated: UploadFile[] = arr
      .filter(f => {
        const sizeOk = f.size <= MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;
        return sizeOk; // magic bytes validados no servidor
      })
      .map(f => ({
        file:     f,
        id:       `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        progress: 0,
        status:   'pending' as const,
      }));

    setFiles(prev => [...prev, ...validated]);
    if (validated.length > 0) setStep('profile');
  }, []);

  // Drag & Drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // Submeter upload
  const handleUpload = useCallback(async () => {
    setStep('progress');

    for (const uploadFile of files) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
      ));

      try {
        const result = await uploadAsset(
          uploadFile.file,
          profile,
          (pct) => setFiles(prev => prev.map(f =>
            f.id === uploadFile.id ? { ...f, progress: pct } : f
          ))
        );

        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'done', progress: 100, assetId: result.data.id }
            : f
        ));
      } catch (err) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'error', error: String(err) }
            : f
        ));
      }
    }

    // Se todos concluídos com sucesso
    const allDone = files.every(f => f.status === 'done' || f.status === 'error');
    if (allDone) {
      setTimeout(() => onSuccess(), 1500);
    }
  }, [files, profile, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl
                      max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Adicionar assets</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-neutral-800">
          {(['file', 'profile', 'options', 'progress'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                ${step === s ? 'bg-blue-600 text-white' :
                  ['file','profile','options','progress'].indexOf(step) > i
                    ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                {i + 1}
              </div>
              {i < 3 && <div className="w-6 h-px bg-neutral-700" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-neutral-400 capitalize">{
            step === 'file' ? 'Seleccionar ficheiros' :
            step === 'profile' ? 'Escolher perfil' :
            step === 'options' ? 'Opções' : 'A fazer upload...'
          }</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* PASSO 1: Drop zone */}
          {step === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${isDragging
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/30'}`}
            >
              <Upload className="mx-auto mb-3 text-neutral-400" size={40} />
              <p className="text-white font-medium">Arrasta ficheiros ou clica para seleccionar</p>
              <p className="text-neutral-400 text-sm mt-1">
                MP4, MOV, MXF, MKV, TS, WAV, MP3 — máximo {MAX_FILE_SIZE_GB} GB por ficheiro
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_MIME_TYPES.join(',')}
                className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
            </div>
          )}

          {/* PASSO 2: Seleccionar perfil */}
          {step === 'profile' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  {files.length} ficheiro(s) seleccionado(s)
                </h3>
                <div className="space-y-1">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-sm text-neutral-400">
                      <FileVideo size={14} />
                      <span className="truncate">{f.file.name}</span>
                      <span className="text-neutral-600 shrink-0">
                        {(f.file.size / 1024 / 1024).toFixed(0)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-white mb-3">Escolher perfil de encoding</p>
                <div className="space-y-2">
                  {profiles.map((p: any) => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors
                        ${profile === p.id
                          ? 'border-blue-500 bg-blue-950/20'
                          : 'border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/30'}`}
                    >
                      <input
                        type="radio"
                        name="profile"
                        value={p.id}
                        checked={profile === p.id}
                        onChange={() => setProfile(p.id)}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{p.name}</span>
                          <span className="text-xs text-neutral-500">{p.codec} · {p.bitrate}</span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{p.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: Opções */}
          {step === 'options' && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-white block mb-2">Prioridade</label>
                <div className="flex gap-2">
                  {(['high', 'normal', 'low'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${priority === p
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
                    >
                      {p === 'high' ? '🔴 Alta' : p === 'normal' ? '🟡 Normal' : '🟢 Baixa'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-2">
                  Webhook URL <span className="text-neutral-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://meu-sistema.com/webhook"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2
                             text-sm text-white placeholder:text-neutral-500
                             focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Recebes uma notificação POST quando o asset estiver pronto.
                </p>
              </div>
            </div>
          )}

          {/* PASSO 4: Progresso */}
          {step === 'progress' && (
            <div className="space-y-3">
              {files.map(f => (
                <div key={f.id} className="bg-neutral-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white truncate max-w-xs">{f.file.name}</span>
                    {f.status === 'done'      && <CheckCircle size={16} className="text-green-400 shrink-0" />}
                    {f.status === 'error'     && <AlertCircle size={16} className="text-red-400 shrink-0" />}
                    {f.status === 'uploading' && (
                      <span className="text-xs text-blue-400">{f.progress}%</span>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        f.status === 'done' ? 'bg-green-500' :
                        f.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>

                  {f.error && (
                    <p className="text-xs text-red-400 mt-1">{f.error}</p>
                  )}
                  {f.assetId && (
                    <p className="text-xs text-neutral-500 mt-1">Asset ID: {f.assetId}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'progress' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800">
            <button
              onClick={() => {
                if (step === 'file') onClose();
                else if (step === 'profile') setStep('file');
                else if (step === 'options') setStep('profile');
              }}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {step === 'file' ? 'Cancelar' : 'Voltar'}
            </button>

            <button
              onClick={() => {
                if (step === 'profile' && files.length > 0) setStep('options');
                else if (step === 'options') handleUpload();
              }}
              disabled={step === 'profile' && files.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-medium rounded-lg transition-colors"
            >
              {step === 'options' ? (
                <><Upload size={16} /> Iniciar upload</>
              ) : (
                <>Continuar <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/(dashboard)/queue/page.tsx — Queue Monitor
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchQueueStats } from '@/lib/api';

const WORKER_LABELS: Record<string, string> = {
  ingest: 'Ingest', qc: 'QC pré', analyze: 'Análise',
  transcode: 'Transcode', audio: 'Áudio', subtitle: 'Legendas',
  proxy: 'Proxy', thumbnail: 'Thumbnails', 'qc-post': 'QC pós', delivery: 'Delivery',
};

export default function QueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn:  fetchQueueStats,
    refetchInterval: 5000, // polling 5s
  });

  const stats = data?.data;

  // Agregar por tipo de worker
  const queueDepths: Record<string, { waiting: number; active: number }> = {};
  (stats?.jobs ?? []).forEach((j: any) => {
    if (!queueDepths[j.type]) queueDepths[j.type] = { waiting: 0, active: 0 };
    if (j.status === 'PENDING')  queueDepths[j.type].waiting += j._count.id;
    if (j.status === 'ACTIVE')   queueDepths[j.type].active  += j._count.id;
  });

  const maxDepth = Math.max(1, ...Object.values(queueDepths).map(d => d.waiting + d.active));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Fila de Processamento</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Estado em tempo real das filas BullMQ — actualização cada 5s
        </p>
      </div>

      {/* Queue depth bars */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-5">Profundidade das filas</h2>
        <div className="space-y-3">
          {Object.entries(WORKER_LABELS).map(([key, label]) => {
            const depth = queueDepths[key] ?? { waiting: 0, active: 0 };
            const total = depth.waiting + depth.active;
            const pct   = (total / maxDepth) * 100;

            return (
              <div key={key} className="flex items-center gap-4">
                <span className="text-sm text-neutral-400 w-24 shrink-0">{label}</span>
                <div className="flex-1 h-6 bg-neutral-800 rounded-lg overflow-hidden relative">
                  {/* Active (azul) */}
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${(depth.active / maxDepth) * 100}%` }}
                  />
                  {/* Waiting (cinza) */}
                  <div
                    className="absolute top-0 h-full bg-neutral-600 transition-all duration-500"
                    style={{ left: `${(depth.active / maxDepth) * 100}%`, width: `${(depth.waiting / maxDepth) * 100}%` }}
                  />
                  {total > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-white z-10">
                      {total}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 w-28 shrink-0">
                  {depth.active > 0 && (
                    <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                      {depth.active} activo
                    </span>
                  )}
                  {depth.waiting > 0 && (
                    <span className="text-xs bg-neutral-700/50 text-neutral-300 px-2 py-0.5 rounded">
                      {depth.waiting} em fila
                    </span>
                  )}
                  {total === 0 && (
                    <span className="text-xs text-neutral-600">inactivo</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-neutral-800">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded" /><span className="text-xs text-neutral-400">A processar</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-neutral-600 rounded" /><span className="text-xs text-neutral-400">Em espera</span></div>
        </div>
      </div>

      {/* Assets por estado */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-neutral-300 mb-5">Assets por estado</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(stats?.assets ?? []).map((s: any) => (
            <div key={s.status} className="bg-neutral-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-semibold text-white">{s._count.id}</div>
              <div className="text-xs text-neutral-400 mt-1">{s.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/layout/sidebar.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Film, List, Activity, Settings
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',       icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/assets', icon: Film,            label: 'Assets' },
  { href: '/queue',  icon: Activity,        label: 'Fila' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Film size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">Nexora</div>
            <div className="text-xs text-neutral-500 leading-tight">Media Processing</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-blue-600/10 text-blue-400 font-medium'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-neutral-800">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Sistema operacional
        </div>
      </div>
    </aside>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/layout/topbar.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { fetchMetricsSummary } from '@/lib/api';

export function Topbar() {
  const { data } = useQuery({
    queryKey: ['metrics-summary'],
    queryFn:  fetchMetricsSummary,
    refetchInterval: 30000,
  });

  const successRate = data?.data?.today?.successRate ?? 100;

  return (
    <header className="h-14 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 text-xs ${
          successRate >= 90 ? 'text-green-400' :
          successRate >= 70 ? 'text-amber-400' : 'text-red-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            successRate >= 90 ? 'bg-green-400' :
            successRate >= 70 ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          Pipeline {successRate >= 90 ? 'saudável' : successRate >= 70 ? 'degradado' : 'com problemas'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/assets/assets-table.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import { NexoraStatusBadge } from '@/components/ui/status-badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AssetsTableProps {
  assets:        any[];
  isLoading:     boolean;
  meta?:         { total: number; hasMore: boolean };
  page:          number;
  pageSize:      number;
  onPageChange:  (page: number) => void;
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

export function AssetsTable({ assets, isLoading, meta, page, pageSize, onPageChange }: AssetsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-neutral-800 last:border-0">
            <div className="h-3 bg-neutral-800 rounded animate-pulse flex-1" />
            <div className="h-3 bg-neutral-800 rounded animate-pulse w-20" />
            <div className="h-3 bg-neutral-800 rounded animate-pulse w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center">
        <p className="text-neutral-400 text-sm">Nenhum asset encontrado.</p>
        <p className="text-neutral-600 text-xs mt-1">Adiciona o teu primeiro asset com o botão acima.</p>
      </div>
    );
  }

  const totalPages = meta ? Math.ceil(meta.total / pageSize) : 1;

  return (
    <div className="space-y-2">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_120px_100px_80px_80px_80px] gap-4 px-5 py-3
                        border-b border-neutral-800 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          <span>Nome</span>
          <span>Perfil</span>
          <span>Resolução</span>
          <span>Duração</span>
          <span>VMAF</span>
          <span>Estado</span>
        </div>

        {/* Rows */}
        {assets.map(asset => (
          <Link
            key={asset.id}
            href={`/assets/${asset.id}`}
            className="grid grid-cols-[1fr_120px_100px_80px_80px_80px] gap-4 px-5 py-3.5
                       items-center border-b border-neutral-800/60 last:border-0
                       hover:bg-neutral-800/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{asset.originalName}</p>
              <p className="text-xs text-neutral-500 mt-0.5 font-mono">{asset.id.slice(0, 8)}...</p>
            </div>
            <span className="text-xs text-neutral-400 truncate">{asset.profile?.replace('nexora_', '') ?? '—'}</span>
            <span className="text-xs font-mono text-neutral-400">{asset.resolution ?? '—'}</span>
            <span className="text-xs font-mono text-neutral-400">{formatDuration(asset.durationMs)}</span>
            <span className={`text-xs font-mono font-medium ${
              asset.vmafScore >= 90 ? 'text-green-400' :
              asset.vmafScore >= 85 ? 'text-amber-400' :
              asset.vmafScore ? 'text-red-400' : 'text-neutral-500'
            }`}>
              {asset.vmafScore != null ? asset.vmafScore.toFixed(0) : '—'}
            </span>
            <NexoraStatusBadge status={asset.status} />
          </Link>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-neutral-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, meta?.total ?? 0)} de {meta?.total ?? 0}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-neutral-400 px-2">Pág. {page} de {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!meta?.hasMore}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/assets/asset-filters.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import { Search } from 'lucide-react';

const STATUSES = [
  '', 'READY', 'TRANSCODING', 'QC_PENDING', 'QC_REJECT', 'FAILED',
];

interface AssetFiltersProps {
  filters:         Record<string, any>;
  onFiltersChange: (f: Record<string, any>) => void;
}

export function AssetFilters({ filters, onFiltersChange }: AssetFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={filters.search}
          onChange={e => onFiltersChange({ ...filters, search: e.target.value, page: 1 })}
          placeholder="Pesquisar por nome..."
          className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg
                     text-sm text-white placeholder:text-neutral-500
                     focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={e => onFiltersChange({ ...filters, status: e.target.value, page: 1 })}
        className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg
                   text-sm text-white focus:outline-none focus:border-blue-500"
      >
        {STATUSES.map(s => (
          <option key={s} value={s}>{s || 'Todos os estados'}</option>
        ))}
      </select>

      {/* Page size */}
      <select
        value={filters.pageSize}
        onChange={e => onFiltersChange({ ...filters, pageSize: Number(e.target.value), page: 1 })}
        className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg
                   text-sm text-white focus:outline-none focus:border-blue-500"
      >
        {[25, 50, 100].map(n => (
          <option key={n} value={n}>{n} por página</option>
        ))}
      </select>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/dashboard/metric-card.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

interface MetricCardProps {
  title:        string;
  value:        string | number;
  change?:      number;
  changeLabel?: string;
  isLoading?:   boolean;
  variant?:     'default' | 'success' | 'warning' | 'danger';
}

const VARIANT_COLORS = {
  default: 'text-white',
  success: 'text-green-400',
  warning: 'text-amber-400',
  danger:  'text-red-400',
};

export function MetricCard({ title, value, change, changeLabel, isLoading, variant = 'default' }: MetricCardProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{title}</p>
      {isLoading ? (
        <div className="h-8 bg-neutral-800 rounded animate-pulse mt-2 w-20" />
      ) : (
        <p className={`text-3xl font-semibold mt-2 ${VARIANT_COLORS[variant]}`}>
          {value}
        </p>
      )}
      {change != null && changeLabel && (
        <p className="text-xs text-neutral-500 mt-1">
          {change}% {changeLabel}
        </p>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/components/dashboard/recent-activity.tsx
// ═══════════════════════════════════════════════════════════════

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchAssets } from '@/lib/api';
import { NexoraStatusBadge } from '@/components/ui/status-badge';

export function RecentActivity() {
  const { data } = useQuery({
    queryKey: ['recent-assets'],
    queryFn:  () => fetchAssets({ pageSize: 8, page: 1 }),
    refetchInterval: 10000,
  });

  const assets = data?.data ?? [];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <h2 className="text-sm font-medium text-white">Actividade recente</h2>
        <Link href="/assets" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          Ver todos
        </Link>
      </div>

      <div>
        {assets.length === 0 ? (
          <div className="px-5 py-8 text-center text-neutral-500 text-sm">
            Nenhuma actividade recente.
          </div>
        ) : (
          assets.map((asset: any) => (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-neutral-800/60 last:border-0
                         hover:bg-neutral-800/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{asset.originalName}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {asset.profile?.replace('nexora_', '') ?? '—'} ·{' '}
                  {new Date(asset.createdAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              {asset.vmafScore != null && (
                <span className={`text-xs font-mono font-medium ${
                  asset.vmafScore >= 90 ? 'text-green-400' :
                  asset.vmafScore >= 85 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  VMAF {asset.vmafScore.toFixed(0)}
                </span>
              )}
              <NexoraStatusBadge status={asset.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// frontend/src/app/globals.css
// ═══════════════════════════════════════════════════════════════

/*
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}

*::-webkit-scrollbar { width: 5px; height: 5px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: #404040; border-radius: 10px; }

html { color-scheme: dark; }
body { min-height: 100vh; }
*/


// ═══════════════════════════════════════════════════════════════
// frontend/next.config.js
// ═══════════════════════════════════════════════════════════════

/*
/** @type {import('next').NextConfig} *\/
const nextConfig = {
  output: 'standalone',
  experimental: { typedRoutes: true },
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000' },
};

module.exports = nextConfig;
*/


// ═══════════════════════════════════════════════════════════════
// frontend/tailwind.config.ts
// ═══════════════════════════════════════════════════════════════

/*
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**\/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
*/
