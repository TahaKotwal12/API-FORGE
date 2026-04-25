import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InvitesService } from './invites.service';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '@apiforge/db';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).default(Role.VIEWER),
});
class InviteDto extends createZodDto(InviteSchema) {}

@ApiTags('invites')
@Controller()
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @Post('orgs/:orgId/members/invite')
  @ApiOperation({ summary: 'Invite a user to an org' })
  invite(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') orgId: string,
    @Body() dto: InviteDto,
  ) {
    return this.invites.invite(user.sub, orgId, dto.email, dto.role);
  }

  @Public()
  @Get('invites/:token')
  @ApiOperation({ summary: 'Get invite details by token' })
  getByToken(@Param('token') token: string) {
    return this.invites.getByToken(token);
  }

  @Post('invites/:token/accept')
  @ApiOperation({ summary: 'Accept an invite' })
  accept(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.invites.accept(token, user.sub);
  }
}
