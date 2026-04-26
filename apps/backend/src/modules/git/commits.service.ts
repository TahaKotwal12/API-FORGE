import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { prisma } from '@apiforge/db';
import { diffSpecs } from '@apiforge/spec-core';
import type { OpenAPIDocument } from '@apiforge/spec-core';
import { SpecService } from '../spec/spec.service';

@Injectable()
export class CommitsService {
  constructor(private specService: SpecService) {}

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

  async list(userId: string, projectId: string, branchName: string, limit = 50) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    return prisma.commit.findMany({
      where: { branchId: branch.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
        specSnapshot: { select: { id: true, sha256: true, size: true, format: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async create(userId: string, projectId: string, branchName: string, message: string) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId, true);

    // Compose the full spec for this branch
    const spec = await this.specService.compose(userId, projectId, branchName);
    const content = JSON.stringify(spec);
    const sha256 = createHash('sha256').update(content).digest('hex');

    // Find or create snapshot (dedup by hash)
    let snapshot = await prisma.specSnapshot.findUnique({ where: { sha256 } });
    if (!snapshot) {
      snapshot = await prisma.specSnapshot.create({
        data: {
          sha256,
          format: 'OPENAPI_3_1',
          content: spec as object,
          size: Buffer.byteLength(content, 'utf8'),
        },
      });
    }

    // Find parent commit
    const parentCommit = branch.headCommitId
      ? await prisma.commit.findUnique({ where: { id: branch.headCommitId } })
      : null;

    const commit = await prisma.commit.create({
      data: {
        branchId: branch.id,
        parentId: parentCommit?.id,
        message,
        authorId: userId,
        specSnapshotId: snapshot.id,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
        specSnapshot: { select: { id: true, sha256: true, size: true } },
      },
    });

    await prisma.branch.update({
      where: { id: branch.id },
      data: { headCommitId: commit.id },
    });

    return commit;
  }

  async diff(
    userId: string,
    projectId: string,
    branchName: string,
    fromSha: string,
    toSha: string,
  ) {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const [fromSnapshot, toSnapshot] = await Promise.all([
      prisma.specSnapshot.findUnique({ where: { sha256: fromSha } }),
      prisma.specSnapshot.findUnique({ where: { sha256: toSha } }),
    ]);

    if (!fromSnapshot) throw new NotFoundException(`Snapshot ${fromSha} not found`);
    if (!toSnapshot) throw new NotFoundException(`Snapshot ${toSha} not found`);

    const changes = diffSpecs(
      fromSnapshot.content as unknown as OpenAPIDocument,
      toSnapshot.content as unknown as OpenAPIDocument,
    );

    return { from: fromSha, to: toSha, changes };
  }
}
