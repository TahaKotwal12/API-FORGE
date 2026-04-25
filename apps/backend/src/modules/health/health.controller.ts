import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { prisma } from '@apiforge/db';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (checks Postgres)' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('postgres', prisma),
    ]);
  }
}
