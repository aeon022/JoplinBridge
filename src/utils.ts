import * as yaml from 'js-yaml';
import * as path from 'path';

export interface NoteFrontmatter {
  joplin_id?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ParsedMarkdown {
  frontmatter: NoteFrontmatter;
  body: string;
}

/**
 * Parses Markdown content containing YAML frontmatter delimited by `---`.
 */
export function parseFrontmatter(content: string): ParsedMarkdown {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    const rawYaml = match[1];
    const parsed = yaml.load(rawYaml) as NoteFrontmatter;
    const body = content.slice(match[0].length);
    return {
      frontmatter: parsed || {},
      body
    };
  } catch (err) {
    console.error('[JoplinBridge] Failed to parse frontmatter:', err);
    return { frontmatter: {}, body: content };
  }
}

/**
 * Prepends YAML frontmatter to Markdown body.
 */
export function stringifyFrontmatter(frontmatter: NoteFrontmatter, body: string): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }
  const yamlStr = yaml.dump(frontmatter, { lineWidth: -1 }).trim();
  return `---\n${yamlStr}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
}

/**
 * Sanitizes note title into a safe filename across OSes (macOS/Linux/Windows).
 */
export function sanitizeFilename(title: string): string {
  const safe = (title || 'Untitled')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim();
  return safe.length > 0 ? safe : 'Untitled';
}

/**
 * Normalizes and resolves absolute file path for cross-platform safety.
 */
export function resolveSafePath(baseDir: string, relativeOrAbsolutePath: string): string {
  const resolved = path.resolve(baseDir, relativeOrAbsolutePath);
  return resolved;
}
