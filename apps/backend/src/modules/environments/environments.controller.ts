import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { EnvironmentsService } from './environments.service';

const CreateEnvironmentSchema = z.object({
  name: z.string().min(1).max(100),
  variables: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
});
const UpdateEnvironmentSchema = CreateEnvironmentSchema.partial();

const UpsertSecretSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z0-9_]+$/, 'Secret keys must be SCREAMING_SNAKE_CASE'),
  value: z.string(),
});

class CreateEnvironmentDto extends createZodDto(CreateEnvironmentSchema) {}
class UpdateEnvironmentDto extends createZodDto(UpdateEnvironmentSchema) {}
class UpsertSecretDto extends createZodDto(UpsertSecretSchema) {}

@ApiTags('environments')
@Controller('projects/:projectId')
export class EnvironmentsController {
  constructor(private environments: EnvironmentsService) {}

  // ─── Environments ───────────────────────────────────────────────────────────

  @Get('environments')
  @ApiOperation({ summary: 'List environments for a project' })
  listEnvironments(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.environments.listEnvironments(user.sub, projectId);
  }

  @Post('environments')
  @ApiOperation({ summary: 'Create an environment' })
  createEnvironment(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environments.createEnvironment(user.sub, projectId, dto);
  }

  @Patch('environments/:envId')
  @ApiOperation({ summary: 'Update an environment' })
  updateEnvironment(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environments.updateEnvironment(user.sub, projectId, envId, dto);
  }

  @Delete('environments/:envId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an environment' })
  deleteEnvironment(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
  ) {
    return this.environments.deleteEnvironment(user.sub, projectId, envId);
  }

  // ─── Secrets ────────────────────────────────────────────────────────────────

  @Get('secrets')
  @ApiOperation({ summary: 'List secret keys (values never returned)' })
  listSecrets(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.environments.listSecrets(user.sub, projectId);
  }

  @Post('secrets')
  @ApiOperation({ summary: 'Create or update a secret' })
  upsertSecret(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpsertSecretDto,
  ) {
    return this.environments.upsertSecret(user.sub, projectId, dto);
  }

  @Delete('secrets/:key')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a secret' })
  deleteSecret(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('key') key: string,
  ) {
    return this.environments.deleteSecret(user.sub, projectId, key);
  }
}
