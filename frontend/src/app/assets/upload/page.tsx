"use client";

import { UploadZone } from "@/components/assets/UploadZone";
import { useAuthStore } from "@/store/auth";

export default function UploadPage() {
  const token = useAuthStore((state) => state.token);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Novo Asset</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Faça upload de um ficheiro de media para iniciar o workflow de processamento Nexora.
        </p>
      </div>
      
      <div className="mt-8">
        <UploadZone 
          uploadUrl="http://localhost:3000/api/v1/assets/upload"
          token={token}
        />
      </div>
    </div>
  );
}
