import { Response } from 'express';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Lab 05 documents list endpoints as returning a plain JSON array, so the
 * array stays the response body and pagination metadata travels in headers:
 *   X-Total-Count, X-Page, X-Limit, X-Total-Pages
 */
export function sendPaginated<T>(res: Response, result: Paginated<T>): T[] {
  res.setHeader('X-Total-Count', String(result.total));
  res.setHeader('X-Page', String(result.page));
  res.setHeader('X-Limit', String(result.limit));
  res.setHeader('X-Total-Pages', String(Math.max(1, Math.ceil(result.total / result.limit))));
  return result.items;
}

export const PAGINATION_HEADERS = ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages', 'X-Data-Source', 'X-Cache', 'Content-Disposition', 'X-Unread-Count'];
