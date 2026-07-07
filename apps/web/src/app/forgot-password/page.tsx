'use client';

import Link from 'next/link';
import { LuxusLogo } from '@/components/brand/luxus-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <LuxusLogo variant="icon" forceDark />
          </div>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Entre em contato com o administrador do sistema para redefinir sua senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
