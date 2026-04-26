import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { appConfig } from './config/config.schema';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { TeamsModule } from './modules/teams/teams.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { InvitesModule } from './modules/invites/invites.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { CerbosModule } from './modules/cerbos/cerbos.module';
import { EndpointsModule } from './modules/endpoints/endpoints.module';
import { SchemasModule } from './modules/schemas/schemas.module';
import { SecurityModule } from './modules/security/security.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { SpecModule } from './modules/spec/spec.module';
import { LinterModule } from './modules/linter/linter.module';
import { GitModule } from './modules/git/git.module';
import { GeneratorModule } from './modules/generator/generator.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: isProd ? 'info' : 'debug',
          transport: isProd
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          redact: ['req.headers.authorization'],
        },
      }),
    }),
    CerbosModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrgsModule,
    TeamsModule,
    ProjectsModule,
    InvitesModule,
    HealthModule,
    EndpointsModule,
    SchemasModule,
    SecurityModule,
    EnvironmentsModule,
    SpecModule,
    LinterModule,
    GitModule,
    GeneratorModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
