import { registerDecorator, ValidationOptions } from 'class-validator';
import { daysFromToday } from '../utils/date.util';

/**
 * Rejects 'YYYY-MM-DD' dates after TODAY in the application time zone
 * (Asia/Manila by default; config/timezone.ts pins it). Workouts and
 * measurements are records of things that already happened. The frontend
 * computes "today" in the same time zone, so both sides agree (QA fix L4).
 */
export function IsNotFutureDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || value <= daysFromToday(0),
      },
    });
}
