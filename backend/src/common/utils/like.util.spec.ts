import { containsPattern, escapeLike } from './like.util';

describe('LIKE escaping (QA fix L6)', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%')).toBe('50\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLike('Juan Dela Cruz')).toBe('Juan Dela Cruz');
    expect(escapeLike("O'Brien")).toBe("O'Brien");
  });

  it('builds a contains pattern', () => {
    expect(containsPattern('%')).toBe('%\\%%');
    expect(containsPattern('squat')).toBe('%squat%');
  });
});
