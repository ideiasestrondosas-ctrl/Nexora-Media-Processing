"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export function ConnectionStatusMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Usar /health/live que é leve
        const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health/live`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setIsOnline(true);
          setError(false);
        } else {
          setIsOnline(false);
        }
      } catch (err) {
        setIsOnline(false);
        setError(true);
      }
    };

    const interval = setInterval(checkConnection, 10000);
    checkConnection(); // Check immediately

    return () => clearInterval(interval);
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top duration-300">
      <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">
          Sem ligação ao servidor Nexora. Algumas funcionalidades podem estar indisponíveis.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs opacity-80 uppercase tracking-wider">A tentar restabelecer...</span>
        </div>
      </div>
    </div>
  );
}
