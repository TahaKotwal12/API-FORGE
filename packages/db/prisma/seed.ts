/**
 * Seed script — DEV ONLY.
 * Creates one demo org + admin user: admin@apiforge.local / apiforge123
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient, Role, Plan } from '../src/generated/index.js';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed script must not run in production');
  }

  const passwordHash = await hash('apiforge123', {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { email: 'admin@apiforge.local' },
    update: {},
    create: {
      email: 'admin@apiforge.local',
      name: 'Demo Admin',
      passwordHash,
      emailVerified: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Org',
      slug: 'demo-org',
      plan: Plan.FREE,
    },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: {},
    create: {
      userId: user.id,
      orgId: org.id,
      role: Role.OWNER,
    },
  });

  console.log(`Seeded: user=${user.email} org=${org.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
