"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, KeyRound, Loader2, Plus, Trash2, X, ShieldCheck } from "lucide-react";
import { Users, KeyRound, Loader2, Plus, Trash2, X, ShieldCheck, FolderOpen, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
export default function UsersPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const isAdmin = authUser?.roles?.includes("ADMIN") || authUser?.sub === "user-123";
  const { toast } = useToast();

  // ── Password change state ────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // ── Create user modal state ──────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");
  const [createError, setCreateError] = useState("");

  // ── Delete confirmation state ────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // ── Queries ──────────────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<any>("/settings"),
    enabled: isAdmin,
  });

  const [localPath, setLocalPath] = useState("");

  // Sync initial settings data to state
  import { useEffect } from "react";
  useEffect(() => {
    if (settingsData) {
      setLocalPath(settingsData.localStoragePath || "");
    }
  }, [settingsData]);

  // ── Mutations ────────────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) =>
      api.post("/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreateModal(false);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("USER");
      setCreateError("");
    },
    onError: (error: any) => {
      setCreateError(
        error.data?.message || "Erro ao criar utilizador. Username pode já existir."
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.put("/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Configurações guardadas com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao guardar",
        description: error.data?.error || "Caminho inválido ou sem permissões.",
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    mutationFn: (data: any) => api.put("/users/password", data),
    onSuccess: () => {
      setPasswordSuccess("Password alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    },
    onError: (error: any) => {
      setPasswordError(
        error.data?.message || "Erro ao alterar password. Verifique a password actual."
      );
    },
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

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newUsername || !newUserPassword) return;
    createUserMutation.mutate({
      username: newUsername,
      password: newUserPassword,
      role: newUserRole,
    });
  };

  return (
    <>
      {/* Modal: Criar Utilizador */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
              <h2 className="text-lg font-semibold">Novo Utilizador</h2>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <Label>Username *</Label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ex: operador-1"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Função</Label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USER">Utilizador</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              {createError && (
                <p className="text-sm text-red-500 font-medium">{createError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowCreateModal(false); setCreateError(""); }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Criar Utilizador
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminação */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Apagar Utilizador</h3>
            <p className="text-slate-500 text-sm">
              Tem a certeza que quer apagar <strong>{deleteTarget.username}</strong>? Esta acção é
              irreversível.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteUserMutation.isPending}
                onClick={() => deleteUserMutation.mutate(deleteTarget.id)}
              >
                {deleteUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Apagar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Página principal */}
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
          {/* Tabela de utilizadores */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Contas de Sistema</CardTitle>
                  <CardDescription>Lista de utilizadores com acesso ao Nexora.</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowCreateModal(true)}
                >
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
                            <div className="flex items-center gap-2">
                              {user.username}
                              {user.username === authUser?.sub && (
                                <span className="text-xs text-blue-500 font-semibold">(Eu)</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                              {user.role === "ADMIN" && (
                                <ShieldCheck className="h-3 w-3 text-blue-500" />
                              )}
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {new Date(user.createdAt).toLocaleDateString("pt-PT")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              disabled={user.username === authUser?.sub}
                              title={
                                user.username === authUser?.sub
                                  ? "Não pode apagar a sua própria conta"
                                  : "Apagar utilizador"
                              }
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {usersData?.users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                            Nenhum utilizador encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Formulário: alterar password */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                  Alterar Password
                </CardTitle>
                <CardDescription>
                  Conta actual: <strong>{authUser?.sub ?? "—"}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Password Actual</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nova Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Nova Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  {passwordError && (
                    <p className="text-sm text-red-500 font-medium">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className="text-sm text-green-500 font-medium">{passwordSuccess}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      updatePasswordMutation.isPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                  >
                    {updatePasswordMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Actualizar Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Configurações (Apenas Admin) */}
            {isAdmin && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-slate-400" />
                    Armazenamento Local
                  </CardTitle>
                  <CardDescription>
                    Caminho no servidor para assets locais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); updateSettingsMutation.mutate({ localStoragePath: localPath }); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pasta de Destino Absoluta</Label>
                      <Input
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                        placeholder="ex: C:\NexoraStorage\assets"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full gap-2"
                      variant="secondary"
                      disabled={updateSettingsMutation.isPending || !localPath}
                    >
                      {updateSettingsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Guardar Caminho
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
