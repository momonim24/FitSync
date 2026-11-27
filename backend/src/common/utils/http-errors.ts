import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Helpers that build exceptions in the Lab 05 error shape:
 *   { message: 'User not found.', errors: ['User ID does not exist.'] }
 * The global exception filter adds success/statusCode/timestamp.
 */
const body = (message: string, errors: string[]) => ({ message, errors });

export const badRequest = (message: string, ...errors: string[]) =>
  new BadRequestException(body(message, errors.length ? errors : [message]));

export const unauthorized = (message: string, ...errors: string[]) =>
  new UnauthorizedException(body(message, errors.length ? errors : [message]));

export const forbidden = (...errors: string[]) =>
  new ForbiddenException(body('Access denied.', errors.length ? errors : ['You do not have permission to perform this action.']));

export const notFound = (message: string, ...errors: string[]) =>
  new NotFoundException(body(message, errors.length ? errors : [message]));

export const conflict = (message: string, ...errors: string[]) =>
  new ConflictException(body(message, errors.length ? errors : [message]));
