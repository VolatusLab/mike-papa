import type { PrismaClient, Tenant } from '@prisma/client';

export class TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  list(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  }

  create(data: { id?: string; name: string; plan?: string }): Promise<Tenant> {
    return this.prisma.tenant.create({ data });
  }

  setActive(id: string, active: boolean): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data: { active } });
  }
}
