import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = 'Internal server error';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        error = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const message = (body as { message: string | string[] }).message;
        error = Array.isArray(message) ? message.join('; ') : message;
      }
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({ error, statusCode: status });
  }
}
