import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private auth: AuthService,
  ) {
    const cfg = config.get<{
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      FRONTEND_URL: string;
    }>('app')!;

    super({
      clientID: cfg.GOOGLE_CLIENT_ID ?? 'placeholder',
      clientSecret: cfg.GOOGLE_CLIENT_SECRET ?? 'placeholder',
      callbackURL: `${cfg.FRONTEND_URL}/api/v1/auth/sso/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'));

    const user = await this.auth.findOrCreateOAuthUser({
      provider: 'google',
      providerId: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user as Express.User);
  }
}
