import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const message = () =>
      `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`;
    return next
      .handle()
      .pipe(
        tap({ next: () => this.logger.log(message()), error: () => this.logger.warn(message()) }),
      );
  }
}
