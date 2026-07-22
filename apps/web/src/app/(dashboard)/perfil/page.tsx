'use client';

import { useState } from 'react';
import { Camera, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { UserAvatar } from '@/components/profile/user-avatar';
import { AvatarEditorDialog } from '@/components/profile/avatar-editor-dialog';

export default function PerfilPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: passwords.current, newPassword: passwords.new },
      });
      toast({ title: 'Senha alterada com sucesso', variant: 'success' });
      setShowPassword(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Perfil" description="Dados da conta">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <div className="relative">
              <UserAvatar
                name={user?.name}
                avatar={user?.avatar}
                className="h-24 w-24 border-4 border-background shadow-md ring-1 ring-border"
                fallbackClassName="text-xl"
              />
              <Button
                type="button"
                size="icon"
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full shadow-md"
                onClick={() => setAvatarEditorOpen(true)}
                aria-label="Alterar foto de perfil"
                title="Alterar foto de perfil"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAvatarEditorOpen(true)}>
              Alterar foto
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showPassword ? (
              <Button variant="outline" onClick={() => setShowPassword(true)}>Alterar senha</Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Senha atual</Label>
                  <Input type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPassword(false)}>Cancelar</Button>
                  <Button onClick={handleChangePassword} disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar senha'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AvatarEditorDialog
        open={avatarEditorOpen}
        onOpenChange={setAvatarEditorOpen}
        onSaved={refreshUser}
      />
    </DashboardLayout>
  );
}
