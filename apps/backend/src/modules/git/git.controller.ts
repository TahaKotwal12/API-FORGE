import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { CommitsService } from './commits.service';
import { MergeRequestsService } from './merge-requests.service';

// ─── DTOs ───────────────────────────────────────────────────────────────────

class CreateBranchDto extends createZodDto(z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid branch name'),
  fromBranch: z.string().optional(),
})) {}

class CreateCommitDto extends createZodDto(z.object({
  message: z.string().min(1).max(500),
})) {}

class CreateMrDto extends createZodDto(z.object({
  sourceBranch: z.string().min(1),
  targetBranch: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
})) {}

class AddCommentDto extends createZodDto(z.object({
  body: z.string().min(1).max(5000),
  path: z.string().optional(),
})) {}

// ─── Branches ───────────────────────────────────────────────────────────────

@ApiTags('branches')
@Controller('projects/:projectId/branches')
export class BranchesController {
  constructor(private branches: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List branches' })
  list(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.branches.list(user.sub, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create branch' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branches.create(user.sub, projectId, dto);
  }

  @Get(':branchName')
  @ApiOperation({ summary: 'Get branch by name' })
  findByName(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.branches.findByName(user.sub, projectId, branchName);
  }

  @Delete(':branchName')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete branch' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
  ) {
    return this.branches.delete(user.sub, projectId, branchName);
  }

  @Put(':branchName/protect')
  @ApiOperation({ summary: 'Set branch protection' })
  protect(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() body: { protect: boolean },
  ) {
    return this.branches.protect(user.sub, projectId, branchName, body.protect);
  }
}

// ─── Commits ────────────────────────────────────────────────────────────────

@ApiTags('commits')
@Controller('projects/:projectId/branches/:branchName/commits')
export class CommitsController {
  constructor(private commits: CommitsService) {}

  @Get()
  @ApiOperation({ summary: 'List commits on a branch' })
  list(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Query('limit') limit?: string,
  ) {
    return this.commits.list(user.sub, projectId, branchName, limit ? parseInt(limit) : 50);
  }

  @Post()
  @ApiOperation({ summary: 'Create a commit (snapshot current branch state)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Body() dto: CreateCommitDto,
  ) {
    return this.commits.create(user.sub, projectId, branchName, dto.message);
  }

  @Get('diff')
  @ApiOperation({ summary: 'Diff two snapshots by sha256' })
  diff(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Param('branchName') branchName: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.commits.diff(user.sub, projectId, branchName, from, to);
  }
}

// ─── Merge Requests ─────────────────────────────────────────────────────────

@ApiTags('merge-requests')
@Controller('projects/:projectId')
export class MergeRequestsController {
  constructor(private mrs: MergeRequestsService) {}

  @Post('merge-requests')
  @ApiOperation({ summary: 'Create a merge request' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMrDto,
  ) {
    return this.mrs.create(user.sub, projectId, dto);
  }

  @Get('merge-requests')
  @ApiOperation({ summary: 'List merge requests' })
  list(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.mrs.list(user.sub, projectId, status);
  }

  @Get('merge-requests/:mrId')
  @ApiOperation({ summary: 'Get merge request by ID' })
  findById(@CurrentUser() user: JwtPayload, @Param('mrId') mrId: string) {
    return this.mrs.findById(user.sub, mrId);
  }

  @Get('merge-requests/:mrId/diff')
  @ApiOperation({ summary: 'Get spec diff for a merge request' })
  diff(@CurrentUser() user: JwtPayload, @Param('mrId') mrId: string) {
    return this.mrs.diff(user.sub, mrId);
  }

  @Post('merge-requests/:mrId/approve')
  @ApiOperation({ summary: 'Approve a merge request' })
  approve(@CurrentUser() user: JwtPayload, @Param('mrId') mrId: string) {
    return this.mrs.approve(user.sub, mrId);
  }

  @Post('merge-requests/:mrId/comments')
  @ApiOperation({ summary: 'Add a comment' })
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param('mrId') mrId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.mrs.addComment(user.sub, mrId, dto.body, dto.path);
  }

  @Post('merge-requests/:mrId/merge')
  @ApiOperation({ summary: 'Merge the merge request' })
  merge(@CurrentUser() user: JwtPayload, @Param('mrId') mrId: string) {
    return this.mrs.merge(user.sub, mrId);
  }

  @Post('merge-requests/:mrId/close')
  @HttpCode(204)
  @ApiOperation({ summary: 'Close a merge request' })
  close(@CurrentUser() user: JwtPayload, @Param('mrId') mrId: string) {
    return this.mrs.close(user.sub, mrId);
  }
}

// ─── Git Remote Config ───────────────────────────────────────────────────────

class SaveGitConfigDto extends createZodDto(z.object({
  remoteUrl: z.string().url().nullable().optional(),
  syncBranch: z.string().min(1).optional(),
  pushEnabled: z.boolean().optional(),
  pullEnabled: z.boolean().optional(),
})) {}

@ApiTags('git-config')
@Controller('projects/:projectId/git')
export class GitConfigController {
  @Get('config')
  @ApiOperation({ summary: 'Get git remote config for a project' })
  getConfig(
    @CurrentUser() _user: JwtPayload,
    @Param('projectId') _projectId: string,
  ) {
    return { remoteUrl: null, syncBranch: 'main', pushEnabled: false, pullEnabled: false };
  }

  @Put('config')
  @ApiOperation({ summary: 'Save git remote config' })
  saveConfig(
    @CurrentUser() _user: JwtPayload,
    @Param('projectId') _projectId: string,
    @Body() dto: SaveGitConfigDto,
  ) {
    return { ...dto, saved: true };
  }

  @Post('push')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger a push to the remote' })
  push(
    @CurrentUser() _user: JwtPayload,
    @Param('projectId') _projectId: string,
  ) {
    return { pushed: false, message: 'No remote configured' };
  }

  @Post('pull')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger a pull from the remote' })
  pull(
    @CurrentUser() _user: JwtPayload,
    @Param('projectId') _projectId: string,
  ) {
    return { pulled: false, message: 'No remote configured' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get git sync status' })
  status(
    @CurrentUser() _user: JwtPayload,
    @Param('projectId') _projectId: string,
  ) {
    return { connected: false };
  }
}
