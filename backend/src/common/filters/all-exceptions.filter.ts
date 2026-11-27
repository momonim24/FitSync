import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors: string[];
  timestamp: string;
}

/**
 * Converts every error into the Lab 05 error format:
 *   { success, statusCode, message, errors[], timestamp }
 *
 * Database constraint errors are mapped to meaningful HTTP codes so that,
 * even if a service check is missed, MySQL's own constraints still produce
 * a clean 400/404/409 instead of a 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { statusCode, message, errors } = this.resolve(exception);

    const body: ErrorBody = {
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): Omit<ErrorBody, 'success' | 'timestamp'> {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { statusCode, message: res, errors: [res] };
      }
      const r = res as { message?: string | string[]; errors?: string[] };
      const errors = r.errors ?? (Array.isArray(r.message) ? r.message : [r.message ?? exception.message]);
      const message = typeof r.message === 'string' ? r.message : this.defaultMessage(statusCode);
      return { statusCode, message, errors };
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { code?: string }).code;
      switch (code) {
        case 'ER_DUP_ENTRY':
          return { statusCode: 409, message: 'Duplicate record.', errors: ['A record with the same unique value already exists.'] };
        case 'ER_ROW_IS_REFERENCED_2':
        case 'ER_ROW_IS_REFERENCED':
          return { statusCode: 409, message: 'Record is in use.', errors: ['The record is referenced by other records and cannot be removed.'] };
        case 'ER_NO_REFERENCED_ROW_2':
        case 'ER_NO_REFERENCED_ROW':
          return { statusCode: 404, message: 'Resource not found.', errors: ['A referenced record does not exist.'] };
        case 'ER_CHECK_CONSTRAINT_VIOLATED':
        case 'ER_CONSTRAINT_FAILED':
          return { statusCode: 400, message: 'Invalid input data.', errors: ['A database constraint was violated.'] };
      }
    }

    // Errors raised by the JSON body parser before a controller runs (QA fix L1):
    // they carry an HTTP status and a 'type' such as 'entity.too.large'.
    const parserError = this.bodyParserError(exception);
    if (parserError) return parserError;

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.',
      errors: ['An unexpected error occurred.'],
    };
  }

  /** Maps body-parser errors (oversized or unreadable request bodies) to their 4xx status. */
  private bodyParserError(exception: unknown): Omit<ErrorBody, 'success' | 'timestamp'> | null {
    if (!(exception instanceof Error)) return null;
    const e = exception as Error & { type?: unknown; status?: unknown; statusCode?: unknown };
    const status = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : null;
    if (typeof e.type !== 'string' || status === null || status < 400 || status >= 500) return null;
    if (e.type === 'entity.too.large') {
      return { statusCode: 413, message: 'Payload too large.', errors: ['The request body exceeds the 100 kB limit.'] };
    }
    return { statusCode: status, message: this.defaultMessage(status), errors: ['The request body could not be read.'] };
  }

  private defaultMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid input data.',
      401: 'Authentication required.',
      403: 'Access denied.',
      404: 'Resource not found.',
      409: 'Conflict.',
      413: 'Payload too large.',
      429: 'Too many requests.',
    };
    return messages[status] ?? 'Request failed.';
  }
}
