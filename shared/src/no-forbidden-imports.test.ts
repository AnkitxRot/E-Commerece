import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// `import.meta.dirname` needs Node 21+; `fileURLToPath(import.meta.url)` works
// on every ESM Node runtime this project targets, so use that instead.
const currentDir = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN = ['@prisma/client', 'express', "from 'fs'", "from 'node:fs'", 'process.env'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('shared package stays environment-agnostic', () => {
  it('never imports Prisma, Express, Node fs, or process.env', () => {
    const files = walk(join(currentDir, '.'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const banned of FORBIDDEN) {
        expect(content.includes(banned), `${file} contains forbidden "${banned}"`).toBe(false);
      }
    }
  });
});
