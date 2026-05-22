import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoginForm } from '@/components/auth/login-form';

interface PageProps {
  searchParams: Promise<{ error?: string; next?: string; email?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse o painel BNMP Monitor.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sp.error ? <Alert tone="error">{decodeURIComponent(sp.error)}</Alert> : null}
        <LoginForm defaultEmail={sp.email ?? ''} />
      </CardContent>
    </Card>
  );
}
