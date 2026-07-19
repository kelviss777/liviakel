import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;
    const details =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const message =
      typeof body === 'string' ? body : (details.message ?? 'Erro interno do servidor');
    const error =
      typeof details.error === 'string' ? details.error : (HttpStatus[status] ?? 'Error');
    if (!isHttp) this.logger.error('Erro interno não tratado');
    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
