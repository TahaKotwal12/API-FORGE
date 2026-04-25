import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  sendVerificationEmail(email: string, token: string, frontendUrl: string) {
    const link = `${frontendUrl}/verify-email?token=${token}`;
    this.logger.log(`[DEV EMAIL] Verify email for ${email}: ${link}`);
  }

  sendPasswordResetEmail(email: string, token: string, frontendUrl: string) {
    const link = `${frontendUrl}/reset-password?token=${token}`;
    this.logger.log(`[DEV EMAIL] Password reset for ${email}: ${link}`);
  }

  sendInviteEmail(email: string, orgName: string, token: string, frontendUrl: string) {
    const link = `${frontendUrl}/invites/${token}`;
    this.logger.log(`[DEV EMAIL] Invite for ${email} to org "${orgName}": ${link}`);
  }
}
