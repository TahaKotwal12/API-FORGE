import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@apiforge/db';
import * as yaml from 'js-yaml';
import { SpecService } from '../spec/spec.service';

export interface GenerateOptions {
  language: string;
  mode: string;
  packageName?: string;
  packageVersion?: string;
}

export interface GenerationResult {
  runId: string;
  language: string;
  mode: string;
  specHash: string;
  bundleBase64: string;
  fileCount: number;
}

@Injectable()
export class GeneratorService {
  private readonly forgeServerUrl: string;

  constructor(
    private readonly spec: SpecService,
    private readonly config: ConfigService,
  ) {
    this.forgeServerUrl = this.config.get<string>('app.forgeServerUrl') ?? 'http://127.0.0.1:7070';
    console.log('[GeneratorService] forgeServerUrl =', this.forgeServerUrl);
  }

  private async checkMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    return m;
  }

  private async resolveBranch(projectId: string, branchName: string) {
    const branch = await prisma.branch.findUnique({
      where: { projectId_name: { projectId, name: branchName } },
      include: { project: { select: { orgId: true, name: true } } },
    });
    if (!branch) throw new NotFoundException(`Branch "${branchName}" not found`);
    return branch;
  }

  async generate(
    userId: string,
    projectId: string,
    branchName: string,
    opts: GenerateOptions,
  ): Promise<GenerationResult> {
    const branch = await this.resolveBranch(projectId, branchName);
    await this.checkMembership(userId, branch.project.orgId);

    const composed = await this.spec.compose(userId, projectId, branchName);
    const specStr = yaml.dump(composed);

    const run = await prisma.generationRun.create({
      data: {
        projectId,
        userId,
        language: opts.language,
        mode: opts.mode,
        options: {
          packageName: opts.packageName,
          packageVersion: opts.packageVersion,
        },
        status: 'RUNNING',
      },
    });

    let result: GenerationResult;
    try {
      const url = `${this.forgeServerUrl}/generate`;
      console.log('[GeneratorService] calling forge-server at:', url);
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spec: specStr,
            language: opts.language,
            mode: opts.mode,
            package_name: opts.packageName,
            package_version: opts.packageVersion,
          }),
        });
      } catch (fetchErr) {
        console.error('[GeneratorService] fetch error:', fetchErr);
        throw new ServiceUnavailableException('Generator service unavailable');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        throw new BadRequestException(`Generation failed: ${errorText}`);
      }

      const body = (await response.json()) as {
        spec_hash: string;
        bundle_base64: string;
        file_count: number;
      };

      await prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          specHash: body.spec_hash,
          completedAt: new Date(),
        },
      });

      result = {
        runId: run.id,
        language: opts.language,
        mode: opts.mode,
        specHash: body.spec_hash,
        bundleBase64: body.bundle_base64,
        fileCount: body.file_count,
      };
    } catch (err) {
      await prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
      throw err;
    }

    return result;
  }

  async listRuns(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.checkMembership(userId, project.orgId);

    return prisma.generationRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        language: true,
        mode: true,
        status: true,
        specHash: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async getRun(userId: string, projectId: string, runId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.checkMembership(userId, project.orgId);

    const run = await prisma.generationRun.findFirst({ where: { id: runId, projectId } });
    if (!run) throw new NotFoundException('Generation run not found');
    return run;
  }
}
