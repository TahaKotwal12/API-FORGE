import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SecurityService } from './security.service';

const CreateSecuritySchemeSchema = z.object({
  name: z.string().min(1).max(255),
  scheme: z.record(z.unknown()),
});
const UpdateSecuritySchemeSchema = CreateSecuritySchemeSchema.partial();

class CreateSecuritySchemeDto extends createZodDto(CreateSecuritySchemeSchema) {}
class UpdateSecuritySchemeDto extends createZodDto(UpdateSecuritySchemeSchema) {}

@ApiTags('security-schemes')
@Controller('projects/:projectId/branches/:branchName/security-schemes')
export class SecurityController {
  constructor(private security: SecurityService) {}

  @Get()
  @ApiOperation({ summary: 'List security schemes on a branch' })
  list(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.security.list(user.sub, projectId, branchName);
  }

  @Post()
  @ApiOperation({ summary: 'Create a security scheme' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: CreateSecuritySchemeDto,
  ) {
    return this.security.create(user.sub, projectId, branchName, dto);
  }

  @Get(':schemeId')
  @ApiOperation({ summary: 'Get a security scheme' })
  findById(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemeId') schemeId: string,
  ) {
    return this.security.findById(user.sub, projectId, branchName, schemeId);
  }

  @Patch(':schemeId')
  @ApiOperation({ summary: 'Update a security scheme' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemeId') schemeId: string,
    @Body() dto: UpdateSecuritySchemeDto,
  ) {
    return this.security.update(user.sub, projectId, branchName, schemeId, dto);
  }

  @Delete(':schemeId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a security scheme' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('schemeId') schemeId: string,
  ) {
    return this.security.delete(user.sub, projectId, branchName, schemeId);
  }
}
