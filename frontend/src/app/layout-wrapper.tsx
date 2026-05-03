"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/store/auth";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !token && pathname !== '/login') {
      router.push('/login');
    }
  }, [mounted, token, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4"></div>
          <p className="text-zinc-500">A carregar...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <main className="flex-1">{children}</main>;
  }

  if (!token) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
