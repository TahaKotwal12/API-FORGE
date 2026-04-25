import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@apiforge/db';
import { hash } from '@node-rs/argon2';

const ARGON_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

@Injectable()
export class UsersService {
  async findById(id: string) {
    const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async updateProfile(id: string, data: { name?: string; avatarUrl?: string }) {
    const user = await prisma.user.update({ where: { id }, data });
    return this.sanitize(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const { verify } = await import('@node-rs/argon2');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.passwordHash) throw new NotFoundException('User not found');

    const valid = await verify(user.passwordHash, currentPassword);
    if (!valid) throw new NotFoundException('Current password incorrect');

    const passwordHash = await hash(newPassword, ARGON_OPTIONS);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async getSessions(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const token = await prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!token || token.userId !== userId) throw new NotFoundException('Session not found');
    await prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  private sanitize(user: { id: string; email: string; name: string; avatarUrl: string | null; emailVerified: boolean; createdAt: Date }) {
    const { ...safe } = user;
    return safe;
  }
}
