import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma, Role } from '@apiforge/db';
import { EmailService } from '../auth/email.service';

@Injectable()
export class InvitesService {
  constructor(
    private email: EmailService,
    private config: ConfigService,
  ) {}

  async invite(actorId: string, orgId: string, recipientEmail: string, role: Role) {
    await this.requireAdminOrAbove(actorId, orgId);

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');

    const invite = await prisma.invite.create({
      data: {
        orgId,
        email: recipientEmail,
        role,
        invitedBy: actorId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const frontendUrl = this.config.get<{ FRONTEND_URL: string }>('app')!.FRONTEND_URL;
    this.email.sendInviteEmail(recipientEmail, org.name, invite.token, frontendUrl);

    return invite;
  }

  async accept(token: string, acceptorId: string) {
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
      throw new NotFoundException('Invite not found or expired');
    }

    const acceptor = await prisma.user.findUnique({ where: { id: acceptorId } });
    if (!acceptor) throw new NotFoundException('User not found');
    if (acceptor.email !== invite.email) throw new ForbiddenException('Email mismatch');

    await prisma.membership.upsert({
      where: { userId_orgId: { userId: acceptorId, orgId: invite.orgId } },
      create: { userId: acceptorId, orgId: invite.orgId, role: invite.role },
      update: { role: invite.role },
    });

    await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

    return { orgId: invite.orgId, role: invite.role };
  }

  async getByToken(token: string) {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { org: { select: { name: true, slug: true } } },
    });
    if (!invite || invite.expiresAt < new Date()) throw new NotFoundException('Invite not found or expired');
    return invite;
  }

  private async requireAdminOrAbove(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member');
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');
    return m;
  }
}
