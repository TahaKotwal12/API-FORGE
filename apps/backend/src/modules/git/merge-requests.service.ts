import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { diffSpecs } from '@apiforge/spec-core';
import type { OpenAPIDocument } from '@apiforge/spec-core';
import { CommitsService } from './commits.service';

@Injectable()
export class MergeRequestsService {
  constructor(private commits: CommitsService) {}

  private async checkMembership(userId: string, orgId: string, writeRequired = false) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    if (writeRequired && (m.role === 'VIEWER' || m.role === 'GUEST')) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return m;
  }

  private async resolveProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(
    userId: string,
    projectId: string,
    data: { sourceBranch: string; targetBranch: string; title: string; description?: string },
  ) {
    const project = await this.resolveProject(projectId);
    await this.checkMembership(userId, project.orgId, true);

    // Verify both branches exist
    const [source, target] = await Promise.all([
      prisma.branch.findUnique({ where: { projectId_name: { projectId, name: data.sourceBranch } } }),
      prisma.branch.findUnique({ where: { projectId_name: { projectId, name: data.targetBranch } } }),
    ]);
    if (!source) throw new NotFoundException(`Source branch "${data.sourceBranch}" not found`);
    if (!target) throw new NotFoundException(`Target branch "${data.targetBranch}" not found`);
    if (data.sourceBranch === data.targetBranch) {
      throw new BadRequestException('Source and target branch must differ');
    }

    // Check for duplicate open MR
    const existing = await prisma.mergeRequest.findFirst({
      where: {
        projectId,
        sourceBranch: data.sourceBranch,
        targetBranch: data.targetBranch,
        status: 'OPEN',
      },
    });
    if (existing) throw new ConflictException('An open merge request already exists for these branches');

    return prisma.mergeRequest.create({
      data: {
        projectId,
        sourceBranch: data.sourceBranch,
        targetBranch: data.targetBranch,
        title: data.title,
        description: data.description,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
        reviews: true,
        _count: { select: { comments: true } },
      },
    });
  }

  async list(userId: string, projectId: string, status?: string) {
    const project = await this.resolveProject(projectId);
    await this.checkMembership(userId, project.orgId);

    return prisma.mergeRequest.findMany({
      where: {
        projectId,
        ...(status ? { status: status as 'OPEN' | 'MERGED' | 'CLOSED' } : {}),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
        reviews: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, mrId: string) {
    const mr = await prisma.mergeRequest.findUnique({
      where: { id: mrId },
      include: {
        project: { select: { orgId: true } },
        author: { select: { id: true, name: true, avatarUrl: true, email: true } },
        reviews: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!mr) throw new NotFoundException('Merge request not found');
    await this.checkMembership(userId, mr.project.orgId);
    return mr;
  }

  async diff(userId: string, mrId: string) {
    const mr = await this.findById(userId, mrId);

    const [sourceBranch, targetBranch] = await Promise.all([
      prisma.branch.findUnique({
        where: { projectId_name: { projectId: mr.projectId, name: mr.sourceBranch } },
      }),
      prisma.branch.findUnique({
        where: { projectId_name: { projectId: mr.projectId, name: mr.targetBranch } },
      }),
    ]);

    if (!sourceBranch || !targetBranch) throw new NotFoundException('Branch not found');

    // Load head snapshots for both branches
    const [sourceHead, targetHead] = await Promise.all([
      sourceBranch.headCommitId
        ? prisma.commit.findUnique({
            where: { id: sourceBranch.headCommitId },
            include: { specSnapshot: true },
          })
        : null,
      targetBranch.headCommitId
        ? prisma.commit.findUnique({
            where: { id: targetBranch.headCommitId },
            include: { specSnapshot: true },
          })
        : null,
    ]);

    const emptySpec: OpenAPIDocument = { openapi: '3.1.0', info: { title: '', version: '0.1.0' }, paths: {} };
    const base = (targetHead?.specSnapshot?.content ?? emptySpec) as unknown as OpenAPIDocument;
    const incoming = (sourceHead?.specSnapshot?.content ?? emptySpec) as unknown as OpenAPIDocument;

    const changes = diffSpecs(base, incoming);
    return { mrId, sourceBranch: mr.sourceBranch, targetBranch: mr.targetBranch, changes };
  }

  async approve(userId: string, mrId: string) {
    const mr = await this.findById(userId, mrId);
    await this.checkMembership(userId, mr.project.orgId, true);
    if (mr.status !== 'OPEN') throw new BadRequestException('Merge request is not open');

    return prisma.mrReview.upsert({
      where: { mrId_userId: { mrId, userId } },
      create: { mrId, userId, approved: true },
      update: { approved: true },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async addComment(userId: string, mrId: string, body: string, path?: string) {
    const mr = await this.findById(userId, mrId);
    await this.checkMembership(userId, mr.project.orgId);

    return prisma.mrComment.create({
      data: { mrId, authorId: userId, body, path },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async merge(userId: string, mrId: string) {
    const mr = await this.findById(userId, mrId);
    await this.checkMembership(userId, mr.project.orgId, true);
    if (mr.status !== 'OPEN') throw new BadRequestException('Merge request is not open');

    // Create a merge commit on the target branch using the source branch's composed spec.
    // Full three-way merge is deferred to a later phase.
    const commit = await this.commits.create(
      userId,
      mr.projectId,
      mr.targetBranch,
      `Merge branch '${mr.sourceBranch}' into '${mr.targetBranch}' (MR: ${mr.title})`,
    );

    // Update the target branch snapshot with the merged result
    // (commits.create already composed the current source state; for a real merge
    //  we'd apply the merged spec, but for phase 3 we accept the source state)
    await prisma.mergeRequest.update({
      where: { id: mrId },
      data: { status: 'MERGED', mergedBy: userId, mergedAt: new Date() },
    });

    return { merged: true, commitId: commit.id };
  }

  async close(userId: string, mrId: string) {
    const mr = await this.findById(userId, mrId);
    await this.checkMembership(userId, mr.project.orgId, true);
    if (mr.status !== 'OPEN') throw new BadRequestException('Merge request is not open');

    return prisma.mergeRequest.update({
      where: { id: mrId },
      data: { status: 'CLOSED' },
    });
  }
}
