import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@apiforge/db';

interface AuditLogInput {
  orgId: string;
  actorId?: string;
  actorAgentId?: string;
  action: string;
  resource: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          orgId: input.orgId,
          actorId: input.actorId ?? null,
          actorAgentId: input.actorAgentId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId,
          before: input.before ? (input.before as object) : undefined,
          after: input.after ? (input.after as object) : undefined,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (e) {
      this.logger.error('Failed to write audit log', e);
    }
  }

  async getForOrg(orgId: string, limit = 50, cursor?: string) {
    const rows = await prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    return {
      data: rows.slice(0, limit),
      nextCursor: hasMore ? rows[limit - 1]?.id : null,
      hasMore,
    };
  }
}
