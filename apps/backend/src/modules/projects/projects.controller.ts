import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Visibility } from '@apiforge/db';

const CreateProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
});
const UpdateProjectSchema = CreateProjectSchema.partial();

class CreateProjectDto extends createZodDto(CreateProjectSchema) {}
class UpdateProjectDto extends createZodDto(UpdateProjectSchema) {}

@ApiTags('projects')
@Controller('orgs/:orgId/projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects in org' })
  list(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string) {
    return this.projects.listByOrg(user.sub, orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  create(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.sub, orgId, dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project by ID' })
  findById(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projects.findById(user.sub, projectId);
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.sub, projectId, dto);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Soft-delete project' })
  delete(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.projects.delete(user.sub, projectId);
  }
}
