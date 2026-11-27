import { registerDecorator, ValidationOptions } from 'class-validator';

/** Accepts only real calendar dates written as 'YYYY-MM-DD' (MySQL DATE columns). */
export function isDateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options,
      validator: { validate: isDateOnly },
    });
}
