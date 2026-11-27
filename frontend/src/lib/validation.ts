/**
 * Client-side validation rules. Each rule mirrors a backend DTO or business
 * rule (the API validates again and stays the source of truth); they exist
 * so every form can show a message next to the field before a request is
 * sent. Every rule returns an error message, or undefined when the value is
 * valid.
 */
import { todayISO } from './format';

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;
export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** Limits shared with the API (backend DTOs / services). */
export const LIMITS = {
  name: 100, // FullName, ExerciseName, Category, PlanName, GoalName (VARCHAR(100))
  email: 100,
  description: 255,
  notes: 255,
  profileImg: 255,
  passwordMin: 8,
  passwordMax: 72, // bcrypt uses the first 72 bytes
  sets: 100,
  logReps: 10000,
  targetReps: 1000,
  logMinutes: 1440,
  targetMinutes: 600,
  weightMax: 999.99,
  feedbackMin: 2,
  feedbackMax: 1000,
  goalNameMin: 3,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Same pattern as the API (users DTO): http(s) URL or a relative path without "..". */
export const PROFILE_IMAGE = /^(?:https?:\/\/[^\s"'<>]+|(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]*)$/;

export function requiredText(value: string, label: string, max: number = LIMITS.name, min = 1): string | undefined {
  const text = value.trim();
  if (!text) return `${label} is required.`;
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} cannot exceed ${max} characters.`;
  return undefined;
}

export function optionalText(value: string, label: string, max: number): string | undefined {
  return value.trim().length > max ? `${label} cannot exceed ${max} characters.` : undefined;
}

export function email(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Email is required.';
  if (text.length > LIMITS.email) return `Email cannot exceed ${LIMITS.email} characters.`;
  return EMAIL.test(text) ? undefined : 'Enter a valid email address.';
}

/** New-password rule (registration, account creation, change password). */
export function newPassword(value: string, label = 'Password'): string | undefined {
  if (!value) return `${label} is required.`;
  if (value.length < LIMITS.passwordMin) return `${label} must be at least ${LIMITS.passwordMin} characters.`;
  if (value.length > LIMITS.passwordMax) return `${label} cannot exceed ${LIMITS.passwordMax} characters.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return `${label} must contain at least one letter and one number.`;
  return undefined;
}

export function confirmMatches(value: string, original: string): string | undefined {
  if (!value) return 'Confirm the password.';
  return value === original ? undefined : 'Passwords do not match.';
}

export function profileImage(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > LIMITS.profileImg) return `Profile image cannot exceed ${LIMITS.profileImg} characters.`;
  return PROFILE_IMAGE.test(text) ? undefined : 'Use an http(s) URL or a relative path such as uploads/profiles/photo.jpg.';
}

/** Whole number from a text input, within [min, max]. */
export function integer(value: string, label: string, min: number, max: number): string | undefined {
  const text = value.trim();
  if (!text) return `${label} is required.`;
  if (!/^-?\d+$/.test(text)) return `${label} must be a whole number.`;
  const n = Number(text);
  if (n < min) return min === 1 ? `${label} must be greater than zero.` : `${label} must be at least ${min}.`;
  if (n > max) return `${label} cannot exceed ${max}.`;
  return undefined;
}

/** Decimal with at most `places` decimals, within (exclusiveMin, max]. */
export function decimal(value: string, label: string, { min, max, places = 2, minInclusive = true }: { min: number; max: number; places?: number; minInclusive?: boolean }): string | undefined {
  const text = value.trim();
  if (!text) return `${label} is required.`;
  if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(text)) return `${label} must be a number with at most ${places} decimal places.`;
  const n = Number(text);
  if (minInclusive ? n < min : n <= min) return min === 0 ? `${label} must be greater than zero.` : `${label} must be at least ${min}.`;
  if (n > max) return `${label} cannot exceed ${max}.`;
  return undefined;
}

export function requiredDate(value: string, label: string): string | undefined {
  if (!value) return `${label} is required.`;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? undefined : `${label} must be a valid date.`;
}

/** A date that already happened (workouts, measurements). */
export function pastDate(value: string, label: string): string | undefined {
  return requiredDate(value, label) ?? (value > todayISO() ? `${label} cannot be in the future.` : undefined);
}

export function selected(value: string | number | null | undefined, message: string): string | undefined {
  return value === '' || value === null || value === undefined ? message : undefined;
}

/** Whole days from a to b ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
