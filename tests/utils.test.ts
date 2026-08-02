import assert from 'node:assert';
import { test } from 'node:test';
import { parseFrontmatter, stringifyFrontmatter, sanitizeFilename } from '../src/utils';

test('parseFrontmatter extracts YAML metadata and body', () => {
  const content = `---\njoplin_id: "12345"\nupdated_at: "2026-08-02T16:00:00Z"\n---\n# Hello World\nThis is a test.`;
  const result = parseFrontmatter(content);

  assert.strictEqual(result.frontmatter.joplin_id, '12345');
  assert.strictEqual(result.frontmatter.updated_at, '2026-08-02T16:00:00Z');
  assert.strictEqual(result.body.trim(), '# Hello World\nThis is a test.');
});

test('stringifyFrontmatter formats frontmatter and body cleanly', () => {
  const frontmatter = { joplin_id: 'abc', updated_at: '2026-08-02T16:00:00Z' };
  const body = '# Hello World\nContent';
  const output = stringifyFrontmatter(frontmatter, body);

  assert.ok(output.includes('joplin_id: abc'));
  assert.ok(output.includes('# Hello World\nContent'));
});

test('sanitizeFilename removes illegal OS characters', () => {
  assert.strictEqual(sanitizeFilename('My/Note: Test?'), 'My_Note_ Test_');
  assert.strictEqual(sanitizeFilename(''), 'Untitled');
});
