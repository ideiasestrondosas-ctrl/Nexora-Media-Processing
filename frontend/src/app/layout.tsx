import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../app/globals.css";
import { ReactQueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { LayoutWrapper } from "./layout-wrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexora Media Processing",
  description: "Plataforma de Processamento de Media Profissional",
};

import { ThemeProvider } from "@/components/theme-provider";
import { ConnectionStatusMonitor } from "@/components/system/ConnectionStatusMonitor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className={inter.className}>
        <ReactQueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConnectionStatusMonitor />
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
            <Toaster />
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
