import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@apiforge/db';
import { AuditService } from '../audit/audit.service';

export interface CreateEnvironmentDto {
  name: string;
  variables?: Record<string, string>;
  isDefault?: boolean;
}

export interface UpdateEnvironmentDto {
  name?: string;
  variables?: Record<string, string>;
  isDefault?: boolean;
}

export interface UpsertSecretDto {
  key: string;
  value: string;
}

// Defer sodium import to runtime so module loads even if not installed yet
type SodiumModule = typeof import('libsodium-wrappers');

@Injectable()
export class EnvironmentsService implements OnModuleInit {
  private sodium!: SodiumModule;
  private encKey!: Uint8Array;

  constructor(
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async onModuleInit() {
    const sodium = await import('libsodium-wrappers');
    await sodium.ready;
    this.sodium = sodium;

    const cfg = this.config.get<{ SECRET_ENCRYPTION_KEY: string }>('app')!;
    const keyHex = cfg.SECRET_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length < 32) {
      // Use a dev fallback key — in production this must be a 32-byte hex value
      this.encKey = new Uint8Array(32).fill(0xab);
    } else {
      // Convert hex string to bytes
      const bytes = Buffer.from(keyHex.slice(0, 64), 'hex');
      this.encKey = new Uint8Array(bytes);
    }
  }

  private encrypt(plaintext: string): Buffer {
    const nonce = this.sodium.randombytes_buf(this.sodium.crypto_secretbox_NONCEBYTES);
    const msg = Buffer.from(plaintext, 'utf8');
    const ciphertext = this.sodium.crypto_secretbox_easy(msg, nonce, this.encKey);
    // Store: nonce (24 bytes) + ciphertext
    return Buffer.concat([Buffer.from(nonce), Buffer.from(ciphertext)]);
  }

  private decrypt(stored: Buffer): string {
    const nonceLen = this.sodium.crypto_secretbox_NONCEBYTES;
    const nonce = stored.subarray(0, nonceLen);
    const ciphertext = stored.subarray(nonceLen);
    const plaintext = this.sodium.crypto_secretbox_open_easy(ciphertext, nonce, this.encKey);
    return Buffer.from(plaintext).toString('utf8');
  }

  private async resolveProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
      select: { orgId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async checkMembership(userId: string, orgId: string) {
    const m = await prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId } } });
    if (!m) throw new ForbiddenException('Not a member of this org');
    return m;
  }

  // ─── Environments ──────────────────────────────────────────────────────────

  async listEnvironments(userId: string, projectId: string) {
    const project = await this.resolveProject(projectId);
    await this.checkMembership(userId, project.orgId);
    return prisma.environment.findMany({ where: { projectId }, orderBy: { name: 'asc' } });
  }

  async createEnvironment(userId: string, projectId: string, dto: CreateEnvironmentDto) {
    const project = await this.resolveProject(projectId);
    const m = await this.checkMembership(userId, project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const existing = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Environment "${dto.name}" already exists`);

    if (dto.isDefault) {
      await prisma.environment.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const env = await prisma.environment.create({
      data: {
        projectId,
        name: dto.name,
        variables: (dto.variables ?? {}) as object,
        isDefault: dto.isDefault ?? false,
      },
    });

    await this.audit.log({
      orgId: project.orgId,
      actorId: userId,
      action: 'environment.create',
      resource: 'environment',
      resourceId: env.id,
      after: { name: dto.name, isDefault: dto.isDefault },
    });
    return env;
  }

  async updateEnvironment(userId: string, projectId: string, envId: string, dto: UpdateEnvironmentDto) {
    const project = await this.resolveProject(projectId);
    const m = await this.checkMembership(userId, project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const env = await prisma.environment.findFirst({ where: { id: envId, projectId } });
    if (!env) throw new NotFoundException('Environment not found');

    if (dto.isDefault) {
      await prisma.environment.updateMany({
        where: { projectId, isDefault: true, NOT: { id: envId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.environment.update({
      where: { id: envId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.variables !== undefined && { variables: dto.variables as object }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });

    await this.audit.log({
      orgId: project.orgId,
      actorId: userId,
      action: 'environment.update',
      resource: 'environment',
      resourceId: envId,
      before: env,
      after: dto,
    });
    return updated;
  }

  async deleteEnvironment(userId: string, projectId: string, envId: string) {
    const project = await this.resolveProject(projectId);
    const m = await this.checkMembership(userId, project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const env = await prisma.environment.findFirst({ where: { id: envId, projectId } });
    if (!env) throw new NotFoundException('Environment not found');

    await prisma.environment.delete({ where: { id: envId } });
    await this.audit.log({
      orgId: project.orgId,
      actorId: userId,
      action: 'environment.delete',
      resource: 'environment',
      resourceId: envId,
    });
  }

  // ─── Secrets ───────────────────────────────────────────────────────────────

  // Returns keys only — never ciphertext
  async listSecrets(userId: string, projectId: string) {
    const project = await this.resolveProject(projectId);
    await this.checkMembership(userId, project.orgId);
    return prisma.secret.findMany({
      where: { projectId },
      select: { id: true, key: true, createdAt: true, dekVersion: true },
      orderBy: { key: 'asc' },
    });
  }

  async upsertSecret(userId: string, projectId: string, dto: UpsertSecretDto) {
    const project = await this.resolveProject(projectId);
    const m = await this.checkMembership(userId, project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const ciphertext = this.encrypt(dto.value);
    const existing = await prisma.secret.findUnique({
      where: { projectId_key: { projectId, key: dto.key } },
    });

    let secret;
    if (existing) {
      secret = await prisma.secret.update({
        where: { id: existing.id },
        data: { ciphertext, dekVersion: existing.dekVersion + 1 },
      });
    } else {
      secret = await prisma.secret.create({
        data: { projectId, key: dto.key, ciphertext, dekVersion: 1, createdBy: userId },
      });
    }

    await this.audit.log({
      orgId: project.orgId,
      actorId: userId,
      action: 'secret.upsert',
      resource: 'secret',
      resourceId: secret.id,
      after: { key: dto.key },
    });

    return { id: secret.id, key: secret.key };
  }

  // Internal use only — retrieves and decrypts a secret value
  async resolveSecret(projectId: string, key: string): Promise<string> {
    const secret = await prisma.secret.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (!secret) throw new NotFoundException(`Secret "${key}" not found`);
    return this.decrypt(Buffer.from(secret.ciphertext));
  }

  async deleteSecret(userId: string, projectId: string, key: string) {
    const project = await this.resolveProject(projectId);
    const m = await this.checkMembership(userId, project.orgId);
    if (m.role === 'VIEWER' || m.role === 'GUEST') throw new ForbiddenException('Insufficient permissions');

    const secret = await prisma.secret.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    if (!secret) throw new NotFoundException(`Secret "${key}" not found`);

    await prisma.secret.delete({ where: { id: secret.id } });
    await this.audit.log({
      orgId: project.orgId,
      actorId: userId,
      action: 'secret.delete',
      resource: 'secret',
      resourceId: secret.id,
      after: { key },
    });
  }
}
