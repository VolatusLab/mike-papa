import type { PrismaClient, Role, User } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export interface CreateUserInput {
  /** Supabase Auth UUID — must already exist in auth.users. */
  id: string;
  tenantId: string;
  email: string;
  role?: Role;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  listByTenant(tenantId: string, opts: ListOptions = {}): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  countByTenant(tenantId: string): Promise<number> {
    return this.prisma.user.count({ where: { tenantId } });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        email: input.email,
        role: input.role ?? 'USER',
      },
    });
  }

  setRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  deactivate(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { active: false } });
  }
}
