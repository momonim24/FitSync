import { normalizeFeedbackMessage } from './feedback-text';

describe('normalizeFeedbackMessage', () => {
  it('removes HTML tags and script markup', () => {
    expect(normalizeFeedbackMessage('Great job <script>alert(1)</script>today')).toBe('Great job alert(1)today');
    expect(normalizeFeedbackMessage('<img src=x onerror=alert(1)>Nice <b>form</b>')).toBe('Nice form');
    expect(normalizeFeedbackMessage('Hidden <!-- note --> text')).toBe('Hidden  text');
  });

  it('keeps ordinary comparisons and punctuation', () => {
    expect(normalizeFeedbackMessage('Keep reps < 10 and rest > 60 s. 3 < 5!')).toBe('Keep reps < 10 and rest > 60 s. 3 < 5!');
  });

  it('normalises whitespace, line endings and control characters', () => {
    expect(normalizeFeedbackMessage('  Line one\r\n\r\n\r\n\r\nLine two \u0007\t\n  ')).toBe('Line one\n\nLine two');
  });
});
