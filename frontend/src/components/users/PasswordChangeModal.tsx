"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordChangeModal({
  isOpen,
  onClose,
  username,
  userId: _,
}: {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  userId: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => api.put("/users/password", data),
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.data?.message || "Erro ao alterar password.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As novas passwords não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova password deve ter pelo menos 6 caracteres.");
      return;
    }

    mutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-background/95 backdrop-blur-md border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Alterar Password: {username}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {success ? (
            <div className="py-6 flex flex-col items-center justify-center gap-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-12 w-12 animate-in zoom-in" />
              <p className="font-semibold text-lg text-center">Password alterada com sucesso!</p>
              <p className="text-sm text-muted-foreground">A fechar janela...</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="current">Password Actual</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new">Nova Password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar Nova Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova password"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Alteração
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
