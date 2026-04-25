import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgsService } from './orgs.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '@apiforge/db';

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
});
const UpdateOrgSchema = z.object({ name: z.string().min(2).max(100).optional() });
const ChangeMemberRoleSchema = z.object({ role: z.nativeEnum(Role) });

class CreateOrgDto extends createZodDto(CreateOrgSchema) {}
class UpdateOrgDto extends createZodDto(UpdateOrgSchema) {}
class ChangeMemberRoleDto extends createZodDto(ChangeMemberRoleSchema) {}

@ApiTags('orgs')
@Controller('orgs')
export class OrgsController {
  constructor(private orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: 'List orgs for current user' })
  list(@CurrentUser() user: JwtPayload) {
    return this.orgs.listForUser(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create an org' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrgDto) {
    return this.orgs.create(user.sub, dto.name);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get org by ID' })
  findById(@Param('orgId') orgId: string) {
    return this.orgs.findById(orgId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update org' })
  update(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string, @Body() dto: UpdateOrgDto) {
    return this.orgs.update(user.sub, orgId, dto);
  }

  @Delete(':orgId')
  @ApiOperation({ summary: 'Delete org' })
  delete(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string) {
    return this.orgs.delete(user.sub, orgId);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List org members' })
  getMembers(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string) {
    return this.orgs.getMembers(user.sub, orgId);
  }

  @Patch(':orgId/members/:userId')
  @ApiOperation({ summary: 'Change member role' })
  changeRole(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.orgs.changeMemberRole(user.sub, orgId, targetUserId, dto.role);
  }

  @Delete(':orgId/members/:userId')
  @ApiOperation({ summary: 'Remove member from org' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.orgs.removeMember(user.sub, orgId, targetUserId);
  }
}
