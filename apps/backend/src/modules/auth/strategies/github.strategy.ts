import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private auth: AuthService,
  ) {
    const cfg = config.get<{
      GITHUB_CLIENT_ID?: string;
      GITHUB_CLIENT_SECRET?: string;
      FRONTEND_URL: string;
    }>('app')!;

    super({
      clientID: cfg.GITHUB_CLIENT_ID ?? 'placeholder',
      clientSecret: cfg.GITHUB_CLIENT_SECRET ?? 'placeholder',
      callbackURL: `${cfg.FRONTEND_URL}/api/v1/auth/sso/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user: unknown) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from GitHub'), null);

    const user = await this.auth.findOrCreateOAuthUser({
      provider: 'github',
      providerId: profile.id,
      email,
      name: profile.displayName || profile.username || email,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, user);
  }
}
