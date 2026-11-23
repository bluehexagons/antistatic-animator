import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { writeFileAtomic } from '../storage/atomic-write';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'antistatic-animator-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

it('creates and replaces a UTF-8 file on the native filesystem', () => {
  const directory = join(root, 'Éditeur stage files');
  const file = join(directory, 'stage.jsonc');
  writeFileAtomic(file, '{}');
  const edited = '// Scène\n{"name":"Épreuve"}\n';
  writeFileAtomic(file, edited);
  expect(readFileSync(file, 'utf8')).toBe(edited);
  expect(readdirSync(directory)).toEqual(['stage.jsonc']);
});

it('cleans up the temporary file if publishing the replacement fails', () => {
  const directory = join(root, 'stage.jsonc');
  mkdirSync(directory);
  expect(() => writeFileAtomic(directory, '{}')).toThrow();
  expect(readdirSync(root)).toEqual(['stage.jsonc']);
  expect(readdirSync(directory)).toEqual([]);
});
