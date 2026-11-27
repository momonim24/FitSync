/**
 * Normalises a feedback message before it is stored.
 *
 * Feedback is plain text. The frontend renders it as text (React escapes
 * it; nothing uses innerHTML), which is the primary XSS protection. As
 * defence in depth the API also:
 *   - removes HTML-like tags (<script>, <img onerror=…>, </b>, …)
 *   - removes control characters except line breaks and tabs
 *   - normalises line endings and collapses runs of blank lines
 *   - trims surrounding whitespace
 * Ordinary text such as "keep reps < 10" is left unchanged.
 */
export const FEEDBACK_MIN_LENGTH = 2;
export const FEEDBACK_MAX_LENGTH = 1000;

export function normalizeFeedbackMessage(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
