import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { AuditService } from '../audit/audit.service';
import { CERBOS_CLIENT } from '../cerbos/cerbos.constants';

vi.mock('@apiforge/db', () => ({
  prisma: {
    membership: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    organization: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  Role: { OWNER: 'OWNER', ADMIN: 'ADMIN', EDITOR: 'EDITOR', VIEWER: 'VIEWER', GUEST: 'GUEST' },
}));

const { prisma } = await import('@apiforge/db');

describe('OrgsService', () => {
  let service: OrgsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrgsService,
        { provide: CERBOS_CLIENT, useValue: { checkResource: vi.fn() } },
        { provide: AuditService, useValue: { log: vi.fn() } },
      ],
    }).compile();
    service = module.get(OrgsService);
  });

  it('create returns new org and OWNER membership', async () => {
    (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.organization.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
    });
    (prisma.membership.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const org = await service.create('user-1', 'Test Org');
    expect(org.slug).toBe('test-org');
    expect(prisma.membership.create).toHaveBeenCalledOnce();
  });

  it('create throws ConflictException when slug taken', async () => {
    (prisma.organization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' });
    await expect(service.create('user-1', 'Test Org')).rejects.toThrow(ConflictException);
  });
});
