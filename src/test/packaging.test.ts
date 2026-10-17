import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { packageOptions } = require('../../scripts/package-app.js');

describe('desktop packaging', () => {
  it('loads exclusions while preserving release archive directory names', () => {
    const options = packageOptions(['--platform=linux', '--arch=x64', '--out=release']);
    expect(options.name).toBe('antistatic-animator');
    expect(options.executableName).toBe('antistatic-animator');
    expect(options.platform).toBe('linux');
    expect(options.arch).toBe('x64');
    expect(options.out).toBe('release');
    for (const file of ['/local-artifacts/private.txt', '/src/electron.ts', '/release/old-app']) {
      expect(options.ignore.some((pattern: RegExp) => pattern.test(file))).toBe(true);
    }
    expect(options.ignore.some((pattern: RegExp) => pattern.test('/dist/electron.js'))).toBe(false);
  });

  it('rejects unsupported options instead of silently ignoring configuration', () => {
    expect(() => packageOptions(['--config=missing.js'])).toThrow();
  });
});
