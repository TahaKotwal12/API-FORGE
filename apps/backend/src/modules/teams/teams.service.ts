import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@apiforge/db';

@Injectable()
export class TeamsService {
  async listByOrg(actorId: string, orgId: string) {
    await this.requireMembership(actorId, orgId);
    return prisma.team.findMany({
      where: { orgId },
      include: { members: true },
    });
  }

  async create(actorId: string, orgId: string, name: string) {
    await this.requireAdminOrAbove(actorId, orgId);
    return prisma.team.create({ data: { orgId, name } });
  }

  async delete(actorId: string, orgId: string, teamId: string) {
    await this.requireAdminOrAbove(actorId, orgId);
    await prisma.team.delete({ where: { id: teamId } });
  }

  async addMember(actorId: string, orgId: string, teamId: string, userId: string) {
    await this.requireAdminOrAbove(actorId, orgId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.orgId !== orgId) throw new NotFoundException('Team not found');

    return prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId },
      update: {},
    });
  }

  async removeMember(actorId: string, orgId: string, teamId: string, userId: string) {
    await this.requireAdminOrAbove(actorId, orgId);
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  }

  private async requireMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member');
    return m;
  }

  private async requireAdminOrAbove(userId: string, orgId: string) {
    const m = await this.requireMembership(userId, orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');
    return m;
  }
}
