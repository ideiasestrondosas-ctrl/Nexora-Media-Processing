"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { LayoutDashboard, Film, UploadCloud, ListVideo, Settings, Users, Menu, Wrench, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Film },
  { href: "/assets/upload", label: "Upload", icon: UploadCloud },
  { href: "/queue", label: "Filas (Queue)", icon: ListVideo },
  { href: "/profiles", label: "Perfis de Encoding", icon: Settings },
  { href: "/users", label: "Utilizadores", icon: Users },
  { href: "/manual", label: "Manual", icon: BookOpen },
  { href: "/settings", label: "Definições", icon: Wrench },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "bg-card border-r transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b">
        {sidebarOpen && (
          <span className="font-bold text-xl text-primary truncate">
            Nexora
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0 text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    !sidebarOpen && "justify-center px-0"
                  )}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "")} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
