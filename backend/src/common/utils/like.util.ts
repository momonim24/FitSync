/**
 * SQL LIKE helpers (QA fix L6). Search text is always sent as a bound
 * parameter; these helpers additionally make the LIKE wildcards % and _ (and
 * the escape character \) match literally, so searching for "50%" or "a_b"
 * finds exactly that text instead of acting as a pattern.
 */

/** Escapes \, % and _ with MySQL's default LIKE escape character (\). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Pattern for "contains value" searches: %<escaped value>%. */
export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}
