"use client";

import { useState } from "react";
import { AssetCard } from "@/components/assets/AssetCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus } from "lucide-react";
import Link from "next/link";

// Dados simulados para UI base
const MOCK_ASSETS = [
  { id: "ast_123", originalName: "interview_raw_cam1.mxf", status: "PROCESSING", progress: 45, profile: "nexora_broadcast_hd", durationMs: 1450000, createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: "ast_124", originalName: "promo_final_v2.mp4", status: "READY", profile: "nexora_web_4k", durationMs: 30000, resolution: "3840x2160", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: "ast_125", originalName: "news_broll_corrupted.mov", status: "ERROR", profile: "nexora_social_vertical", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: "ast_126", originalName: "documentary_ep1_master.mxf", status: "QUARANTINE", profile: "nexora_broadcast_hd", durationMs: 3600000, resolution: "1920x1080", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: "ast_127", originalName: "podcast_ep45_video.mp4", status: "UPLOADED", profile: "nexora_web_1080p", durationMs: 5400000, createdAt: new Date().toISOString() },
];

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredAssets = MOCK_ASSETS.filter(asset => {
    const matchesSearch = asset.originalName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca de Assets</h1>
          <p className="text-sm text-slate-500">Gira e monitorize os ficheiros multimédia do sistema.</p>
        </div>
        <Button asChild>
          <Link href="/assets/upload" className="gap-2">
            <Plus className="h-4 w-4" /> Novo Asset
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Pesquisar por nome..." 
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Estados</SelectItem>
              <SelectItem value="PROCESSING">A processar</SelectItem>
              <SelectItem value="READY">Pronto</SelectItem>
              <SelectItem value="ERROR">Erro</SelectItem>
              <SelectItem value="QUARANTINE">Quarentena</SelectItem>
              <SelectItem value="UPLOADED">Apenas Upload</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredAssets.map(asset => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
        {filteredAssets.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            Nenhum asset encontrado com os filtros actuais.
          </div>
        )}
      </div>
    </div>
  );
}
