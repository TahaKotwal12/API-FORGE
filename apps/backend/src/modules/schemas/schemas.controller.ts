import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SchemasService } from './schemas.service';

const CreateSchemaSchema = z.object({
  name: z.string().min(1).max(255),
  schema: z.record(z.unknown()),
});
const UpdateSchemaSchema = CreateSchemaSchema.partial();

class CreateSchemaDto extends createZodDto(CreateSchemaSchema) {}
class UpdateSchemaDto extends createZodDto(UpdateSchemaSchema) {}

@ApiTags('schemas')
@Controller('projects/:projectId/branches/:branchName/schemas')
export class SchemasController {
  constructor(private schemas: SchemasService) {}

  @Get()
  @ApiOperation({ summary: 'List schemas on a branch' })
  list(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.schemas.list(user.sub, projectId, branchName);
  }

  @Post()
  @ApiOperation({ summary: 'Create a reusable schema' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: CreateSchemaDto,
  ) {
    return this.schemas.create(user.sub, projectId, branchName, dto);
  }

  @Get(':schemaId')
  @ApiOperation({ summary: 'Get a schema by ID' })
  findById(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemaId') schemaId: string,
  ) {
    return this.schemas.findById(user.sub, projectId, branchName, schemaId);
  }

  @Patch(':schemaId')
  @ApiOperation({ summary: 'Update a schema' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemaId') schemaId: string,
    @Body() dto: UpdateSchemaDto,
  ) {
    return this.schemas.update(user.sub, projectId, branchName, schemaId, dto);
  }

  @Delete(':schemaId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a schema' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemaId') schemaId: string,
  ) {
    return this.schemas.delete(user.sub, projectId, branchName, schemaId);
  }
}
