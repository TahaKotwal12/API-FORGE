import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { PasswordResetConfirmDto, PasswordResetRequestDto } from './dto/password-reset.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RefreshPayload } from './strategies/jwt-refresh.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto.email, dto.name, dto.password);
    return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    return this.auth.login(user.id, req.headers['user-agent'], req.ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout (revoke refresh token)' })
  async logout(@Body() dto: RefreshDto) {
    // The refreshTokenId would normally come from decoding the token;
    // for simplicity we accept it in the body and the guard validates it
    await this.auth.logout(dto.refreshToken);
    return;
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(
    @Req() req: FastifyRequest & { user: RefreshPayload },
    @Body() _dto: RefreshDto,
  ) {
    return this.auth.refresh(
      req.user.refreshTokenId,
      req.user.sub,
      req.headers['user-agent'],
      req.ip,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.auth.getMe(user.sub);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Query('token') token: string) {
    await this.auth.verifyEmail(token);
    return { message: 'Email verified' };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request password reset email' })
  async requestReset(@Body() dto: PasswordResetRequestDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { message: 'If that email exists, a reset link was sent' };
  }

  @Public()
  @Post('password/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset' })
  async confirmReset(@Body() dto: PasswordResetConfirmDto) {
    await this.auth.confirmPasswordReset(dto.token, dto.password);
    return { message: 'Password reset successfully' };
  }

  @Public()
  @Get('sso/:providerId')
  @ApiOperation({ summary: 'Start OAuth2 SSO flow' })
  ssoStart(@Param('providerId') providerId: string) {
    // Passport redirects happen via guards applied at route level.
    // This stub returns instructions for dynamic SSO start.
    return { redirect: `/api/v1/auth/sso/${providerId}/redirect` };
  }

  @Public()
  @Get('sso/github/redirect')
  @UseGuards(GithubAuthGuard)
  githubRedirect() { return; }

  @Public()
  @Get('sso/github/callback')
  @UseGuards(GithubAuthGuard)
  async githubCallback(@Req() req: FastifyRequest & { user: { id: string } }) {
    return this.auth.login(req.user.id);
  }

  @Public()
  @Get('sso/google/redirect')
  @UseGuards(GoogleAuthGuard)
  googleRedirect() { return; }

  @Public()
  @Get('sso/google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: FastifyRequest & { user: { id: string } }) {
    return this.auth.login(req.user.id);
  }
}
