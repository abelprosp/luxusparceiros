'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email, password, rememberMe });
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.', variant: 'success' });
      router.push('/dashboard');
    } catch (err) {
      toast({
        title: 'Erro no login',
        description: err instanceof Error ? err.message : 'Credenciais inválidas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-luxus-black p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold">Luxus Telefonia</p>
            <p className="text-sm text-white/60">Parceiros</p>
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Gestão premium de parceiros e vendas
          </h1>
          <p className="max-w-md text-lg text-white/70">
            Plataforma completa para administração de parceiros, estoque, comissões e muito mais.
          </p>
        </div>
        <p className="text-sm text-white/40">© 2026 Luxus Telefonia. Todos os direitos reservados.</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 shadow-soft lg:border">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary lg:hidden">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
            <CardDescription>Acesse sua conta de parceiro</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@luxus.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal">
                  Lembrar de mim
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
