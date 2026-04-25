import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TeamsService } from './teams.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTeamSchema = z.object({ name: z.string().min(2).max(100) });
const AddMemberSchema = z.object({ userId: z.string().uuid() });

class CreateTeamDto extends createZodDto(CreateTeamSchema) {}
class AddMemberDto extends createZodDto(AddMemberSchema) {}

@ApiTags('teams')
@Controller('orgs/:orgId/teams')
export class TeamsController {
  constructor(private teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams in org' })
  list(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string) {
    return this.teams.listByOrg(user.sub, orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create team' })
  create(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.sub, orgId, dto.name);
  }

  @Delete(':teamId')
  @ApiOperation({ summary: 'Delete team' })
  delete(@CurrentUser() user: JwtPayload, @Param('orgId') orgId: string, @Param('teamId') teamId: string) {
    return this.teams.delete(user.sub, orgId, teamId);
  }

  @Post(':teamId/members')
  @ApiOperation({ summary: 'Add member to team' })
  addMember(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') orgId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.teams.addMember(user.sub, orgId, teamId, dto.userId);
  }

  @Delete(':teamId/members/:userId')
  @ApiOperation({ summary: 'Remove member from team' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') orgId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teams.removeMember(user.sub, orgId, teamId, userId);
  }
}
