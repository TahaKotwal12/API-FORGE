import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';

patchNestJsSwagger();

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', { exclude: ['/health/live', '/health/ready'] });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // OpenAPI
  const config = new DocumentBuilder()
    .setTitle('APIForge API')
    .setDescription('APIForge API — Phase 1')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Expose raw OpenAPI JSON
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.get('/openapi.json', (_req: unknown, reply: { send: (d: unknown) => void }) => {
    reply.send(document);
  });

  // Scalar API browser in dev
  if (process.env.NODE_ENV !== 'production') {
    const { ApiReference } = await import('@scalar/nestjs-api-reference');
    app.use(
      '/api/docs',
      ApiReference({
        spec: { url: '/openapi.json' },
      }),
    );
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Backend running on port ${port}`);

  // Yjs collaboration WebSocket server (separate port to avoid Fastify conflict)
  const yjsPort = process.env.YJS_PORT ? parseInt(process.env.YJS_PORT, 10) : 4001;
  try {
    const { WebSocketServer } = await import('ws');
    const { setupWSConnection } = await import('y-websocket/bin/utils');
    const wss = new WebSocketServer({ port: yjsPort });
    wss.on('connection', (ws: import('ws').WebSocket, req: import('http').IncomingMessage) => {
      setupWSConnection(ws, req, { gc: true });
    });
    app.get(Logger).log(`Yjs WebSocket server running on port ${yjsPort}`);
  } catch {
    app.get(Logger).warn('y-websocket not available — real-time collaboration disabled');
  }
}

bootstrap();
