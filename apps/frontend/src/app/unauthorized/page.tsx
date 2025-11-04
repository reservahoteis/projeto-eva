'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-destructive p-3">
              <ShieldAlert className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Acesso Negado</CardTitle>
          <CardDescription className="text-center">
            Você não tem permissão para acessar esta página
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-center text-muted-foreground">
            Entre em contato com o administrador do sistema para solicitar acesso ou verifique se você está logado com
            a conta correta.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={() => router.back()} variant="outline" className="flex-1">
            Voltar
          </Button>
          <Button onClick={() => router.push('/login')} className="flex-1">
            Ir para Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
