import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import * as yaml from 'js-yaml';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SpecService } from './spec.service';

const ImportSpecSchema = z.object({
  url: z.string().url().optional(),
  content: z.string().optional(),
}).refine((d) => d.url !== undefined || d.content !== undefined, {
  message: 'Either url or content must be provided',
});

class ImportSpecDto extends createZodDto(ImportSpecSchema) {}

@ApiTags('spec')
@Controller('projects/:projectId/branches/:branchName')
export class SpecController {
  constructor(private spec: SpecService) {}

  @Get('spec')
  @ApiOperation({ summary: 'Get composed OpenAPI spec as JSON' })
  compose(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.spec.compose(user.sub, projectId, branchName);
  }

  @Get('spec/export')
  @ApiOperation({ summary: 'Export spec as JSON or YAML file' })
  async export(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Query('format') format: string = 'yaml',
    @Res() reply: FastifyReply,
  ) {
    const doc = await this.spec.compose(user.sub, projectId, branchName);

    if (format === 'json') {
      void reply.header('Content-Type', 'application/json');
      void reply.header('Content-Disposition', 'attachment; filename="openapi.json"');
      return reply.send(JSON.stringify(doc, null, 2));
    }

    const yamlStr = yaml.dump(doc, { lineWidth: 120, quotingType: '"' });
    void reply.header('Content-Type', 'application/yaml');
    void reply.header('Content-Disposition', 'attachment; filename="openapi.yaml"');
    return reply.send(yamlStr);
  }

  @Post('spec/import')
  @ApiOperation({ summary: 'Import spec from URL or raw content (JSON/YAML/Swagger 2.0)' })
  import(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: ImportSpecDto,
  ) {
    return this.spec.importSpec(user.sub, projectId, branchName, dto);
  }
}
