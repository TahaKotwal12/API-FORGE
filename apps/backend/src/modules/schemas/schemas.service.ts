import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { AuditService } from '../audit/audit.service';

export interface CreateSchemaDto {
  name: string;
  schema: object;
}

export interface UpdateSchemaDto {
  name?: string;
  schema?: object;
}

@Injectable()
export class SchemasService {
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
    return prisma.schemaComponent.findMany({ where: { branchId: branch.id }, orderBy: { name: 'asc' } });
  }

  async create(userId: string, projectId: string, branchName: string, dto: CreateSchemaDto) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const existing = await prisma.schemaComponent.findUnique({
      where: { branchId_name: { branchId: branch.id, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Schema "${dto.name}" already exists on this branch`);

    const sc = await prisma.schemaComponent.create({
      data: { branchId: branch.id, name: dto.name, schema: dto.schema },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'schema.create',
      resource: 'schema',
      resourceId: sc.id,
      after: dto,
    });
    return sc;
  }

  async findById(userId: string, projectId: string, branchName: string, schemaId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);
    const sc = await prisma.schemaComponent.findFirst({ where: { id: schemaId, branchId: branch.id } });
    if (!sc) throw new NotFoundException('Schema not found');
    return sc;
  }

  async update(userId: string, projectId: string, branchName: string, schemaId: string, dto: UpdateSchemaDto) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const sc = await prisma.schemaComponent.findFirst({ where: { id: schemaId, branchId: branch.id } });
    if (!sc) throw new NotFoundException('Schema not found');

    if (dto.name && dto.name !== sc.name) {
      const conflict = await prisma.schemaComponent.findUnique({
        where: { branchId_name: { branchId: branch.id, name: dto.name } },
      });
      if (conflict) throw new ConflictException(`Schema "${dto.name}" already exists`);
    }

    const updated = await prisma.schemaComponent.update({
      where: { id: schemaId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.schema !== undefined && { schema: dto.schema }),
      },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'schema.update',
      resource: 'schema',
      resourceId: schemaId,
      before: sc,
      after: dto,
    });
    return updated;
  }

  async delete(userId: string, projectId: string, branchName: string, schemaId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const sc = await prisma.schemaComponent.findFirst({ where: { id: schemaId, branchId: branch.id } });
    if (!sc) throw new NotFoundException('Schema not found');

    await prisma.schemaComponent.delete({ where: { id: schemaId } });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'schema.delete',
      resource: 'schema',
      resourceId: schemaId,
    });
  }
}
