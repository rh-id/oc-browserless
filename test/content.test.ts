import { describe, test, expect, afterEach } from 'bun:test';
import { parseHTML } from 'linkedom';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import {
  cleanupPageAndExtract,
  collapseWhitespace,
  truncateContent,
} from '../src/plugin/browserless';

const SAMPLE_HTML = [
  '<html><body>',
  '<nav><a href="/nav-page">Nav Link Text</a></nav>',
  '<script>alert(1)</script>',
  '<div id="main"><h1>Title</h1><p>Paragraph text <a href="https://example.com">a link</a></p></div>',
  '<footer>foot text</footer>',
  '<div hidden>secret hidden text</div>',
  '</body></html>',
].join('');

describe('cleanupPageAndExtract', () => {
  test('removes script, nav, footer, and hidden elements while keeping main content', () => {
    const { document } = parseHTML(SAMPLE_HTML);
    const result = cleanupPageAndExtract(document);

    expect(result).toContain('id="main"');
    expect(result).toContain('Title');
    expect(result).toContain('Paragraph text');
    expect(result).toContain('a link');

    expect(result).not.toContain('alert(1)');
    expect(result).not.toContain('Nav Link Text');
    expect(result).not.toContain('foot text');
    expect(result).not.toContain('secret hidden text');
  });

  test('removes elements reported hidden by computed style', () => {
    const { document } = parseHTML(
      '<html><body><div id="main"><p>visible text</p></div><div id="gone">secret hidden text</div></body></html>',
    );
    // linkedom has no getComputedStyle; inject a fake so the computed-style pass runs.
    const view = document.defaultView as unknown as {
      getComputedStyle?: (el: unknown) => { display: string; visibility: string };
    };
    view.getComputedStyle = el =>
      ({
        display: (el as { id?: string }).id === 'gone' ? 'none' : 'block',
        visibility: 'visible',
      }) as { display: string; visibility: string };
    try {
      const result = cleanupPageAndExtract(document);
      expect(result).toContain('visible text');
      expect(result).not.toContain('secret hidden text');
    } finally {
      delete view.getComputedStyle;
    }
  });
});

describe('markdown conversion', () => {
  test('converted cleaned HTML contains heading, link, and paragraph text', () => {
    const { document } = parseHTML(SAMPLE_HTML);
    const cleaned = cleanupPageAndExtract(document);
    const markdown = new NodeHtmlMarkdown().translate(cleaned);

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('[a link](https://example.com)');
    expect(markdown).toContain('Paragraph text');
  });

  test('converter drops script content even on raw HTML input', () => {
    const markdown = new NodeHtmlMarkdown().translate('<p>a</p><script>alert(1)</script>');
    expect(markdown).not.toContain('alert(1)');
    expect(markdown).toContain('a');
  });

  test('converts tables to markdown pipe tables', () => {
    const markdown = new NodeHtmlMarkdown().translate(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
    );
    expect(markdown).toContain('|');
    expect(markdown).toContain('| A | B |');
    expect(markdown).toContain('| 1 | 2 |');
  });
});

describe('collapseWhitespace', () => {
  test('collapses 3+ consecutive newlines to exactly 2', () => {
    expect(collapseWhitespace('a\n\n\nb')).toBe('a\n\nb');
    expect(collapseWhitespace('a\n\n\n\n\n\nb')).toBe('a\n\nb');
  });

  test('leaves up to 2 consecutive newlines untouched', () => {
    expect(collapseWhitespace('a\n\nb')).toBe('a\n\nb');
  });

  test('removes trailing spaces and tabs before newlines', () => {
    expect(collapseWhitespace('a   \nb\t\n c')).toBe('a\nb\n c');
  });

  test('trims leading and trailing whitespace', () => {
    expect(collapseWhitespace('  \n\n hello \n\n  ')).toBe('hello');
  });
});

describe('truncateContent', () => {
  const originalValue = process.env.BROWSERLESS_MAX_CONTENT;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.BROWSERLESS_MAX_CONTENT;
    } else {
      process.env.BROWSERLESS_MAX_CONTENT = originalValue;
    }
  });

  test('applies the default 100000 cap when the env var is unset', () => {
    delete process.env.BROWSERLESS_MAX_CONTENT;
    const result = truncateContent('x'.repeat(150000));
    expect(result.startsWith('x'.repeat(100000))).toBe(true);
    expect(result).toContain('[... content truncated at 100000 characters ...]');
  });

  test('passes through content at or under the limit', () => {
    delete process.env.BROWSERLESS_MAX_CONTENT;
    const content = 'short content';
    expect(truncateContent(content)).toBe(content);
  });

  test('truncates at the configured limit', () => {
    process.env.BROWSERLESS_MAX_CONTENT = '10';
    expect(truncateContent('abcdefghijklmnop')).toBe(
      'abcdefghij\n\n[... content truncated at 10 characters ...]',
    );
  });

  test('treats 0 as unlimited', () => {
    process.env.BROWSERLESS_MAX_CONTENT = '0';
    const content = 'y'.repeat(150000);
    expect(truncateContent(content)).toBe(content);
  });

  test('falls back to the default for non-numeric values', () => {
    process.env.BROWSERLESS_MAX_CONTENT = 'not-a-number';
    const result = truncateContent('z'.repeat(150000));
    expect(result).toContain('[... content truncated at 100000 characters ...]');
  });
});
