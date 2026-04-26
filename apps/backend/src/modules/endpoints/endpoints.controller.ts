import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { HttpMethod } from '@apiforge/db';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { EndpointsService } from './endpoints.service';

const ParameterSchema = z.object({
  name: z.string(),
  in: z.enum(['path', 'query', 'header', 'cookie']),
  required: z.boolean().optional(),
  description: z.string().optional(),
  schema: z.record(z.unknown()).optional(),
});

const ResponseSchema = z.record(z.unknown());

const CreateEndpointSchema = z.object({
  method: z.nativeEnum(HttpMethod),
  path: z.string().min(1).startsWith('/'),
  summary: z.string().max(500).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parameters: z.array(ParameterSchema).optional(),
  requestBody: z.record(z.unknown()).optional(),
  responses: ResponseSchema.optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),
  deprecated: z.boolean().optional(),
  extensions: z.record(z.unknown()).optional(),
  order: z.number().int().optional(),
});

const UpdateEndpointSchema = CreateEndpointSchema.partial();

class CreateEndpointDto extends createZodDto(CreateEndpointSchema) {}
class UpdateEndpointDto extends createZodDto(UpdateEndpointSchema) {}

@ApiTags('endpoints')
@Controller('projects/:projectId/branches/:branchName/endpoints')
export class EndpointsController {
  constructor(private endpoints: EndpointsService) {}

  @Get()
  @ApiOperation({ summary: 'List endpoints on a branch' })
  list(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.endpoints.list(user.sub, projectId, branchName);
  }

  @Post()
  @ApiOperation({ summary: 'Create an endpoint' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: CreateEndpointDto,
  ) {
    return this.endpoints.create(user.sub, projectId, branchName, dto);
  }

  @Get(':endpointId')
  @ApiOperation({ summary: 'Get a single endpoint' })
  findById(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpoints.findById(user.sub, projectId, branchName, endpointId);
  }

  @Patch(':endpointId')
  @ApiOperation({ summary: 'Update an endpoint' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.endpoints.update(user.sub, projectId, branchName, endpointId, dto);
  }

  @Delete(':endpointId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an endpoint (soft)' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpoints.delete(user.sub, projectId, branchName, endpointId);
  }
}
