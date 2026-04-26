import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { AuditService } from '../audit/audit.service';

export interface CreateSecuritySchemeDto {
  name: string;
  scheme: object;
}

export interface UpdateSecuritySchemeDto {
  name?: string;
  scheme?: object;
}

@Injectable()
export class SecurityService {
  constructor(private audit: AuditService) {}

  private async resolveBranch(projectId: string, branchName: string) {
    const branch = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: branchName } },
      include: { project: { select: { orgId: true } } },
    });
    if (!branch) throw new NotFoundException(`Branch "${branchName}" not found`);
    return branch;
  }

  private async checkMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    return m;
  }

  async list(userId: string, projectId: string, branchName: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);
    return prisma.securityScheme.findMany({ where: { branchId: branch.id }, orderBy: { name: 'asc' } });
  }

  async create(userId: string, projectId: string, branchName: string, dto: CreateSecuritySchemeDto) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const existing = await prisma.securityScheme.findUnique({
      where: { branchId_name: { branchId: branch.id, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Security scheme "${dto.name}" already exists`);

    const ss = await prisma.securityScheme.create({
      data: { branchId: branch.id, name: dto.name, scheme: dto.scheme },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'security-scheme.create',
      resource: 'security-scheme',
      resourceId: ss.id,
      after: dto,
    });
    return ss;
  }

  async findById(userId: string, projectId: string, branchName: string, schemeId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);
    const ss = await prisma.securityScheme.findFirst({ where: { id: schemeId, branchId: branch.id } });
    if (!ss) throw new NotFoundException('Security scheme not found');
    return ss;
  }

  async update(userId: string, projectId: string, branchName: string, schemeId: string, dto: UpdateSecuritySchemeDto) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const ss = await prisma.securityScheme.findFirst({ where: { id: schemeId, branchId: branch.id } });
    if (!ss) throw new NotFoundException('Security scheme not found');

    if (dto.name && dto.name !== ss.name) {
      const conflict = await prisma.securityScheme.findUnique({
        where: { branchId_name: { branchId: branch.id, name: dto.name } },
      });
      if (conflict) throw new ConflictException(`Security scheme "${dto.name}" already exists`);
    }

    const updated = await prisma.securityScheme.update({
      where: { id: schemeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.scheme !== undefined && { scheme: dto.scheme }),
      },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'security-scheme.update',
      resource: 'security-scheme',
      resourceId: schemeId,
      before: ss,
      after: dto,
    });
    return updated;
  }

  async delete(userId: string, projectId: string, branchName: string, schemeId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const ss = await prisma.securityScheme.findFirst({ where: { id: schemeId, branchId: branch.id } });
    if (!ss) throw new NotFoundException('Security scheme not found');

    await prisma.securityScheme.delete({ where: { id: schemeId } });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'security-scheme.delete',
      resource: 'security-scheme',
      resourceId: schemeId,
    });
  }
}
