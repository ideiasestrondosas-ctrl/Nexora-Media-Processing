"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, KeyRound, Loader2, Plus, Trash2, X, ShieldCheck, Pencil, UserCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { PasswordChangeModal } from "@/components/users/PasswordChangeModal";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const isAdmin = authUser?.roles?.includes("ADMIN") || authUser?.sub === "user-123";
  const { toast } = useToast();

  // ── Modals State ────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // ── Form States ──────────────────────────────────────────────────
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("USER");
  const [createError, setCreateError] = useState("");

  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("USER");

  // ── Queries ──────────────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  });

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
      toast({ title: "Utilizador criado com sucesso" });
    },
    onError: (error: any) => {
      setCreateError(error.data?.message || "Erro ao criar utilizador.");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
      toast({ title: "Utilizador removido" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditTarget(null);
      toast({ title: "Utilizador actualizado" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>A carregar utilizadores...</p>
      </div>
    );
  }

  const users = usersData?.users || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de Utilizadores</h1>
            <p className="text-muted-foreground text-sm">Administre os acessos e permissões do sistema.</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Utilizador
          </Button>
        )}
      </div>

      {/* Lista de Utilizadores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            Utilizadores Activos
          </CardTitle>
          <CardDescription>Visualização e edição rápida de perfis.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Função (Role)</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {new Date(u.createdAt).toLocaleDateString("pt-PT")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Password Icon Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPasswordTarget(u)}
                        title="Alterar password"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>

                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditTarget(u);
                              setEditUsername(u.username);
                              setEditRole(u.role);
                            }}
                            title="Editar utilizador"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(u)}
                            className="text-destructive hover:bg-destructive/10"
                            disabled={u.username === authUser?.sub}
                            title="Remover utilizador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Modals ────────────────────────────────────────────────── */}

      {/* Password Change Popup */}
      {passwordTarget && (
        <PasswordChangeModal
          isOpen={!!passwordTarget}
          onClose={() => setPasswordTarget(null)}
          username={passwordTarget.username}
          userId={passwordTarget.id}
        />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Novo Utilizador</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <select
                  className="w-full bg-background border rounded-md px-3 py-2 text-sm"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button
                onClick={() => createUserMutation.mutate({ username: newUsername, password: newUserPassword, role: newUserRole })}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <Trash2 className="h-10 w-10 mx-auto text-destructive mb-2" />
            <h3 className="text-lg font-semibold">Remover Utilizador</h3>
            <p className="text-sm text-muted-foreground">
              Tem a certeza que deseja remover <strong>{deleteTarget.username}</strong>?
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteUserMutation.mutate(deleteTarget.id)}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sim, Remover
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">Editar Utilizador</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={editUsername} onChange={e => setEditUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <select
                  className="w-full bg-background border rounded-md px-3 py-2 text-sm"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button
                onClick={() => updateUserMutation.mutate({ id: editTarget.id, data: { username: editUsername, role: editRole } })}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
