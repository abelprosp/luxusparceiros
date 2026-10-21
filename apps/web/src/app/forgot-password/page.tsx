'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <LuxusLogo variant="icon" forceDark />
          </div>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            {sent
              ? 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. O link vale por 1 hora.'
              : 'Informe o e-mail da sua conta para receber o link de redefinição.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground" role="status">
                Confira também a caixa de spam. Se não receber, fale com o administrador.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'forgot-error' : undefined}
                />
              </div>
              {error && (
                <p id="forgot-error" className="text-sm text-destructive" role="alert">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={sending}>
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {sending ? 'Enviando...' : 'Enviar link'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Voltar ao login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
