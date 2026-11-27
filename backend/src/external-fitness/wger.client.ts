import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fixed, trusted upstream address. It is deliberately NOT configurable from
 * environment variables or request input, so the server can never be pointed
 * at another host (prevents server-side request forgery).
 */
export const WGER_API_BASE = 'https://wger.de/api/v2';

/** Only these hosts are trusted for links and images taken from responses. */
export const WGER_TRUSTED_ORIGIN = 'https://wger.de';

export type CacheStatus = 'HIT' | 'MISS' | 'STALE';

export interface UpstreamResult<T> {
  data: T;
  cache: CacheStatus;
}

interface CacheEntry {
  value: unknown;
  freshUntil: number;
  staleUntil: number;
}

/** Errors in the Lab 05 shape so the global filter formats them consistently. */
export const upstreamError = (status: HttpStatus, message: string, detail: string) =>
  new HttpException({ message, errors: [detail] }, status);

/**
 * Minimal HTTP client for the public wger API.
 *
 * - GET only, JSON only, to WGER_API_BASE only.
 * - Sends no cookies, tokens or FitSync user data — just a generic
 *   User-Agent identifying the application.
 * - Request timeout (WGER_TIMEOUT_MS, default 8000 ms).
 * - In-memory cache (WGER_CACHE_TTL_SECONDS, default 600 s). If wger is
 *   unreachable, a previously fetched response up to 24 h old is served and
 *   marked STALE; otherwise the request fails with 503/504 — results are
 *   never invented.
 */
@Injectable()
export class WgerClient {
  private readonly logger = new Logger('WgerClient');
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxEntries = 300;
  private readonly staleMs = 24 * 60 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  private get timeoutMs(): number {
    return Number(this.config.get('WGER_TIMEOUT_MS', 8000));
  }

  private get ttlMs(): number {
    return Number(this.config.get('WGER_CACHE_TTL_SECONDS', 600)) * 1000;
  }

  /**
   * GET `${WGER_API_BASE}${path}` with the given query. `path` must be one of
   * the fixed API paths used by ExternalFitnessService (it always starts with "/").
   */
  async get<T = unknown>(path: string, query: Record<string, string | number | undefined> = {}, ttlMs = this.ttlMs): Promise<UpstreamResult<T>> {
    if (!/^\/[a-z0-9\-/]+\/$/.test(path)) throw new Error(`Unsupported upstream path: ${path}`);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query).sort(([a], [b]) => a.localeCompare(b))) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const url = `${WGER_API_BASE}${path}${params.size ? `?${params}` : ''}`;

    const now = Date.now();
    const cached = this.cache.get(url);
    if (cached && cached.freshUntil > now) return { data: cached.value as T, cache: 'HIT' };

    try {
      const value = await this.fetchJson(url);
      this.remember(url, value, ttlMs);
      return { data: value as T, cache: 'MISS' };
    } catch (error) {
      // Graceful degradation: serve real (stale) data if we have it, never fake data.
      const isNotFound = error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND;
      if (!isNotFound && cached && cached.staleUntil > now) {
        this.logger.warn(`Serving stale cache for ${url}: ${(error as Error).message}`);
        return { data: cached.value as T, cache: 'STALE' };
      }
      throw error;
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'FitSync/1.0 (academic project)' },
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const name = (error as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw upstreamError(HttpStatus.GATEWAY_TIMEOUT, 'External fitness service timed out.', `wger did not respond within ${this.timeoutMs} ms. Please try again later.`);
      }
      throw upstreamError(HttpStatus.SERVICE_UNAVAILABLE, 'External fitness service unavailable.', 'Could not connect to wger. Please try again later.');
    }

    if (response.status === 404) {
      throw upstreamError(HttpStatus.NOT_FOUND, 'External exercise not found.', 'The requested item does not exist at wger.');
    }
    if (response.status === 429 || response.status >= 500) {
      throw upstreamError(HttpStatus.SERVICE_UNAVAILABLE, 'External fitness service unavailable.', `wger responded with HTTP ${response.status}. Please try again later.`);
    }
    if (!response.ok) {
      throw upstreamError(HttpStatus.BAD_GATEWAY, 'External fitness service rejected the request.', `wger responded with HTTP ${response.status}.`);
    }

    try {
      return await response.json();
    } catch {
      throw upstreamError(HttpStatus.BAD_GATEWAY, 'Invalid response from external fitness service.', 'wger returned data that is not valid JSON.');
    }
  }

  private remember(url: string, value: unknown, ttlMs: number): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict the oldest entry (Map preserves insertion order).
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.delete(url);
    const now = Date.now();
    this.cache.set(url, { value, freshUntil: now + ttlMs, staleUntil: now + ttlMs + this.staleMs });
  }

  /** Used by tests to start from an empty cache. */
  clearCache(): void {
    this.cache.clear();
  }
}
