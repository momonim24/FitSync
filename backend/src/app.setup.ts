import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PAGINATION_HEADERS } from './common/utils/pagination.util';
import { globalValidationPipe } from './common/validation';

/**
 * Global HTTP configuration shared by main.ts and the e2e tests,
 * so the tests exercise exactly the same pipeline as the real server.
 */
export function configureApp(app: INestApplication): void {
  // Every route lives under /api/v1 (Lab 05 versioning rule).
  app.setGlobalPrefix('api/v1');

  // Validate and transform request bodies / query strings with the DTOs.
  app.useGlobalPipes(globalValidationPipe);

  // Apply class-transformer rules (e.g. @Exclude on passwordHash) to responses.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Uniform Lab 05 error body for every failure.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Only the configured front-end origins may call the API from a browser.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: PAGINATION_HEADERS,
  });
}
