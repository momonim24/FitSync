import { ValidationError, ValidationPipe } from '@nestjs/common';
import { badRequest } from './utils/http-errors';

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {});
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

/**
 * Global DTO validation:
 *  - whitelist: strips properties that are not declared in the DTO
 *  - forbidNonWhitelisted: rejects requests that send unknown properties
 *    (e.g. a public registration trying to send "role": "Admin")
 *  - transform: converts query strings like ?page=2 into numbers
 * Failures return 400 in the standard error format.
 */
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => badRequest('Invalid input data.', ...flatten(errors)),
});
