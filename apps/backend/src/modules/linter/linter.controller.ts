import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { LinterService } from './linter.service';

const LintOptionsSchema = z.object({
  ruleset: z.enum(['recommended', 'strict']).optional(),
});

class LintOptionsDto extends createZodDto(LintOptionsSchema) {}

@ApiTags('linter')
@Controller('projects/:projectId/branches/:branchName')
export class LinterController {
  constructor(private linter: LinterService) {}

  @Post('lint')
  @ApiOperation({ summary: 'Lint the full spec for a branch' })
  lintBranch(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: LintOptionsDto,
  ) {
    return this.linter.lintBranch(user.sub, projectId, branchName, dto.ruleset);
  }

  @Post('endpoints/:endpointId/lint')
  @ApiOperation({ summary: 'Lint a single endpoint' })
  lintEndpoint(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: LintOptionsDto,
  ) {
    return this.linter.lintEndpoint(user.sub, projectId, branchName, endpointId, dto.ruleset);
  }
}
