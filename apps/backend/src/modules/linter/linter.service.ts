import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { lint } from '@apiforge/linter';
import type { LintResult, RulesetName } from '@apiforge/linter';
import { SpecService } from '../spec/spec.service';

@Injectable()
export class LinterService {
  constructor(private spec: SpecService) {}

  private async checkMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
  }

  private async resolveBranch(projectId: string, branchName: string) {
    const branch = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: branchName } },
      include: { project: { select: { orgId: true } } },
    });
    if (!branch) throw new NotFoundException(`Branch "${branchName}" not found`);
    return branch;
  }

  // Lint the entire composed spec for a branch
  async lintBranch(userId: string, projectId: string, branchName: string, ruleset: RulesetName = 'recommended'): Promise<LintResult> {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const doc = await this.spec.compose(userId, projectId, branchName);
    return lint(doc, { ruleset });
  }

  // Lint a single endpoint against the composed spec (faster feedback loop)
  async lintEndpoint(userId: string, projectId: string, branchName: string, endpointId: string, ruleset: RulesetName = 'recommended'): Promise<LintResult> {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const endpoint = await prisma.endpoint.findFirst({
      where: { id: endpointId, branchId: branch.id, deletedAt: null },
    });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    // Build a minimal spec containing just this endpoint
    const minimalSpec = {
      openapi: '3.1.0',
      info: { title: 'Lint check', version: '0.1.0' },
      paths: {
        [endpoint.path]: {
          [endpoint.method.toLowerCase()]: {
            operationId: `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[/{}-]/g, '_')}`,
            tags: endpoint.tags,
            summary: endpoint.summary,
            description: endpoint.description,
            parameters: endpoint.parameters,
            requestBody: endpoint.requestBody,
            responses: endpoint.responses,
            security: endpoint.security,
            deprecated: endpoint.deprecated,
          },
        },
      },
    };

    return lint(minimalSpec, { ruleset });
  }
}
