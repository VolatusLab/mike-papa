import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserRoleForm } from '@/components/admin/user-role-form';
import { InviteForm } from '@/components/admin/invite-form';
import { revokeInvitationAction } from '@/lib/invitations/actions';

function roleTone(role: string): 'danger' | 'warning' | 'neutral' {
  if (role === 'ADMIN') return 'danger';
  if (role === 'MODERATOR') return 'warning';
  return 'neutral';
}

export default async function AdminUsersPage() {
  const admin = await requireRole(['ADMIN']);
  const [users, pendingInvites] = await Promise.all([
    repos.user.listByTenant(admin.tenantId, { limit: 200 }),
    repos.invitation.listPending(admin.tenantId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
          ← Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-slate-500">
          Convide membros e gerencie papéis. Convites são consumidos no primeiro login.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar membro</CardTitle>
          <CardDescription>
            O convidado entra no tenant ao se cadastrar com o email convidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      {pendingInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-slate-800">{inv.email}</TableCell>
                    <TableCell>
                      <Badge tone={roleTone(inv.role)}>{inv.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {inv.expiresAt.toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Revogar
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Papel atual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alterar papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableEmpty colSpan={4} message="Nenhum usuário." />
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-800">{u.email}</TableCell>
                    <TableCell>
                      <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge tone="success">Ativo</Badge>
                      ) : (
                        <Badge tone="neutral">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserRoleForm userId={u.id} currentRole={u.role} isSelf={u.id === admin.id} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
