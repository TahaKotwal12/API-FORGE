import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HTTP as CerbosClient } from '@cerbos/http';
import { prisma, Role } from '@apiforge/db';
import { CERBOS_CLIENT } from '../cerbos/cerbos.constants';
import { AuditService } from '../audit/audit.service';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
}

@Injectable()
export class OrgsService {
  constructor(
    @Inject(CERBOS_CLIENT) private cerbos: CerbosClient,
    private audit: AuditService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { org: true },
    });
    return memberships.map((m) => ({ ...m.org, role: m.role }));
  }

  async create(userId: string, name: string, plan?: string) {
    const slug = slugify(name);

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Org slug already taken');

    const org = await prisma.organization.create({
      data: { name, slug, plan: (plan as 'FREE' | 'TEAM' | 'ENTERPRISE' | 'SELF_HOSTED') ?? 'FREE' },
    });

    await prisma.membership.create({
      data: { userId, orgId: org.id, role: Role.OWNER },
    });

    await this.audit.log({
      orgId: org.id,
      actorId: userId,
      action: 'org.create',
      resource: 'org',
      resourceId: org.id,
      after: { name, slug },
    });

    return org;
  }

  async findById(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');
    return org;
  }

  async findBySlug(slug: string) {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new NotFoundException('Org not found');
    return org;
  }

  async update(actorId: string, orgId: string, data: { name?: string }) {
    await this.requirePermission(actorId, orgId, 'update');

    const before = await prisma.organization.findUnique({ where: { id: orgId } });
    const org = await prisma.organization.update({ where: { id: orgId }, data });

    await this.audit.log({
      orgId,
      actorId,
      action: 'org.update',
      resource: 'org',
      resourceId: orgId,
      before,
      after: data,
    });

    return org;
  }

  async delete(actorId: string, orgId: string) {
    await this.requirePermission(actorId, orgId, 'delete');

    await this.audit.log({
      orgId,
      actorId,
      action: 'org.delete',
      resource: 'org',
      resourceId: orgId,
    });

    await prisma.organization.delete({ where: { id: orgId } });
  }

  async getMembers(actorId: string, orgId: string) {
    await this.requirePermission(actorId, orgId, 'read');
    return prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }

  async changeMemberRole(actorId: string, orgId: string, targetUserId: string, role: Role) {
    await this.requirePermission(actorId, orgId, 'manage_members');
    return prisma.membership.update({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      data: { role },
    });
  }

  async removeMember(actorId: string, orgId: string, targetUserId: string) {
    await this.requirePermission(actorId, orgId, 'manage_members');
    await prisma.membership.delete({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });
  }

  async getMembership(userId: string, orgId: string) {
    return prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
  }

  private async requirePermission(actorId: string, orgId: string, action: string) {
    const membership = await this.getMembership(actorId, orgId);
    if (!membership) throw new ForbiddenException('Not a member of this org');

    try {
      const decision = await this.cerbos.checkResource({
        principal: { id: actorId, roles: [membership.role.toLowerCase()] },
        resource: { kind: 'org', id: orgId },
        actions: [action],
      });

      if (!decision.isAllowed(action)) {
        throw new ForbiddenException(`Not allowed to ${action} this org`);
      }
    } catch (e) {
      // Cerbos unavailable — fall back to role-based check
      if (e instanceof ForbiddenException) throw e;
      if (membership.role === Role.VIEWER || membership.role === Role.GUEST) {
        if (action !== 'read') throw new ForbiddenException('Insufficient permissions');
      }
    }
  }
}
