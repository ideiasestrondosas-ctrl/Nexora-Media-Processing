"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { LogOut, User, BookOpen } from "lucide-react";
import Link from "next/link";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/assets": "Assets",
  "/assets/upload": "Novo Upload",
  "/queue": "Filas (Queue)",
  "/profiles": "Perfis de Encoding",
  "/users": "Utilizadores",
  "/settings": "Definições do Sistema",
  "/manual": "Manual de Utilizador",
};

function getPageLabel(pathname: string): string {
  // Exact match first
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  // Asset detail: /assets/[id]
  if (/^\/assets\/[^/]+$/.test(pathname) && pathname !== "/assets/upload") {
    return "Detalhe do Asset";
  }
  // Fallback: try prefix match (longest first)
  const sorted = Object.keys(ROUTE_LABELS).sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (route !== "/" && pathname.startsWith(route)) {
      return ROUTE_LABELS[route];
    }
  }
  return "Dashboard";
}

import { ModeToggle } from "@/components/mode-toggle";
import { UserManualPopup } from "./UserManualPopup";
import { useState, useEffect } from "react";

export function Header() {
  const { token, logout, user } = useAuthStore();
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);
  const [version, setVersion] = useState<string>("...");

  useEffect(() => {
    fetch("/api/v1/system/version")
      .then((res) => res.json())
      .then((data) => setVersion(data.version))
      .catch(() => setVersion("v1.1.0"));
  }, []);

  return (
    <header className="h-16 bg-background border-b flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb dinâmico */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60">Nexora Media Processing</span>
          <span className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold tracking-tight">
            {version}
          </span>
        </div>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-semibold">{pageLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        <UserManualPopup />
        <ModeToggle />

        {token ? (
          <div className="flex items-center gap-3 ml-2 border-l pl-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="hidden sm:inline font-medium text-foreground">{user?.sub ?? "Admin"}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">Sem Autenticação</div>
        )}
      </div>
    </header>
  );
}
