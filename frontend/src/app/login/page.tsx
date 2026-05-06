"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Film } from 'lucide-react';
import { NEXORA_VERSION, NEXORA_COPYRIGHT } from '@/lib/version';

export default function LoginPage() {
  const [username, setUsername] = useState('user-123');
  const [secret, setSecret] = useState('changeme');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const [dynamicVersion, setDynamicVersion] = useState(NEXORA_VERSION);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const data = await api.get<{ version: string }>('/system/version');
        if (data?.version) setDynamicVersion(data.version);
      } catch {
        // Silencioso, mantém fallback hardcoded
      }
    };
    fetchVersion();
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Delay artificial para garantir que o utilizador tem tempo de ver a indicação de estado
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const response = await api.post<{ accessToken: string }>('/auth/login', { userId: username, secret });
      if (response && response.accessToken) {
        setToken(response.accessToken);
        router.push('/');
      } else {
        setError('Erro desconhecido ao obter token.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-indigo-500/10 p-3">
              <Film className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-50">Bem-vindo ao Nexora</CardTitle>
          <CardDescription className="text-zinc-400">
            Introduza as suas credenciais para aceder ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">Utilizador</Label>
              <Input 
                id="username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret" className="text-zinc-300">Password</Label>
              <Input 
                id="secret" 
                type="password" 
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                disabled={loading}
              />
            </div>
            
            {loading && (
              <div className="flex items-center justify-center gap-2 py-1 text-indigo-400 animate-pulse">
                <span className="text-xs font-medium uppercase tracking-widest">A validar credenciais...</span>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-900/50 text-red-400">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11" 
              disabled={loading}
            >
              {loading ? 'A processar login...' : 'Entrar na Plataforma'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-zinc-500">Nexora Media Processing © {NEXORA_COPYRIGHT} | v{dynamicVersion}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
