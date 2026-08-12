import { describe, expect, it } from 'vitest';
import { EXAMPLE_PROJECTS, EXAMPLE_WORKSPACE_FILES } from '../examples';
import { isCharacterDataFile } from '../app/file-names';
import { lintAnimation } from '../animator/lint';
import { parseStageDocument } from '../stage/document';

describe('bundled examples', () => {
  it('includes multiple local projects with parseable files', () => {
    expect(EXAMPLE_PROJECTS.length).toBeGreaterThanOrEqual(2);
    for (const example of EXAMPLE_PROJECTS) {
      expect(example.files.length).toBeGreaterThan(0);
      expect(new Set(example.files.map((file) => file.path)).size).toBe(example.files.length);
      for (const file of example.files) expect(file.content).toMatch(/^\{|^\[/);
    }
  });

  it('includes a stage example that passes scene-schema validation', () => {
    const stageFile = EXAMPLE_PROJECTS.flatMap((example) => example.files).find((file) =>
      file.path.includes('/stages/')
    );
    expect(stageFile).toBeDefined();
    const parsed = parseStageDocument(stageFile!.content);
    expect(parsed.issues).toEqual([]);
    expect(parsed.document?.scene.schemaVersion).toBe(2);
  });

  it('combines the character and stage examples into one workspace', () => {
    expect(EXAMPLE_WORKSPACE_FILES.some((file) => isCharacterDataFile(file.path))).toBe(true);
    expect(EXAMPLE_WORKSPACE_FILES.some((file) => file.path.includes('/stages/'))).toBe(true);
  });

  it('gives the practice fighter a multi-pose taunt animation', () => {
    const character = JSON.parse(
      EXAMPLE_WORKSPACE_FILES.find((file) => file.path.endsWith('practice-fighter.json'))!.content
    );
    const animations = JSON.parse(
      EXAMPLE_WORKSPACE_FILES.find((file) => file.path.endsWith('practice-fighter_anim.json'))!
        .content
    );
    expect(animations.taunt.keyframes).toHaveLength(4);
    expect(lintAnimation(character, animations.taunt, 'taunt')).toEqual([]);
  });
});
