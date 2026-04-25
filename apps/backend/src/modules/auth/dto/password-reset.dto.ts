import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export class PasswordResetRequestDto extends createZodDto(PasswordResetRequestSchema) {}
export class PasswordResetConfirmDto extends createZodDto(PasswordResetConfirmSchema) {}
