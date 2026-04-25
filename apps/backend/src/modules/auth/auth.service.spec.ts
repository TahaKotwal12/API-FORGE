import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

// Mock the db module
vi.mock('@apiforge/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@node-rs/argon2', () => ({
  hash: vi.fn().mockResolvedValue('hashed'),
  verify: vi.fn().mockResolvedValue(true),
}));

const { prisma } = await import('@apiforge/db');

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: vi.fn().mockReturnValue('mock-token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue({
              JWT_SECRET: 'test-secret-min-32-chars-for-validation',
              JWT_REFRESH_SECRET: 'refresh-secret-min-32-chars-long',
              JWT_ACCESS_EXPIRY: '15m',
              JWT_REFRESH_EXPIRY: '30d',
              FRONTEND_URL: 'http://localhost:3000',
            }),
          },
        },
        { provide: EmailService, useValue: { sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('register', () => {
    it('creates a new user with hashed password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        emailVerified: false,
      });
      (prisma.session.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const user = await service.register('test@test.com', 'Test', 'password123');

      expect(user.email).toBe('test@test.com');
      expect(prisma.user.create).toHaveBeenCalledOnce();
    });

    it('throws ConflictException when email already exists', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' });

      await expect(service.register('test@test.com', 'Test', 'password123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateUser', () => {
    it('returns user on valid credentials', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashed',
      });

      const user = await service.validateUser('test@test.com', 'password123');
      expect(user.id).toBe('user-1');
    });

    it('throws UnauthorizedException on wrong password', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed',
      });

      const { verify } = await import('@node-rs/argon2');
      (verify as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      await expect(service.validateUser('test@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.validateUser('missing@test.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('returns user by id', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
      });

      const user = await service.getMe('user-1');
      expect(user.id).toBe('user-1');
    });
  });

  it('service and jwtService should be defined', () => {
    expect(service).toBeDefined();
    expect(jwtService).toBeDefined();
    expect(configService).toBeDefined();
  });
});
