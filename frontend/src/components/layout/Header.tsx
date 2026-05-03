"use client";

import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function Header() {
  const { token, logout } = useAuthStore();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        Nexora Media Processing / <span className="text-slate-900 dark:text-slate-100">Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        {token ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <User className="h-4 w-4" />
              <span>Admin</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Sem Autenticação (Modo Dev)</div>
        )}
      </div>
    </header>
  );
}
