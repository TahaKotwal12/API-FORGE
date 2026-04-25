import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let server: ReturnType<typeof supertest>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    server = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live → 200', async () => {
    const res = await server.get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/v1/auth/me → 401 when unauthenticated', async () => {
    const res = await server.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/register → 201 with user', async () => {
    const res = await server
      .post('/api/v1/auth/register')
      .send({ email: `e2e-${Date.now()}@test.com`, name: 'E2E Test', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBeDefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('POST /api/v1/auth/login → 400 with invalid payload', async () => {
    const res = await server.post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(422);
  });
});
