import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  violations?: Array<{ field: string; code: string; message: string }>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let problem: ProblemDetails;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      const zodError = exception.getZodError();
      problem = {
        type: 'https://forge.dev/errors/validation',
        title: 'Validation failed',
        status,
        detail: 'One or more fields failed validation',
        instance: request.url,
        violations: zodError.errors.map((e) => ({
          field: e.path.join('.'),
          code: e.code,
          message: e.message,
        })),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : (response as { message?: string }).message ?? exception.message;

      problem = {
        type: `https://forge.dev/errors/${this.statusToSlug(status)}`,
        title: exception.message,
        status,
        detail: Array.isArray(message) ? message.join(', ') : message,
        instance: request.url,
      };
    } else {
      this.logger.error(exception, 'Unhandled exception');
      problem = {
        type: 'https://forge.dev/errors/internal',
        title: 'Internal server error',
        status,
        instance: request.url,
      };
    }

    void reply
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .send(problem);
  }

  private statusToSlug(status: number): string {
    const map: Record<number, string> = {
      400: 'bad-request',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not-found',
      409: 'conflict',
      422: 'unprocessable-entity',
      429: 'too-many-requests',
      500: 'internal',
    };
    return map[status] ?? 'error';
  }
}
