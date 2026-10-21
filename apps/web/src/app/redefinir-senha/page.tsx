'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password }, auth: false });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link inválido ou expirado. Peça um novo link.');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          Este link está incompleto. Peça um novo link de redefinição.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Pedir novo link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Senha alterada. Por segurança, as sessões abertas em outros dispositivos foram encerradas.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Entrar com a nova senha</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <LuxusLogo variant="icon" forceDark />
          </div>
          <CardTitle>Criar nova senha</CardTitle>
          <CardDescription>O link de redefinição vale por 1 hora e só pode ser usado uma vez.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-label="Carregando" />}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
