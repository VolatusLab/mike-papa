import { requireUser } from '@/lib/auth/session';
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
import { TelegramConfigForm } from '@/components/telegram/telegram-config-form';
import { toggleTelegramConfigAction } from '@/lib/telegram/config-actions';

export default async function TelegramPage() {
  const { user } = await requireUser();
  const configs = await repos.telegramConfig.listByUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Telegram</h1>
        <p className="text-sm text-slate-500">
          Cadastre o bot e o chat que receberão os alertas de mandados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova configuração</CardTitle>
            <CardDescription>
              Crie um bot com o @BotFather e obtenha o chat_id do destino.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramConfigForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurações ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rótulo</TableHead>
                  <TableHead>chat_id</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.length === 0 ? (
                  <TableEmpty colSpan={5} message="Nenhuma configuração." />
                ) : (
                  configs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-slate-800">{c.label}</TableCell>
                      <TableCell className="tabular-nums text-slate-600">{c.chatId}</TableCell>
                      <TableCell>
                        {c.sendPdf ? (
                          <Badge tone="success">Sim</Badge>
                        ) : (
                          <Badge tone="neutral">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.alertEnabled ? (
                          <Badge tone="success">Ativo</Badge>
                        ) : (
                          <Badge tone="neutral">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <form action={toggleTelegramConfigAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="enabled" value={String(!c.alertEnabled)} />
                          <Button
                            type="submit"
                            size="sm"
                            variant={c.alertEnabled ? 'ghost' : 'secondary'}
                          >
                            {c.alertEnabled ? 'Desativar' : 'Ativar'}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
