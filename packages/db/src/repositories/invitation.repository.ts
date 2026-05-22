import { randomBytes } from 'node:crypto';
import type { Invitation, PrismaClient, Role } from '@prisma/client';

export interface CreateInvitationInput {
  email: string;
  role: Role;
  invitedBy: string;
  /** days until the invitation expires; default 7 */
  expiresInDays?: number;
}

export class InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(tenantId: string, input: CreateInvitationInput): Promise<Invitation> {
    const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000);
    return this.prisma.invitation.create({
      data: {
        tenantId,
        email: input.email.toLowerCase(),
        role: input.role,
        token: randomBytes(32).toString('hex'),
        invitedBy: input.invitedBy,
        expiresAt,
      },
    });
  }

  listPending(tenantId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  countPending(tenantId: string): Promise<number> {
    return this.prisma.invitation.count({ where: { tenantId, status: 'PENDING' } });
  }

  /** Most recent still-valid pending invitation for an email — used at sign-in sync. */
  findActiveByEmail(email: string): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: { email: email.toLowerCase(), status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAccepted(id: string): Promise<void> {
    await this.prisma.invitation.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  }

  async revoke(tenantId: string, id: string): Promise<boolean> {
    const r = await this.prisma.invitation.updateMany({
      where: { id, tenantId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    return r.count === 1;
  }
}
