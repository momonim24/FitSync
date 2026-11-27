import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from './types';

export const TOKEN_KEY = 'fitsync.token';
export const USER_KEY = 'fitsync.user';

/**
 * Shared Axios instance. Every request goes to the NestJS API under /api/v1
 * and automatically carries the JWT in the Authorization header.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called when the API says the session is no longer valid (401). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest && localStorage.getItem(TOKEN_KEY)) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Turns any API/network error into a readable message for the UI. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'Cannot reach the FitSync server. Make sure the backend is running.';
    const body = error.response.data;
    if (body?.errors?.length) {
      const details = body.errors.filter((e) => e !== body.message);
      return details.length ? details.join(' ') : body.message;
    }
    if (body?.message) return body.message;
  }
  return fallback;
}
