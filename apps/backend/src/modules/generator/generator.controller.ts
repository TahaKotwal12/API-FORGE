import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { GeneratorService } from './generator.service';

const GenerateSchema = z.object({
  language: z.enum(['typescript', 'java', 'python', 'go', 'rust']),
  mode: z.enum(['dto-only', 'sdk', 'server', 'hooks']).default('sdk'),
  branchName: z.string().default('main'),
  packageName: z.string().optional(),
  packageVersion: z.string().optional(),
});

class GenerateDto extends createZodDto(GenerateSchema) {}

@ApiTags('generator')
@Controller('projects/:projectId')
export class GeneratorController {
  constructor(private generator: GeneratorService) {}

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate SDK/server code for a project branch' })
  generate(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: GenerateDto,
  ) {
    return this.generator.generate(user.sub, projectId, dto.branchName, {
      language: dto.language,
      mode: dto.mode,
      packageName: dto.packageName,
      packageVersion: dto.packageVersion,
    });
  }

  @Get('generations')
  @ApiOperation({ summary: 'List generation runs for a project' })
  listRuns(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.generator.listRuns(user.sub, projectId);
  }

  @Get('generations/:runId')
  @ApiOperation({ summary: 'Get a specific generation run' })
  getRun(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    return this.generator.getRun(user.sub, projectId, runId);
  }
}
