'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import {
  Loader2,
  Eye,
  EyeOff,
  LogIn,
  LayoutDashboard,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    icon: LogIn,
    title: 'Entre com suas credenciais',
    description: 'Use o e-mail e a senha fornecidos pelo administrador.',
    active: true,
  },
  {
    icon: LayoutDashboard,
    title: 'Acesse o painel completo',
    description: 'Visualize vendas, estoque, clientes e filiais em um só lugar.',
    active: false,
  },
  {
    icon: TrendingUp,
    title: 'Gerencie vendas e comissões',
    description: 'Acompanhe metas, comissões e o desempenho do seu negócio.',
    active: false,
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen bg-luxus-black">
      {/* Painel esquerdo */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #0057FF 0%, #003EB5 35%, #0B0B0B 100%)',
          }}
        />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-20 left-10 h-56 w-56 rounded-full bg-primary-light/10 blur-3xl" />

        <div className="relative z-10">
          <LuxusLogo variant="full" forceDark />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight xl:text-4xl">
              Comece com a gente
            </h1>
            <p className="max-w-sm text-base text-white/70">
              Complete estes passos simples para acessar sua conta de parceiro.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="absolute bottom-4 left-[19px] top-4 w-px bg-white/20" />
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className={cn(
                    'relative flex gap-4 rounded-2xl border px-5 py-4 backdrop-blur-sm transition-colors',
                    step.active
                      ? 'border-white/20 bg-white/10'
                      : 'border-white/10 bg-black/20',
                  )}
                >
                  <div
                    className={cn(
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                      step.active
                        ? 'border-white/30 bg-white/15'
                        : 'border-white/15 bg-white/5',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © 2026 Luxus Telefonia. Todos os direitos reservados.
        </p>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <LuxusLogo variant="full" forceDark />
          </div>

          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Entrar na Luxus
            </h2>
            <p className="text-sm text-white/50">
              Informe seus dados para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-white/60">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@luxusparceiros.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary/50 focus-visible:ring-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-white/60">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 border-white/10 bg-white/5 pr-11 text-white placeholder:text-white/30 focus-visible:border-primary/50 focus-visible:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="border-white/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
                <Label htmlFor="remember" className="text-sm font-normal text-white/60">
                  Lembrar de mim
                </Label>
              </div>
              <Link
                href="/forgot-password"
                className="text-xs text-white/50 transition-colors hover:text-primary"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-light text-base font-semibold shadow-lg shadow-primary/25 hover:from-primary/90 hover:to-primary-light/90"
            >
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

          <p className="mt-8 text-center text-sm text-white/40">
            Precisa de acesso?{' '}
            <span className="text-white/60">Entre em contato com o administrador.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
