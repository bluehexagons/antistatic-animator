import { describe, expect, it } from 'vitest';
import {
  animationFileCandidates,
  findAnimationFile,
  isCharacterDataFile,
  stripDataExtension,
} from '../app/file-names';

describe('app file-name helpers', () => {
  it('recognizes character data files without hiding names that merely contain anim', () => {
    expect(isCharacterDataFile('carbon.json')).toBe(true);
    expect(isCharacterDataFile('carbon.jsonc')).toBe(true);
    expect(isCharacterDataFile('animated-statue.json')).toBe(true);
    expect(isCharacterDataFile('carbon_anim.json')).toBe(false);
    expect(isCharacterDataFile('carbon_anim.jsonc')).toBe(false);
    expect(isCharacterDataFile('notes.txt')).toBe(false);
  });

  it('strips only the final data extension', () => {
    expect(stripDataExtension('foo.bar.json')).toBe('foo.bar');
    expect(stripDataExtension('foo.jsonc')).toBe('foo');
  });

  it('derives animation file candidates from the full character stem', () => {
    expect(animationFileCandidates('foo.bar.json')).toEqual([
      'foo.bar_anim.json',
      'foo.bar_anim.jsonc',
    ]);
  });

  it('prefers an existing jsonc animation file when json is absent', () => {
    const existing = new Set(['foo.bar_anim.jsonc']);

    expect(findAnimationFile('foo.bar.json', (name) => existing.has(name))).toBe(
      'foo.bar_anim.jsonc'
    );
  });

  it('defaults to the json animation file name for new saves', () => {
    expect(findAnimationFile('foo.jsonc', () => false)).toBe('foo_anim.json');
  });
});
