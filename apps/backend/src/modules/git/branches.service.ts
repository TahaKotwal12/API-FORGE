import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@apiforge/db';

@Injectable()
export class BranchesService {
  private async resolveBranch(projectId: string, name: string) {
    const branch = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name } },
      include: { project: { select: { orgId: true } } },
    });
    if (!branch) throw new NotFoundException(`Branch "${name}" not found`);
    return branch;
  }

  private async checkMembership(userId: string, orgId: string, writeRequired = false) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    if (writeRequired && (m.role === 'VIEWER' || m.role === 'GUEST')) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return m;
  }

  async list(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    await this.checkMembership(userId, project.orgId);

    return prisma.branch.findMany({
      where: { projectId },
      include: { _count: { select: { commits: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, data: { name: string; fromBranch?: string }) {
    const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    await this.checkMembership(userId, project.orgId, true);

    const existing = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: data.name } },
    });
    if (existing) throw new ConflictException(`Branch "${data.name}" already exists`);

    let parentId: string | undefined;
    if (data.fromBranch) {
      const parent = await prisma.branch.findUnique({
        where: { projectId_name: { projectId, name: data.fromBranch } },
      });
      if (!parent) throw new NotFoundException(`Source branch "${data.fromBranch}" not found`);
      parentId = parent.id;
    }

    return prisma.branch.create({
      data: { projectId, name: data.name, createdBy: userId, parentId },
    });
  }

  async findByName(userId: string, projectId: string, name: string) {
    const branch = await this.resolveBranch(projectId, name);
    await this.checkMembership(userId, branch.project.orgId);
    return branch;
  }

  async delete(userId: string, projectId: string, name: string) {
    const branch = await this.resolveBranch(projectId, name);
    await this.checkMembership(userId, branch.project.orgId, true);

    if (branch.protected) throw new ForbiddenException('Cannot delete a protected branch');
    if (name === 'main') throw new ForbiddenException('Cannot delete the main branch');

    await prisma.branch.delete({ where: { id: branch.id } });
  }

  async protect(userId: string, projectId: string, name: string, protect: boolean) {
    const branch = await this.resolveBranch(projectId, name);
    await this.checkMembership(userId, branch.project.orgId, true);

    return prisma.branch.update({ where: { id: branch.id }, data: { protected: protect } });
  }
}
