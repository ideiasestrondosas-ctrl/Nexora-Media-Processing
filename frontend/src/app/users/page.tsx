"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);

  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const updatePasswordMutation = useMutation({
    mutationFn: (data: any) => api.put('/users/password', data),
    onSuccess: () => {
      setPasswordSuccess("Password alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      setPasswordError(error.data?.message || "Erro ao alterar password. Verifique a password actual.");
    }
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("As novas passwords não coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova password deve ter pelo menos 6 caracteres.");
      return;
    }

    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Utilizadores</h1>
            <p className="text-slate-500 text-sm">Gestão de contas de acesso e segurança.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Contas de Sistema</CardTitle>
                <CardDescription>Lista de utilizadores com acesso ao Nexora.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Utilizador
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Criado a</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}
                          {user.username === authUser?.sub && <span className="ml-2 text-xs text-blue-500 font-semibold">(Eu)</span>}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-slate-400" />
                Alterar Password
              </CardTitle>
              <CardDescription>Atualize as credenciais da sua conta ({authUser?.sub}).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password Actual</label>
                  <Input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nova Password</label>
                  <Input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required 
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirmar Nova Password</label>
                  <Input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                    minLength={6}
                  />
                </div>

                {passwordError && <p className="text-sm text-red-500 font-medium">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-green-500 font-medium">{passwordSuccess}</p>}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={updatePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                >
                  {updatePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Actualizar Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
