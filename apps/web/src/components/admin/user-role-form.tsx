'use client';

import { setUserRoleAction } from '@/lib/users/actions';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export interface UserRoleFormProps {
  userId: string;
  currentRole: 'ADMIN' | 'MODERATOR' | 'USER';
  /** true when this row is the acting admin — role change disabled. */
  isSelf: boolean;
}

export function UserRoleForm({ userId, currentRole, isSelf }: UserRoleFormProps) {
  if (isSelf) {
    return <span className="text-xs text-slate-400">você</span>;
  }
  return (
    <form action={setUserRoleAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={currentRole} className="h-8 w-36">
        <option value="USER">USER</option>
        <option value="MODERATOR">MODERATOR</option>
        <option value="ADMIN">ADMIN</option>
      </Select>
      <Button type="submit" size="sm" variant="secondary">
        Salvar
      </Button>
    </form>
  );
}
