import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, HttpMethod } from '@apiforge/db';
import { AuditService } from '../audit/audit.service';

export interface CreateEndpointDto {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: object[];
  requestBody?: object;
  responses?: object;
  security?: object[];
  deprecated?: boolean;
  extensions?: object;
  order?: number;
}

export type UpdateEndpointDto = Partial<CreateEndpointDto>;

@Injectable()
export class EndpointsService {
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

    return prisma.endpoint.findMany({
      where: { branchId: branch.id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async create(userId: string, projectId: string, branchName: string, dto: CreateEndpointDto) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') {
      throw new ForbiddenException('Insufficient permissions to create endpoints');
    }

    // Check for duplicate method+path
    const existing = await prisma.endpoint.findFirst({
      where: { branchId: branch.id, method: dto.method, path: dto.path, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Endpoint ${dto.method} ${dto.path} already exists on this branch`);
    }

    const endpoint = await prisma.endpoint.create({
      data: {
        branchId: branch.id,
        method: dto.method,
        path: dto.path,
        summary: dto.summary,
        description: dto.description,
        tags: dto.tags ?? [],
        parameters: (dto.parameters ?? []) as object,
        requestBody: dto.requestBody as object | undefined,
        responses: (dto.responses ?? { '200': { description: 'Success' } }) as object,
        security: dto.security as object | undefined,
        deprecated: dto.deprecated ?? false,
        extensions: (dto.extensions ?? {}) as object,
        order: dto.order ?? 0,
      },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'endpoint.create',
      resource: 'endpoint',
      resourceId: endpoint.id,
      after: dto,
    });

    return endpoint;
  }

  async findById(userId: string, projectId: string, branchName: string, endpointId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, branchId: branch.id, deletedAt: null },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');
    return endpoint;
  }

  async update(
    userId: string,
    projectId: string,
    branchName: string,
    endpointId: string,
    dto: UpdateEndpointDto,
  ) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, branchId: branch.id, deletedAt: null },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    // Check for path/method conflict if either is changing
    if (dto.method !== undefined || dto.path !== undefined) {
      const newMethod = dto.method ?? endpoint.method;
      const newPath = dto.path ?? endpoint.path;
      const conflict = await prisma.endpoint.findFirst({
        where: {
          branchId: branch.id,
          method: newMethod,
          path: newPath,
          deletedAt: null,
          NOT: { id: endpointId },
        },
      });
      if (conflict) {
        throw new ConflictException(`Endpoint ${newMethod} ${newPath} already exists on this branch`);
      }
    }

    const updated = await prisma.endpoint.update({
      where: { id: endpointId },
      data: {
        ...(dto.method !== undefined && { method: dto.method }),
        ...(dto.path !== undefined && { path: dto.path }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.parameters !== undefined && { parameters: dto.parameters as object }),
        ...(dto.requestBody !== undefined && { requestBody: dto.requestBody as object }),
        ...(dto.responses !== undefined && { responses: dto.responses as object }),
        ...(dto.security !== undefined && { security: dto.security as object }),
        ...(dto.deprecated !== undefined && { deprecated: dto.deprecated }),
        ...(dto.extensions !== undefined && { extensions: dto.extensions as object }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'endpoint.update',
      resource: 'endpoint',
      resourceId: endpointId,
      before: endpoint,
      after: dto,
    });

    return updated;
  }

  async delete(userId: string, projectId: string, branchName: string, endpointId: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    const m = await this.checkMembership(userId, branch.project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, branchId: branch.id, deletedAt: null },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    await prisma.endpoint.update({ where: { id: endpointId }, data: { deletedAt: new Date() } });

    await this.audit.log({
      orgId: branch.project.orgId,
      actorId: userId,
      action: 'endpoint.delete',
      resource: 'endpoint',
      resourceId: endpointId,
    });
  }
}
