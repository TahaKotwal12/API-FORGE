import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HTTP as CerbosClient } from '@cerbos/http';
import { prisma, Visibility } from '@apiforge/db';
import { CERBOS_CLIENT } from '../cerbos/cerbos.constants';
import { AuditService } from '../audit/audit.service';

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(CERBOS_CLIENT) private cerbos: CerbosClient,
    private audit: AuditService,
  ) {}

  async listByOrg(actorId: string, orgId: string) {
    const membership = await this.requireMembership(actorId, orgId);
    const projects = await prisma.project.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Viewers can see all non-private; editors/admins/owners see all
    if (membership.role === 'VIEWER' || membership.role === 'GUEST') {
      return projects.filter((p) => p.visibility !== 'PRIVATE');
    }
    return projects;
  }

  async create(actorId: string, orgId: string, data: { name: string; description?: string; visibility?: Visibility }) {
    const membership = await this.requireMembership(actorId, orgId);

    // Only EDITOR and above can create projects — enforced via Cerbos
    await this.checkCerbosAction(actorId, membership.role, orgId, 'create');

    const slug = slugify(data.name);
    const existing = await prisma.project.findUnique({ where: { orgId_slug: { orgId, slug } } });
    if (existing) throw new ConflictException('Project slug already taken in this org');

    const project = await prisma.project.create({
      data: { orgId, name: data.name, slug, description: data.description, visibility: data.visibility ?? 'PRIVATE' },
    });

    // Create default main branch
    const branch = await prisma.branch.create({
      data: { projectId: project.id, name: 'main', protected: true, createdBy: actorId },
    });

    await prisma.project.update({ where: { id: project.id }, data: { defaultBranchId: branch.id } });

    await this.audit.log({
      orgId,
      actorId,
      action: 'project.create',
      resource: 'project',
      resourceId: project.id,
      after: data,
    });

    return { ...project, defaultBranchId: branch.id };
  }

  async findById(actorId: string, projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    await this.requireMembership(actorId, project.orgId);
    return project;
  }

  async update(actorId: string, projectId: string, data: Partial<{ name: string; description: string; visibility: Visibility }>) {
    const project = await this.findById(actorId, projectId);
    const membership = await this.requireMembership(actorId, project.orgId);
    await this.checkCerbosAction(actorId, membership.role, project.orgId, 'update');

    const updated = await prisma.project.update({ where: { id: projectId }, data });
    await this.audit.log({
      orgId: project.orgId,
      actorId,
      action: 'project.update',
      resource: 'project',
      resourceId: projectId,
      after: data,
    });
    return updated;
  }

  async delete(actorId: string, projectId: string) {
    const project = await this.findById(actorId, projectId);
    const membership = await this.requireMembership(actorId, project.orgId);
    await this.checkCerbosAction(actorId, membership.role, project.orgId, 'delete');

    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
    await this.audit.log({
      orgId: project.orgId,
      actorId,
      action: 'project.delete',
      resource: 'project',
      resourceId: projectId,
    });
  }

  private async requireMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    return m;
  }

  private async checkCerbosAction(actorId: string, role: string, orgId: string, action: string) {
    try {
      const decision = await this.cerbos.checkResource({
        principal: { id: actorId, roles: [role.toLowerCase()] },
        resource: { kind: 'project', id: orgId },
        actions: [action],
      });
      if (!decision.isAllowed(action)) {
        throw new ForbiddenException(`Not allowed to ${action} projects`);
      }
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      // Cerbos unavailable — fallback RBAC
      if (action === 'create' || action === 'update' || action === 'delete') {
        if (role === 'VIEWER' || role === 'GUEST') {
          throw new ForbiddenException('Insufficient permissions');
        }
      }
    }
  }
}
