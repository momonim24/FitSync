import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { notFound } from '../utils/http-errors';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('AllExceptionsFilter', () => {
  it('formats custom errors in the Lab 05 envelope', () => {
    const { status, body } = run(notFound('User not found.', 'User ID does not exist.'));
    expect(status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      statusCode: 404,
      message: 'User not found.',
      errors: ['User ID does not exist.'],
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('turns array messages into the errors list', () => {
    const { body } = run(new BadRequestException(['a is required', 'b is required']));
    expect(body.errors).toEqual(['a is required', 'b is required']);
    expect(body.message).toBe('Invalid input data.');
  });

  it('keeps built-in Nest exceptions readable', () => {
    const { status, body } = run(new NotFoundException());
    expect(status).toBe(404);
    expect(body.errors).toHaveLength(1);
  });

  it('maps MySQL duplicate-key errors to 409', () => {
    const error = new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    expect(run(error).status).toBe(409);
  });

  it('maps an oversized request body to 413 in the standard envelope (QA fix L1)', () => {
    const error = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413, statusCode: 413 });
    const { status, body } = run(error);
    expect(status).toBe(413);
    expect(body).toMatchObject({ success: false, statusCode: 413, message: 'Payload too large.' });
    expect(JSON.stringify(body)).not.toContain('request entity too large');
  });

  it('maps other body-parser client errors to their own 4xx status', () => {
    const error = Object.assign(new Error('unsupported charset'), { type: 'charset.unsupported', status: 415 });
    expect(run(error).status).toBe(415);
  });

  it('hides unexpected errors behind a generic 500', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new Error('secret stack detail'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret stack detail');
  });
});
