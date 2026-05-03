"use client";

import { useEffect, useState } from "react";
import { AssetCard } from "@/components/assets/AssetCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Asset {
  id: string;
  filename: string;
  mimeType: string;
  size: string | null;
  status: string;
  profile: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedAssetsResponse {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        // Construir query string para os filtros e paginação
        const params = new URLSearchParams({
          page: "1",
          limit: "50",
        });
        
        if (statusFilter !== "ALL") {
          params.append("status", statusFilter);
        }
        if (search) {
          params.append("search", search);
        }

        const data = await api.get<PaginatedAssetsResponse>(`/assets?${params.toString()}`);
        setAssets(data.data || []);
      } catch (err) {
        console.error("Erro ao obter assets:", err);
      }
    };

    void fetchAssets();
    
    // Polling a cada 10 segundos
    const interval = setInterval(() => { void fetchAssets(); }, 10000);
    return () => clearInterval(interval);
  }, [search, statusFilter]);

  const filteredAssets = assets; // A filtragem agora é feita maioritariamente pelo backend

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
