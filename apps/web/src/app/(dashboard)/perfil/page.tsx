'use client';

import { useEffect, useState } from 'react';
import { Building2, Lock } from 'lucide-react';
import { getInitials } from '@luxus/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toaster';

interface PartnerProfile {
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  pixKeyType?: string;
}

export default function PerfilPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bankForm, setBankForm] = useState<PartnerProfile>({
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    pixKey: '',
    pixKeyType: 'CPF',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<PartnerProfile>('/profile/partner')
      .then((data) => setBankForm({
        bankName: data.bankName ?? '',
        bankAgency: data.bankAgency ?? '',
        bankAccount: data.bankAccount ?? '',
        pixKey: data.pixKey ?? '',
        pixKeyType: data.pixKeyType ?? 'CPF',
      }))
      .catch(() => {});
  }, []);

  const handleSaveBank = async () => {
    setLoading(true);
    try {
      await api('/profile/partner', { method: 'PUT', body: bankForm });
      toast({ title: 'Dados bancários atualizados', variant: 'success' });
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
    <DashboardLayout title="Perfil" description="Dados da conta e informações bancárias">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-xl">{user ? getInitials(user.name) : 'P'}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Dados bancários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input value={bankForm.bankAgency} onChange={(e) => setBankForm({ ...bankForm, bankAgency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input value={bankForm.bankAccount} onChange={(e) => setBankForm({ ...bankForm, bankAccount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={bankForm.pixKey} onChange={(e) => setBankForm({ ...bankForm, pixKey: e.target.value })} />
            </div>
            <Button onClick={handleSaveBank} disabled={loading} variant="outline">
              {loading ? 'Salvando...' : 'Salvar dados bancários'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
