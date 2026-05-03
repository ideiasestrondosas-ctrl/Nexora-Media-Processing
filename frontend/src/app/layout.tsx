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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className={inter.className}>
        <ReactQueryProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
