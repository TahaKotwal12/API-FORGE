import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { prisma, User } from '@apiforge/db';
import { randomUUID } from 'crypto';
import { EmailService } from './email.service';

const ARGON_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface OAuthUserInput {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  async register(email: string, name: string, password: string): Promise<User> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hash(password, ARGON_OPTIONS);
    const verifyToken = randomUUID();

    const user = await prisma.user.create({
      data: { email, name, passwordHash, emailVerified: false },
    });

    const frontendUrl = this.config.get<{ FRONTEND_URL: string }>('app')!.FRONTEND_URL;
    this.email.sendVerificationEmail(email, verifyToken, frontendUrl);

    // Store token in session table temporarily
    await prisma.session.create({
      data: {
        userId: user.id,
        token: `verify:${verifyToken}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return user;
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await verify(user.passwordHash, password, ARGON_OPTIONS);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  async login(userId: string, userAgent?: string, ip?: string): Promise<TokenPair> {
    return this.issueTokens(userId, userAgent, ip);
  }

  async refresh(refreshTokenId: string, userId: string, userAgent?: string, ip?: string): Promise<TokenPair> {
    const stored = await prisma.refreshToken.findUnique({ where: { id: refreshTokenId } });
    if (!stored || stored.userId !== userId || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({ where: { id: refreshTokenId }, data: { revokedAt: new Date() } });
    return this.issueTokens(userId, userAgent, ip);
  }

  async logout(refreshTokenId: string) {
    await prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    }).catch(() => null);
  }

  async verifyEmail(token: string): Promise<void> {
    const session = await prisma.session.findUnique({ where: { token: `verify:${token}` } });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { emailVerified: true },
    });

    await prisma.session.delete({ where: { id: session.id } });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (!user) return; // don't reveal whether email exists

    const token = randomUUID();
    await prisma.session.upsert({
      where: { token: `reset:${token}` },
      create: {
        userId: user.id,
        token: `reset:${token}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const frontendUrl = this.config.get<{ FRONTEND_URL: string }>('app')!.FRONTEND_URL;
    this.email.sendPasswordResetEmail(email, token, frontendUrl);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const session = await prisma.session.findUnique({ where: { token: `reset:${token}` } });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await hash(newPassword, ARGON_OPTIONS);
    await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });
    await prisma.session.delete({ where: { id: session.id } });

    // Revoke all existing refresh tokens for security
    await prisma.refreshToken.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findOrCreateOAuthUser(input: OAuthUserInput): Promise<User> {
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          avatarUrl: input.avatarUrl,
          emailVerified: true,
        },
      });
    }
    return user;
  }

  async getMe(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async issueTokens(userId: string, userAgent?: string, ip?: string): Promise<TokenPair> {
    const cfg = this.config.get<{
      JWT_SECRET: string;
      JWT_REFRESH_SECRET: string;
      JWT_ACCESS_EXPIRY: string;
      JWT_REFRESH_EXPIRY: string;
    }>('app')!;

    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: randomUUID(), // placeholder — overwritten below
        userAgent,
        ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.jwt.sign(
      { sub: userId },
      { secret: cfg.JWT_SECRET, expiresIn: cfg.JWT_ACCESS_EXPIRY },
    );

    const refreshToken = this.jwt.sign(
      { sub: userId, refreshTokenId: refreshTokenRecord.id },
      { secret: cfg.JWT_REFRESH_SECRET, expiresIn: cfg.JWT_REFRESH_EXPIRY },
    );

    // Store hashed version
    const tokenHash = await hash(refreshToken, ARGON_OPTIONS);
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { tokenHash },
    });

    return { accessToken, refreshToken };
  }
}
