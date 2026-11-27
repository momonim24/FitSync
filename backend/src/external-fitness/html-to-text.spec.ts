import { htmlToText, truncate } from './html-to-text';

describe('htmlToText (sanitizes external HTML)', () => {
  it('keeps paragraph and list structure as plain text', () => {
    const html = '<p>Stand <strong>tall</strong>.</p><ol><li>Bend knees</li><li>Push &amp; rise</li></ol>';
    expect(htmlToText(html)).toBe('Stand tall.\n\n• Bend knees\n• Push & rise');
  });

  it('removes scripts, styles, event handlers and links completely', () => {
    const html =
      '<p onclick="steal()">Safe</p><script>alert("x")</script><style>p{}</style><img src=x onerror="alert(1)"><a href="javascript:evil()">link</a>';
    const text = htmlToText(html);
    expect(text).toBe('Safe\nlink');
    expect(text).not.toMatch(/script|alert|onerror|onclick|javascript|<|>/i);
  });

  it('turns encoded tags into harmless characters without re-creating markup', () => {
    expect(htmlToText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
    // The result is plain text: the frontend renders it as text, never as HTML.
  });

  it('handles empty and non-string input', () => {
    expect(htmlToText('')).toBe('');
    expect(htmlToText(null)).toBe('');
    expect(htmlToText(42)).toBe('');
  });

  it('truncates at a word boundary with an ellipsis', () => {
    expect(truncate('one two three four five', 12)).toBe('one two…');
    expect(truncate('short', 12)).toBe('short');
    expect(truncate('x'.repeat(300), 255)).toHaveLength(255);
  });
});
